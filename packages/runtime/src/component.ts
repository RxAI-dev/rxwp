import {createResource, memo, untrack} from '../reactivity'

import {JSX, Component, SplitProps, MergeProps} from './types'
import {nextHydrateContext, setHydrateContext, sharedConfig} from './hydration'
import {signal} from "../reactivity/observable";

export const $PROXY = Symbol('rx-web/Proxy')

let hydrationEnabled = false

export function enableHydration() {
    hydrationEnabled = true
}

export function createComponent<T>(Comp: Component<T>, props: T): JSX.Element {
    if (hydrationEnabled && sharedConfig.context) {
        const c = sharedConfig.context
        setHydrateContext(nextHydrateContext())
        const r = untrack(() => Comp(props || ({} as T)))
        setHydrateContext(c)
        return r
    }
    // TODO: Dev-Mode Component
    return untrack(() => Comp(props || ({} as T)))
}

function trueFn() {
    return true
}

const propTraps: ProxyHandler<{
    get: (k: string | number | symbol) => any
    has: (k: string | number | symbol) => boolean
    keys: () => string[]
}> = {
    get(_, property, receiver) {
        if (property === $PROXY) return receiver
        return _.get(property)
    },
    has(_, property) {
        return _.has(property)
    },
    set: trueFn,
    deleteProperty: trueFn,
    getOwnPropertyDescriptor(_, property) {
        return {
            configurable: true,
            enumerable: true,
            get() {
                return _.get(property)
            },
            set: trueFn,
            deleteProperty: trueFn
        }
    },
    ownKeys(_) {
        return _.keys()
    }
}

function resolveSource(s: any) {
    return !(s = typeof s === 'function' ? s() : s) ? {} : s
}

export function mergeProps<T extends unknown[]>(...sources: T): MergeProps<T> {
    let proxy = false
    for (let i = 0; i < sources.length; i++) {
        const s = sources[i]
        proxy ||= !!s && $PROXY in (s as object)
        sources[i] = typeof s === 'function' ? ((proxy = true), memo(s as (v?: any) => any)) : s
    }
    if (proxy) {
        return new Proxy(
            {
                get(property: string | number | symbol) {
                    for (let i = sources.length - 1; i >= 0; i--) {
                        const v = resolveSource(sources[i])[property]
                        if (v !== undefined) return v
                    }
                },
                has(property: string | number | symbol) {
                    for (let i = sources.length - 1; i >= 0; i--) {
                        if (property in resolveSource(sources[i])) return true
                    }
                    return false
                },
                keys() {
                    const keys = []
                    for (let i = 0; i < sources.length; i++)
                        keys.push(...Object.keys(resolveSource(sources[i])))
                    return [...new Set(keys)]
                }
            },
            propTraps
        ) as unknown as MergeProps<T>
    }
    const target = {} as MergeProps<T>
    for (let i = sources.length - 1; i >= 0; i--) {
        if (sources[i]) {
            const descriptors = Object.getOwnPropertyDescriptors(sources[i])
            for (const key in descriptors) {
                if (key in target) continue
                Object.defineProperty(target, key, {
                    enumerable: true,
                    get() {
                        for (let i = sources.length - 1; i >= 0; i--) {
                            const v = ((sources[i] as any) || {})[key]
                            if (v !== undefined) return v
                        }
                    }
                })
            }
        }
    }
    return target
}

export function splitProps<T, K extends [readonly (keyof T)[], ...(readonly (keyof T)[])[]]>(
    props: T,
    ...keys: K
): SplitProps<T, K> {
    const blocked = new Set<keyof T>((keys as Array<any>).flat())
    const descriptors = Object.getOwnPropertyDescriptors(props)
    const isProxy = $PROXY in (props as object)
    if (!isProxy)
        keys.push(Object.keys(descriptors).filter(k => !blocked.has(k as keyof T)) as (keyof T)[])
    const res = keys.map(k => {
        const clone = {}
        for (let i = 0; i < k.length; i++) {
            const key = k[i]
            if (!isProxy && !(key in (props as object))) continue // skip defining keys that don't exist
            Object.defineProperty(
                clone,
                key,
                descriptors[key]
                    ? descriptors[key]
                    : {
                        get() {
                            return props[key]
                        },
                        set() {
                            return true
                        },
                        enumerable: true
                    }
            )
        }
        return clone
    })
    if (isProxy) {
        res.push(
            new Proxy(
                {
                    get(property: string | number | symbol) {
                        return blocked.has(property as keyof T) ? undefined : props[property as keyof T]
                    },
                    has(property: string | number | symbol) {
                        return blocked.has(property as keyof T) ? false : property in (props as object)
                    },
                    keys() {
                        return Object.keys(props as object).filter(k => !blocked.has(k as keyof T))
                    }
                },
                propTraps
            )
        )
    }
    return res as SplitProps<T, K>
}

export function lazy<T extends Component<any>>(
    fn: () => Promise<{ default: T }>
): T & { preload: () => Promise<{ default: T }> } {
    let comp: () => T | undefined, loadingObs: () => boolean
    let p: Promise<{ default: T }> | undefined
    const wrap: T & { preload?: () => void } = ((props: any) => {
        const ctx = sharedConfig.context
        if (ctx) {
            const [s, set] = signal<T>()
            ;(p || (p = fn())).then(mod => {
                setHydrateContext(ctx)
                set(() => mod.default)
                setHydrateContext()
            })
            comp = s
        } else if (!comp) {
            const { data, loading, load } = createResource<T>(() => (p || (p = fn())).then(mod => mod.default))
            comp = data
            loadingObs = loading
            load()
        }
        let Comp: T | undefined
        return memo(
            () =>
                (Comp = comp()) &&
                untrack(() => {
                    if (!ctx) return Comp!(props)
                    const c = sharedConfig.context
                    setHydrateContext(ctx)
                    const r = Comp!(props)
                    setHydrateContext(c)
                    return r
                })
        )
    }) as T
    wrap.preload = () => p || ((p = fn()).then(mod => (comp = () => mod.default)))
    return wrap as T & { preload: () => Promise<{ default: T }> }
}

let counter = 0

export function createUniqueId(): string {
    const ctx = sharedConfig.context
    return ctx ? `${ctx.id}${ctx.count++}` : `cl-${counter++}`
}

export const children = resolveChildren

function resolveChildren(
    children: JSX.Element | JSX.Element[] | (() => JSX.Element)
): JSX.Element | JSX.Element[] {
    if (typeof children === 'function') return memo(() => resolveChildren(children()))
    if (Array.isArray(children)) {
        const results: JSX.Element[] = []
        for (let i = 0; i < children.length; i++) {
            const result = resolveChildren(children[i])
            Array.isArray(result)
                ? // eslint-disable-next-line prefer-spread
                results.push.apply(results, result)
                : results.push(result)
        }
        return results
    }
    return children
}

import {
  observable,
  root,
  memo,
  cleanup,
  untrack,
  batch,
  Readable,
  PoolItem,
  Equals,
  Observable,
  observer,
  renderEffect
} from '../reactivity'
import { indexArray, mapArray, MapArrayOptions, IndexArrayOptions } from './arrays'

import type { ComponentProps, JSX, ValidComponent } from './types'
import { children, splitProps } from './component'
import { sharedConfig } from './hydration'
import { SVGElements, insert, spread, getNextElement } from './client'

export interface KeyedListProps<T, U extends JSX.Element> {
  of: readonly T[] | undefined | null | false
  fallback?: JSX.Element
  pool?: true | Map<T, PoolItem<T, U>>
  children: (item: T, index: Readable<number>) => U
}

export function $for<T, U extends JSX.Element>(props: KeyedListProps<T, U>): Readable<U[]> {
  const options: MapArrayOptions<T, U> = {
    pool: props.pool
  }
  'fallback' in props && (options.fallback = () => props.fallback)
  return memo(mapArray(() => props.of, props.children, options))
}

export interface NonKeyedListProps<T, U extends JSX.Element> {
  of: readonly T[] | undefined | null | false
  fallback?: JSX.Element
  pool?: true | Map<number, PoolItem<T, U>>
  children: (item: Readable<T>, index: number) => U
}

export function $index<T, U extends JSX.Element>(props: NonKeyedListProps<T, U>): Readable<U[]> {
  const options: IndexArrayOptions<T, U> = {
    pool: props.pool
  }
  'fallback' in props && (options.fallback = () => props.fallback)
  return memo(indexArray(() => props.of, props.children, options))
}

export interface ShowProps<T> {
  if: T | undefined | null | false
  keyed?: boolean
  fallback?: JSX.Element
  children: JSX.Element | ((item: NonNullable<T>) => JSX.Element)
}

export function $show<T>(props: ShowProps<T>): Readable<JSX.Element> {
  let strictEqual = false
  const condition = memo<T | undefined | null | boolean>(
    () => props.if,
    undefined,
    (a, b) => (strictEqual ? a === b : !a === !b)
  )
  return memo(() => {
    const c = condition() as NonNullable<T>
    if (c) {
      const child = props.children
      const fn = typeof child === 'function' && child.length > 0
      strictEqual = props.keyed || fn
      return fn ? untrack(() => child(c)) : child
    }
    return props.fallback
  }) as Readable<JSX.Element>
}

type EvalConditions = [number, unknown?, MatchProps<unknown>?]

export function $switch<T = undefined>(props: {
  test?: T | undefined | null
  fallback?: JSX.Element
  children: JSX.Element
}): Readable<JSX.Element> {
  let strictEqual = false
  let keyed = false
  const equals: Equals<any> = (a, b) =>
    a[0] === b[0] && (strictEqual ? a[1] === b[1] : !a[1] === !b[1]) && a[2] === b[2]
  const conditions = children(() => props.children) as unknown as () => MatchProps<unknown>[],
    evalConditions = memo(
      (): EvalConditions => {
        let conds = conditions()
        if (!Array.isArray(conds)) conds = [conds]
        for (let i = 0, c, p; i < conds.length; i++) {
          if ((p = conds[i]).default) c = true
          else if ('test' in props && 'case' in p) {
            c = props.test === p.case
            if ('if' in p) c &&= p.if
          } else c = p.if
          if (c) {
            keyed = p.keyed as boolean
            return [i, c, p]
          }
        }
        return [-1]
      },
      undefined as unknown as EvalConditions,
      equals
    )
  return memo(() => {
    const [index, when, cond] = evalConditions()
    if (index < 0) return props.fallback
    const c = cond!.children
    const fn = typeof c === 'function' && c.length > 0
    strictEqual = keyed || fn
    return fn ? untrack(() => (c as any)(when)) : c
  })
}

export interface MatchProps<T> {
  if?: T | undefined | null | false
  case?: T | undefined | null | false
  default?: boolean
  keyed?: boolean
  children: JSX.Element | ((item: NonNullable<T>) => JSX.Element)
}

export function $match<T>(props: MatchProps<T>) {
  return props as unknown as JSX.Element
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
function createElement(tagName: string, isSVG = false): HTMLElement | SVGElement {
  return isSVG ? document.createElementNS(SVG_NAMESPACE, tagName) : document.createElement(tagName)
}
type DynamicProps<T extends ValidComponent, P = ComponentProps<T>> = {
  [K in keyof P]: P[K]
} & {
  component: T | undefined
}
export function $dynamic<T extends ValidComponent>(props: DynamicProps<T>): Readable<JSX.Element> {
  const [p, others] = splitProps(props, ['component'])
  const cached = memo<Function | string>(() => p.component)
  return memo(() => {
    const component = cached()
    switch (typeof component) {
      case 'function':
        return untrack(() => component(others))

        case 'string': {
            const isSvg = SVGElements.has(component)
            const el = sharedConfig.context ? getNextElement() : createElement(component, isSvg)
            spread(el, others, isSvg)
            return el
        }

      default:
        break
    }
  })
}

const PORTAL_OUTLET_REGISTRY: Record<string | symbol, [Node, Set<() => void>]> = {}

export function $portal<T extends boolean = false, S extends boolean = false>(props: {
  mount?: Node | string | symbol
  useShadow?: T
  isSVG?: S
  ref?:
    | (S extends true ? SVGGElement : HTMLDivElement)
    | ((
        el: (T extends true ? { readonly shadowRoot: ShadowRoot } : {}) &
          (S extends true ? SVGGElement : HTMLDivElement)
      ) => void)
  children: JSX.Element
}) {
  const useShadow = props.useShadow,
    marker = document.createTextNode('')
  // don't render when hydrating
  function renderPortal() {
    if (sharedConfig.context) {
      const s = observable(false)
      queueMicrotask(() => s(true))
      return () => s() && props.children
    } else return () => props.children
  }

  if (props.mount instanceof HTMLHeadElement) {
    const clean = observable(false)
    const setCleaned = () => clean(true)
    root(dispose =>
      insert(props.mount as HTMLHeadElement, () => (!clean() ? renderPortal()() : dispose()), null)
    )
    cleanup(() => {
      if (sharedConfig.context) queueMicrotask(setCleaned)
      else setCleaned()
    })
  } else {
    const container = createElement(props.isSVG ? 'g' : 'div', props.isSVG),
      renderRoot =
        useShadow && container.attachShadow ? container.attachShadow({ mode: 'open' }) : container

    Object.defineProperty(container, '_$host', {
      get() {
        return marker.parentNode
      },
      configurable: true
    })
    const render = () =>
      root(d => {
        rendered = true
        insert(renderRoot, renderPortal())
        return () => {
          d()
          rendered = false
          renderRoot.textContent = ''
        }
      })
    let dispose: () => void,
      init = true,
      rendered = false
    cleanup(() => dispose())
    renderEffect(() => {
      let mount: Node, disposers: Set<() => void>
      if (typeof props.mount === 'string' || typeof props.mount === 'symbol') {
        if (PORTAL_OUTLET_REGISTRY[props.mount]) {
          ;[mount, disposers] = PORTAL_OUTLET_REGISTRY[props.mount]
          !rendered && (dispose = render())
          disposers.add(dispose)
        } else {
          rendered && dispose()
          return
        }
      } else {
        !rendered && (dispose = render())
        mount = props.mount || document.body
      }

      mount.appendChild(container)
      if (init && props.ref) {
        init = false
        ;(props.ref as Function)(container)
      }
      cleanup(() => {
        mount.removeChild(container)
        disposers && disposers.delete(dispose)
      })
    })
  }
  return marker
}

export function registerPortalOutlet(id: string | symbol, mount: Node, disposers: Set<() => void>) {
  PORTAL_OUTLET_REGISTRY[id] = [mount, disposers]
}

export function portalOutlet(element: Node, id: string | symbol) {
  const disposers = new Set<() => void>()
  registerPortalOutlet(id, element, disposers)
  cleanup(() => {
    for (const d of disposers) d()
  })
}

interface Subscriber<T> {
  next?: (value: T) => void
  error?: (error: any) => void
  complete?: () => void
}

interface Subscribable<T> {
  subscribe: (
    subscriberOrNext: Subscriber<T> | ((value: T) => void),
    error?: (error: any) => void,
    complete?: () => void
  ) => {
    unsubscribe: () => void
  }
}

export function $subscribe<T>(props: {
  to: Subscribable<T>
  children:
    | ((item: Readable<T>, completed?: Readable<boolean>, retry?: () => void) => JSX.Element)
    | ((item: Readable<T>) => JSX.Element)
  fallback?:
    | JSX.Element
    | (<E>(
        error: Readable<E | undefined>,
        initialized: Readable<boolean>,
        retry?: () => void
      ) => JSX.Element)
}) {
  const result = observable<T>(),
    initialized = observable(false),
    error = observable<any>(undefined),
    completed = props.children.length > 1 ? observable(false) : undefined,
    run = () =>
      props.to.subscribe({
        next: v => {
          if (!untrack(initialized)) {
            batch(() => {
              result(v)
              initialized(true)
            })
          } else result(v)
        },
        error: e => {
          error(e)
        },
        complete: completed ? () => completed(true) : undefined
      }),
    retry =
      props.children.length > 2 ||
      (typeof props.fallback === 'function' && props.fallback.length > 2)
        ? () => {
            batch(() => {
              initialized(false)
              error(undefined)
              result(undefined as T)
              completed && completed(false)
            })
            sub.unsubscribe()
            sub = run()
          }
        : undefined
  let sub = run()

  cleanup(() => sub.unsubscribe())
  return memo(() =>
    initialized() && error() === undefined
      ? untrack(() =>
          completed
            ? props.children(
                () => result()!,
                () => completed(),
                retry
              )
            : props.children(() => result()!)
        )
      : typeof props.fallback === 'function'
      ? (props.fallback as Function)(
          () => error(),
          () => initialized(),
          retry!
        )
      : props.fallback
  )
}

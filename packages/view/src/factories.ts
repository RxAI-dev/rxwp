import { getOwner, setOwner, root, cleanup, remountableRoot, ObserverNode, remount } from '@rxwp/reactivity'
type Component<P> = (props: P) => JSX.Element

function shared<P>(service: () => Component<P>): Component<P> {
    let Cmp: Component<P> | undefined = undefined

    function InnerComponent(props: P) {
        if (!Cmp) {
            const $$Owner = getOwner()
            setOwner($$Owner.app.owner)
            Cmp = service()
            setOwner($$Owner)
        }
        return Cmp(props)
    }

    return InnerComponent
}

function provider<P>(component: Component<P>): Component<P> {
    return (props: P) => {
        return root(() => component(props))
    }
}

interface RemountablePoolItem<P> {
    id: number
    dom: JSX.Element
    onRemount: (props: P) => void
    observer: ObserverNode<P>
    owned: ObserverNode<any>[]
    cleanups: (() => void)[]
    owner: ObserverNode<any>
    dispose: () => void
}

function remountable<P extends object>(init: () => [onRemount: (props: P) => void, component: Component<P>]): Component<P> {
    let id = 0;
    const pool: RemountablePoolItem<P>[] = []
    const propsPool: Record<number, P> = {}
    const activePool: RemountablePoolItem<P>[] = []

    function InnerComponent(props: P) {
        const owner = getOwner()

        if (pool.length === 0) {
            const componentId = id++
            const [onRemount, Cmp] = init()

            onRemount(props)
            propsPool[componentId] = props

            const propsProxy = new Proxy<P>(propsPool[componentId], {
                get(target: P, p: string | symbol, receiver: any): any {
                    return propsPool[componentId][p as keyof P]
                },
                has(target: P, p: string | symbol): boolean {
                    return propsPool[componentId][p as keyof P] !== null
                },
            })

            return remountableRoot((dispose: () => void) => {
                const observer = getOwner()

                const dom = Cmp(propsProxy)

                const item: RemountablePoolItem<P> = {
                    id: componentId,
                    dom,
                    onRemount,
                    dispose,
                    owner,
                    owned: observer.owned,
                    cleanups: observer.cleanups,
                    observer,
                }

                cleanup(() => {
                    const index = activePool.indexOf(item)
                    activePool.splice(index, 1)
                    pool.push(item)
                })

                activePool.push(item)

                return dom
            })
        } else {
            const last = pool.pop()!
            const componentId = last.id

            last.onRemount(props)
            propsPool[componentId] = props

            const observer = last.observer
            observer.owned = last.owned
            observer.cleanups = last.cleanups
            owner.owned.push(observer)
            remount(observer)

            activePool.push(last)
            return last.dom
        }
    }

    return InnerComponent
}

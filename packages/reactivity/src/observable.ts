import type {
    Equals,
    ErrorHandler,
    MemoCreator,
    NotPending,
    Observable,
    ObservableCreator, ObservableSignal,
    ObserverCreator,
    ObserverNode,
    QueueItem,
    Readable, SignalCreator,
    Subscription,
    WritableNode
} from './types'
import {callAll, isFunction, lookup, runAll} from './utils'
import {ObserverType, State} from './enums'

/* **************************************************************************************************** *
 * Classes - Reactive Graph nodes and queues                                                            *
 * **************************************************************************************************** *
 * - in some cases, especially as data containers, and if there are many same type instances,           *
 *   Classes are noticeable faster, than plain object literals and functions                            *
 * - but only with bound methods, that are operating on its internal data                               *
 *   structures - i.e. returning instance method, that operates on `this`, bound to instance with       *
 *   `method.bind(instance)`, seems to be faster, than creating and returning new function, that's      *
 *   working on some data object from its scope                                                         *
 * - however, moving more features from functions to classes, makes it a lot slower, so for the best    *
 *   performance, it should be balanced                                                                 *
 * - x:RX has the best possible balance, between functions and classes, to achieve the best performance *
 * - the x:RX API is 100% functional and implementation is also mostly functional, classes are only     *
 *   used as data structures/containers with bound functions, for best performance                      *
 * **************************************************************************************************** */

/**
 * Queue<T extends QueueItem<any>>
 *
 * Generic class for the best performance queue implementation:
 * - it's faster than basic array queue, because it's not removing items from its inner
 *   array on flush/clear, but resetting size field (that's simulating array length)
 * - so the inner array length is always the same as max reached size value
 * - then, after size reset, it's replacing items, instead of adding, until it reach max size
 * - so it's doing only the minimal number of inner array length modifications and only length
 *   modifications are pushes over the max reached size - but thanks to size abstraction, it
 *   acts like setting new array on clear
 */
class Queue<T extends QueueItem<any>> {
    readonly items: T[]
    size: number
    private readonly fn: (item: T) => void

    constructor(fn: (item: T) => void) {
        this.items = []
        this.size = 0
        this.fn = fn
    }

    add(item: T) {
        this.items[this.size++] = item
    }

    itemIndex(item: T) {
        return this.items.indexOf(item)
    }

    remove(itemIndex: number) {
        this.items.splice(itemIndex, 1)
    }

    run() {
        const items = this.items
        for (let i = 0; i < this.size; i++) {
            try {
                const item = items[i]
                items[i] = null!
                this.fn(item)
            } catch (err) {
                handleError(err)
            }
        }
        this.size = 0
    }
}

/**
 * Source<T>
 *
 * The observable data source node - extremely fast implementation of Observable wrapper, it's
 * small and simple object - creating its instance is just like creating simple object with 4 fields
 */
class Source<T> implements WritableNode<T> {
    public value: T
    public pending: T | NotPending
    public sub: Subscription | null
    private locked: number
    private readonly eq: Equals<T> | null

    constructor(value: T, equals: Equals<T> | null) {
        this.value = value
        this.pending = NOT_PENDING
        this.sub = null
        this.eq = equals
        this.locked = 0
    }

    current(): T {
        if ($$Observer !== null) {
            if (this.sub === null) this.sub = new SourceSub()
            this.sub.connect()
        }
        return this.value as T
    }

    private next(value: T): T {
        if (this.locked > 0) {
            this.pending = value
            return this.pending
        }

        if ($$IsRunning) {
            // A. Batch updates mode
            // add this observable update to $$Changes queue, if it isn't already pending
            if (this.pending === NOT_PENDING) $$Changes.add(this)
            // update pending value
            this.pending = value
        } else {
            // B. Single update mode
            // check if this observable has subscribed observers
            if (this.sub !== null) {
                // update pending value
                this.pending = value
                // add update to $$Changes queue
                $$Changes.add(this)
                // and run it immediately
                event()
            } else {
                // change value, when no observer is subscribed
                this.value = value
            }
        }
        return value
    }

    lock(): void {
        this.locked++
        if ($$IsRunning) {
            const srcIndexInChanges = $$Changes.itemIndex(this)
            if (srcIndexInChanges !== -1) {
                $$Changes.remove(srcIndexInChanges)
            }
        }
    }

    unlock() {
        if (this.locked === 0) return
        if (--this.locked === 0 && this.pending !== NOT_PENDING) {
            $$Changes.add(this);
            if (!$$IsRunning) {
                event();
            }
        }
    }

    call(next?: T | ((nextVal: T) => T)) {
        if (arguments.length === 0) return this.current()
        const lastValue = (this.pending === NOT_PENDING ? this.value : this.pending) as T
        next = isFunction(next) ? next(lastValue) : next!
        return !this.eq || !this.eq(lastValue, next) ? this.next(next) : lastValue
    }
}

/**
 * Observer<T>
 *
 * The generic observer reactive node - core part of Reactive Graph - this class is used for all
 * observers, memo, but also reactive roots (it's faster when all reactive graph nodes have the
 * same shape).
 */
class Observer<T> implements ObserverNode<T> {
    public type: ObserverNode<T>['type']
    public state: ObserverNode<T>['state']
    public fn: ObserverNode<T>['fn']
    public value: ObserverNode<T>['value']
    public eq: ObserverNode<T>['eq']
    public age: ObserverNode<T>['age']
    public app: ObserverNode<T>['app']
    public owner: ObserverNode<T>['owner']
    public owned: ObserverNode<T>['owned']
    public ctx: ObserverNode<T>['ctx']
    public cleanups: ObserverNode<T>['cleanups']
    public src1: ObserverNode<T>['src1']
    public src1Slot: ObserverNode<T>['src1Slot']
    public srcs: ObserverNode<T>['srcs']
    public srcSlots: ObserverNode<T>['srcSlots']
    public deps: ObserverNode<T>['deps']
    public depSlot: ObserverNode<T>['depSlot']
    public depsCount: ObserverNode<T>['depsCount']
    public sub: ObserverNode<T>['sub']

    constructor(
        type: ObserverType,
        state: State,
        fn: ((v?: T) => T) | null = null,
        value: T | undefined = undefined,
        eq: Equals<T> | null = null
    ) {
        this.type = type
        this.state = state
        this.fn = fn
        this.value = value
        this.eq = eq
        this.age = $$Time
        this.app = $$Owner?.app || null
        this.owner = $$Owner
        this.owned = null
        this.ctx = null
        this.cleanups = null
        this.src1 = null
        this.src1Slot = 0
        this.srcs = null
        this.srcSlots = null
        this.deps = null
        this.depsCount = 0
        this.depSlot = 0
        this.sub = null
    }

    /**
     * Call
     *
     * Read observer value (update observer before, if needed) and connect it to the current Observer
     */
    call(): T {
        if (this.type === ObserverType.Computed && (this.state & State.Stale) !== 0) {
            updateNode(this)
        }
        if ($$Observer !== null) {
            const state = this.state
            if ((state & State.Liftable) !== 0) {
                liftObserver(this)
            }
            if (this.age === $$Time && state === State.Running) {
                throw new Error('Circular dependency.')
            }
            if ((state & State.Disposed) === 0) {
                if (this.sub === null) this.sub = new SourceSub()
                this.sub.connect()
            }
        }
        return this.value as T
    }
}

/**
 * SourceSub
 *
 * Object responsible for managing connections/subscriptions, between observables
 * and observers.
 */
class SourceSub implements Subscription {
    public obs1: Subscription['obs1']
    public obs1Slot: Subscription['obs1Slot']
    public obs: Subscription['obs']
    public obsSlots: Subscription['obsSlots']

    constructor() {
        this.obs1 = null
        this.obs1Slot = 0
        this.obs = null
        this.obsSlots = null
    }

    connect() {
        const to = $$Observer!,
            obsSrcs = to.srcs,
            srcObs = this.obs,
            srcObs1 = this.obs1,
            toSlot = to.src1 === null ? -1 : obsSrcs === null ? 0 : obsSrcs.length
        let fromSlot: number
        if (srcObs1 === null) {
            this.obs1 = to
            this.obs1Slot = toSlot
            fromSlot = -1
        } else if (srcObs === null) {
            if (srcObs1 === to) return
            this.obs = [to]
            this.obsSlots = [toSlot]
            fromSlot = 0
        } else {
            fromSlot = srcObs.length
            if (srcObs[fromSlot - 1] === to) return
            srcObs.push(to)
            this.obsSlots!.push(toSlot)
        }
        if (to.src1 === null) {
            to.src1 = this
            to.src1Slot = fromSlot
        } else if (obsSrcs === null) {
            to.srcs = [this]
            to.srcSlots = [fromSlot]
        } else {
            obsSrcs.push(this)
            to.srcSlots!.push(fromSlot)
        }
    }

    disconnect(slot: number): void {
        const obs = this.obs!,
            obsSlots = this.obsSlots!
        let last: ObserverNode<any>, lastSlot: number
        if (slot === -1) {
            this.obs1 = null
        } else {
            last = obs.pop()!
            lastSlot = obsSlots.pop()!
            if (slot !== obs.length) {
                obs[slot] = last!
                obsSlots[slot] = lastSlot!
                if (lastSlot === -1) last!.src1Slot = slot
                else last!.srcSlots![lastSlot!] = slot
            }
        }
    }
}

export const SUSPENSE = Symbol('suspense')

export class SuspensionSignal implements Error {
    name: string
    message: string
    stack?: string | undefined
    constructor(name: string = 'SuspenseError', message: string = 'Promise Suspended') {
        this.name = name
        this.message = message
    }
}

export class SuspenseContext {
    private pendingCount: number = 0
    private contentObserver: ObserverNode<any> | null
    public isSuspended: Observable<boolean>
    public error: Observable<Error | null>

    constructor() {
        this.pendingCount = 0
        this.contentObserver = null
        this.isSuspended = observable(false)
        this.error = observable<Error | null>(null)
    }

    getError() {
        return this.error()
    }

    setError(error: Error) {
        this.error(error);
        this.decrement(); // Clear pending state on error
    }

    increment() {
        this.pendingCount++
        this.isSuspended(true)
    }

    decrement() {
        this.pendingCount--;
        if (this.pendingCount === 0 && this.contentObserver) {
            // Schedule a re-render of the main content
            batch(() => {
                // Mark content as stale so it re-runs
                this.contentObserver!.state |= State.Stale
                // Run the updates
                updateNode(this.contentObserver!)
            });
        }
    }

    registerContent(observer: ObserverNode<any> | null) {
        this.contentObserver = observer
    }
}

// Constants
const EQUALS = <T>(prev: T, next: T): boolean => prev === next,
    ERROR = Symbol('error'),
    NOT_PENDING: NotPending = {},
    // Queues
    $$Changes = new Queue<WritableNode<any>>(applyDataChange),
    $$Updates = new Queue<ObserverNode<any>>(updateNode),
    $$Disposes = new Queue<ObserverNode<any>>(dispose),
    $$Effects = new Queue<ObserverNode<any>>(updateNode)

// Tracking
let $$Observer: ObserverNode<any> | null = null, // currently running observer
    $$Owner: ObserverNode<any> | null = null, // owner for new observers
    $$Pending: ObserverNode<any> | null = null, // pending observer
    // Scheduling
    $$Time = 0,
    $$IsRunning = false,
    $$PendingEffects: Set<ObserverNode<any>> | null = null

const UNOWNED = createObserverNode(ObserverType.Root, State.Actual)

export const appRoot = <T>(
    fn: (dispose: () => void) => T,
    appInit: Partial<ObserverNode<any>['app']> = {},
    detachedOwner?: ObserverNode<any>
): T =>
    root(dispose => {
        const rootOwner = getOwner()!
        rootOwner.app = {
            ...appInit,
            owner: rootOwner
        }
        return fn(dispose)
    }, detachedOwner)

export const root = <T>(fn: (dispose: () => void) => T, detachedOwner?: ObserverNode<any>): T => {
    detachedOwner && ($$Owner = detachedOwner)
    const owner = $$Owner,
        listener = $$Observer,
        root = fn.length === 0 ? UNOWNED : createObserverNode(ObserverType.Root, State.Actual),
        disposer = () => {
            if (root === UNOWNED) throw new Error('Cannot dispose Unowned root!')
            if ($$IsRunning) $$Disposes.add(root)
            else dispose(root)
        },
        isTopLevel = !$$IsRunning
    let result = undefined
    $$Owner = root
    $$Observer = null
    try {
        result = fn(disposer)
    } catch (err) {
        handleError(err)
    } finally {
        if (isTopLevel) {
            $$IsRunning = true
            if ($$Changes.size > 0 || $$Updates.size > 0) {
                $$Time++
                runQueues()
            } else if ($$Effects.size > 0) {
                $$Time++
                runEffects()
            }
            $$IsRunning = false
        }
        $$Observer = listener
        $$Owner = owner
    }
    return result as T
}

/**
 * Observable
 *
 * Observable data source - most common, single state "variable"
 * @param value
 * @param equals
 */
export const observable: ObservableCreator = <T>(
    value?: T,
    equals: Equals<T> = EQUALS
): Observable<T> => {
    const src = new Source<T>(value!, equals)
    const handler = src.call.bind(src) as Observable<T>
    handler.__src__ = src
    return handler
}

export const signal: SignalCreator = <T>(
    value?: T,
    equals: Equals<T> = EQUALS
): ObservableSignal<T> => {
    const src = new Source<T>(value!, equals)
    return [src.current.bind(src), n => src.call(n)]
}

/**
 * Memo Readable
 *
 * Eagerly-evaluated read-only observable/observer - working on eager $$Updates queue and is
 * initialized on create.
 * @param fn
 * @param initial
 * @param equals
 */
export const memo: MemoCreator = <T>(
    fn: (v?: T) => T,
    initial?: T,
    equals: Equals<T> = EQUALS
): Readable<T> => {
    const observer = createObserverNode(ObserverType.Memo, State.Actual, fn, initial, equals)
    return observer.call.bind(observer)
}

/**
 * Observer
 *
 * Most basic eager observer - run with memos, before renderEffects and effects
 * @param fn
 * @param initial
 */
export const observer: ObserverCreator = <T>(fn: (v?: T) => T, initial?: T): void => {
    createObserverNode(ObserverType.Observer, State.Actual, fn, initial)
}
/**
 * Render Effect
 *
 * Render-time delayed effect - run after all observables/memos/observers are updated,
 * before effects
 * @param fn
 * @param initial
 */
export const renderEffect: ObserverCreator = <T>(fn: (v?: T) => T, initial?: T): void => {
    createObserverNode(ObserverType.RenderEffect, State.Stale, fn, initial)
}
/**
 * Effect
 *
 * After render delayed effect - run after all renderEffects
 * @param fn
 * @param initial
 */
export const effect: ObserverCreator = <T>(fn: (v?: T) => T, initial?: T): void => {
    createObserverNode(ObserverType.AfterEffect, State.Stale, fn, initial)
}

/**
 * Computed Readable
 *
 * Lazy-evaluated read-only observable/observer - same API as memo(), but it's not added to any
 * queue - it's only evaluated on read.
 * @param fn
 * @param initial
 * @param equals
 */
export const computed: MemoCreator = <T>(
    fn: (v?: T) => T,
    initial?: T,
    equals: Equals<T> = EQUALS
): Readable<T> => {
    const observer = createObserverNode(ObserverType.Computed, State.Stale, fn, initial, equals)
    return observer.call.bind(observer)
}

export const selector = <T, U>(
    source: Readable<T>,
    fn: Extract<Equals<T | U>, Function> = EQUALS
): ((key: U) => boolean) => {
    const subs = new Map<U, Set<ObserverNode<any>>>()
    const queueUpdates = (listeners: Set<ObserverNode<any>> | undefined) => {
        if (listeners) {
            for (const c of listeners.values()) {
                c.state = State.Stale
                if ((c.type & ObserverType.EffectsQueue) !== 0) $$Effects.add(c)
                else if (c.type !== ObserverType.Computed) $$Updates.add(c)
            }
        }
    }

    // when fn === EQUALS, there can be only one key selected, so it will be faster to
    // just update next and previous selected observers, instead of iterating all observers
    const update =
        fn === EQUALS
            ? (p: T | undefined, v: T) => {
                if (p) queueUpdates(subs.get(p as U))
                queueUpdates(subs.get(v! as U))
                return v
            }
            : (p: T | undefined, v: T) => {
                for (const [key, val] of subs.entries()) {
                    if (fn(key, v) !== fn(key, p!)) queueUpdates(val)
                }
                return v
            }

    const observer = createObserverNode(
        ObserverType.Memo,
        State.Actual,
        (prev: T | undefined) => update(prev, source()),
        undefined
    )
    return (key: U) => {
        if ($$Observer) {
            const listener = $$Observer
            let l: Set<ObserverNode<any>>
            if ((l = subs.get(key)!)) l.add(listener)
            else subs.set(key, (l = new Set([listener])))
            cleanup(() => {
                l.delete(listener!)
                l.size === 0 && subs.delete(key)
            })
        }
        return fn(key, observer.value!)
    }
}

export const on = <R, D extends Readable<any>>(
    deps: D | D[],
    fn: (v?: R) => R,
    onChanges?: boolean
): ((v?: R) => R) => {
    const resolved = Array.isArray(deps) ? callAll(deps) : deps
    onChanges = !!onChanges

    return (value?: R) => {
        const listener = $$Observer
        resolved()
        if (onChanges) onChanges = false
        else {
            $$Observer = null
            value = fn(value)
            $$Observer = listener
        }
        return value as R
    }
}

export const batch = <T>(fn: () => T): T => {
    let result = undefined
    if ($$IsRunning) result = fn()
    else {
        $$IsRunning = true
        $$Changes.size = 0
        try {
            result = fn()
            event()
        } finally {
            $$IsRunning = false
        }
    }
    return result
}

export function untrack<T>(fn: () => T): T {
    const listener = $$Observer
    $$Observer = null
    const result = fn()
    $$Observer = listener
    return result
}

export const mount = <T = void>(fn: () => T): void => effect<T>(() => untrack(fn))

/**
 * Cleanup
 *
 * Add cleanup function to Owner scope and always execute it before re-computing Owner
 * @param fn
 */
export const cleanup = (fn: (final: boolean) => void): void => {
    if ($$Owner === null)
        console.warn('cleanups created outside a `createRoot` or `render` will never be run')
    else if ($$Owner.cleanups === null) $$Owner.cleanups = [fn]
    else $$Owner.cleanups.push(fn)
}

/**
 * Error
 *
 * Add error boundary to Owner scope and execute it if something in scope throw an error
 * @param fn
 */
export const error = (fn: ErrorHandler): void => {
    if ($$Owner === null)
        console.warn('error handlers created outside a `createRoot` or `render` will never be run')
    else if ($$Owner.ctx === null) $$Owner.ctx = {[ERROR]: [fn]}
    else if (!$$Owner.ctx[ERROR]) $$Owner.ctx[ERROR] = [fn]
    else ($$Owner.ctx[ERROR] as ErrorHandler[]).push(fn)
}

export const contextId = () => Symbol('x-rx/context')

export function context<T>(id: symbol, value?: T): T | undefined {
    if (arguments.length === 2) {
        if ($$Owner) {
            if ($$Owner.ctx) $$Owner.ctx[id] = value
            else $$Owner.ctx = {[id]: value}
            return $$Owner.ctx[id] as T
        }
    } else return lookup<T>($$Owner, id)
}

export const isListening = () => $$Observer !== null

export const getOwner = () => $$Owner

/* ********************************************************************* *
 | --------------------------------------------------------------------- |
 *      |               INTERNAL IMPLEMENTATION                    |     *
 | --------------------------------------------------------------------- |
 * ********************************************************************* */

/**
 * Create Observer Node
 *
 * @param type
 * @param state
 * @param fn
 * @param value
 * @param eq
 */
function createObserverNode<T>(
    type: ObserverType,
    state: State,
    fn: ((v?: T) => T) | null = null,
    value: T | undefined = undefined,
    eq: Equals<T> | null = null
) {
    const observer = new Observer<T>(type, state, fn, value, eq)
    if (fn === null) return observer
    const owner = $$Owner,
        listener = $$Observer
    if (owner === null)
        console.warn('computations created outside a `createRoot` or `render` will never be disposed')
    $$Owner = $$Observer = observer
    if (owner && owner !== UNOWNED) {
        if (owner.owned === null) owner.owned = [observer]
        else owner.owned.push(observer)
    }
    if ((type & ObserverType.EffectsQueue) !== 0) {
        $$Effects.add(observer)
    } else if (observer.type !== ObserverType.Computed) {
        const isTopLevel = !$$IsRunning
        isTopLevel && ($$IsRunning = true)
        try {
            observer.value = observer.fn!(observer.value as T) as T
        } catch (e) {
            handleError(e)
        } finally {
            isTopLevel && ($$IsRunning = false)
        }
    }
    $$Owner = owner
    $$Observer = listener
    return observer
}

function event() {
    const owner = $$Owner
    $$Updates.size = 0
    $$Time++
    try {
        runQueues()
    } finally {
        $$IsRunning = false
        $$Observer = null
        $$Owner = owner
    }
}

/* ************************************************************************************************ *
 * Reactive Graph Traverse, Mark & Update Algorithm                                                 *
 * ************************************************************************************************ *
 * - based on modified S.js algorithm, using bit flags for deep marking                             *
 * - added additional, "lazy" effects queue, to handle lifecycles                                   *
 * - effects are rescheduled to next tick and accumulated, when "eager" queue updates are replayed  *
 * - so "lazy" effects queue will only be run, if "eager" queues are empty                          *
 * - additionally, it's guaranteed, that all the "renderEffects" will run before the "effects"      *
 * - so, "effects" are "fake-async" queue - running at the end, after all accumulated (replayed)    *
 *   "eager" queue updates and all "lazy", sync "renderEffects" - mainly renderer tasks - it acts   *
 *   almost like its async - in most real life cases, it will run as the last task on sync call     *
 *   stack, (potentially) just before the first async operation                                     *
 * ************************************************************************************************ */

function runQueues() {
    const running = $$IsRunning
    let count = 0
    $$IsRunning = true
    $$Disposes.size = 0
    // Run queued updates - each iteration is a single $$Time tick
    // If new $$Changes, $$Updates or $$Disposes are added during update tick, it's replayed as new tick
    while ($$Changes.size > 0 || $$Updates.size > 0 || $$Disposes.size > 0) {
        if (count > 0) $$Time++ // don't tick on first run, or else we expire already scheduled updates
        $$Changes.run() // Run $$Changes queue - observable value changes
        $$Updates.run() // Run $$Updates queue - observers and memos updates
        $$Disposes.run() // Run $$Disposes queue - roots disposed during update tick
        // if there are still changes after excessive batches, assume runaway
        if (count++ > 1e5) throw new Error('Runaway clock detected')
        // Check if next tick is scheduled and if there are effects to reschedule
        if ($$Effects.size > 0 && ($$Changes.size > 0 || $$Updates.size > 0)) {
            // Save pending effects before replay - effects are rescheduled to next $$Time tick and accumulated.
            // They will run only when $$Changes and $$Updates queues are empty - after all replays.
            savePendingEffects()
        }
    }

    if ($$Effects.size > 0 || $$PendingEffects !== null) runEffects()
    $$IsRunning = running
}

function savePendingEffects() {
    if ($$PendingEffects === null) {
        $$PendingEffects = new Set($$Effects.items.slice(0, $$Effects.size))
    } else {
        for (let i = 0; i < $$Effects.size; ++i) {
            $$PendingEffects.add($$Effects.items[i])
        }
    }
    $$Effects.size = 0
}

function runEffects(): void {
    let i: number
    const afterEffects = []
    if ($$PendingEffects !== null) {
        for (const observer of $$PendingEffects) {
            try {
                if (observer.type === ObserverType.RenderEffect) updateNode(observer)
                else afterEffects.push(observer)
            } catch (e) {
                handleError(e)
            }
        }
        $$PendingEffects = null
    }

    if ($$Effects.size > 0) {
        for (i = 0; i < $$Effects.size; ++i) {
            try {
                const observer = $$Effects.items[i]
                if (observer.type === ObserverType.RenderEffect) updateNode(observer)
                else afterEffects.push(observer)
            } catch (e) {
                handleError(e)
            }
        }
        $$Effects.size = 0
    }

    if (afterEffects.length > 0) {
        for (i = 0; i < afterEffects.length; ++i) {
            try {
                updateNode(afterEffects[i])
            } catch (e) {
                handleError(e)
            }
        }
    }
    if ($$Disposes.size > 0) $$Disposes.run()
    // If some observables were updated during effects run, schedule next updates
    if ($$Changes.size > 0 || $$Updates.size > 0) {
        $$Time++
        runQueues()
    } else if ($$Effects.size > 0) {
        $$Time++
        runEffects()
    }
}

function applyDataChange<T>(src: WritableNode<T>) {
    src.value = src.pending as T
    src.pending = NOT_PENDING
    if (src.sub) markObservers(src.sub, stale)
}

function updateNode<T>(observer: ObserverNode<T>): void {
    const state = observer.state
    if ((state & State.Disposed) === 0) {
        if ((state & State.Pending) !== 0) {
            // If Pending, remove one of deps and wait for next update in queue
            observer.deps![observer.depSlot++] = null
            if (observer.depSlot === observer.depsCount) {
                // If all deps are removed, remove pending states - if it has also Stale
                // flag, switch to Stale and update in next update in queue, otherwise
                // mark as Actual
                resetObserver(observer, State.PendingStates)
            }
        } else if ((state & State.Stale) !== 0) {
            if ((state & State.PendingDisposal) !== 0) {
                // If observer is Stale and PendingDisposal, try to update its parents & upstream first
                liftObserver(observer)
            } else if (observer.eq) {
                // When Observer is only Stale, it means almost one of its deps changed - re-run
                // its computation - and if its value changed, mark downstream as Stale
                const current = runObserver(observer)
                if (!observer.eq(current, observer.value as T)) {
                    markDownstream(observer, false, true)
                }
            } else {
                // When Observer is Stale and hasn't got compare function, just re-run its computation
                runObserver(observer)
            }
        }
    }
}

function runObserver<T>(observer: ObserverNode<T>): T {
    const value = observer.value,
        owner = $$Owner,
        listener = $$Observer
    $$Owner = $$Observer = observer
    observer.state = State.Running
    disconnect(observer, false)
    observer.value = observer.fn!(value as T) as T
    resetObserver(observer, State.All)
    $$Owner = owner
    $$Observer = listener
    return value as T
}

function stale<T>(observer: ObserverNode<T>): void {
    if (observer.age < $$Time) {
        observer.age = $$Time
        // Add Stale state flag to Observer (could have already Pending, PendingDisposal or both)
        const isEffect = (observer.type & ObserverType.EffectsQueue) !== 0
        if (isEffect && isPendingEffect(observer)) stalePendingEffect(observer)
        else {
            observer.state |= State.Stale
            if (isEffect) $$Effects.add(observer)
            else if (observer.type !== ObserverType.Computed) $$Updates.add(observer)
            prepareDownstream(observer, !!observer.eq)
        }
    }
}

function pending<T>(observer: ObserverNode<T>): void {
    if (observer.age < $$Time) {
        const isEffect = (observer.type & ObserverType.EffectsQueue) !== 0
        if (!(isEffect && isPendingEffect(observer) && observer.state === State.PendingDisposal)) {
            // Add Pending flag to Observer (could be in PendingDisposal) or left it, if it's Pending
            observer.state |= State.Pending
            const deps = observer.deps || (observer.deps = [])
            deps[observer.depsCount++] = $$Pending
            if (isEffect) $$Effects.add(observer)
            else if (observer.type !== ObserverType.Computed) $$Updates.add(observer)
            prepareDownstream(observer, true)
        }
    }
}

function stalePending<T>(observer: ObserverNode<T>): void {
    if ((observer.state & State.Pending) !== 0) {
        // Switch observer flag to Stale if it's in Pending state
        observer.state = State.Stale
        if (observer.age < $$Time) {
            observer.age = $$Time
            if (!observer.eq) markDownstream(observer, false, true)
        }
    }
}

function isPendingEffect<T>(observer: ObserverNode<T>) {
    return $$PendingEffects !== null && $$PendingEffects.has(observer)
}

/**
 * Stale Pending Effect Observer
 *
 * Mark effect that's pending from previous tick as stale
 * @param observer
 */
const stalePendingEffect = <T>(observer: ObserverNode<T>): void => {
    const state = observer.state,
        owned = observer.owned
    if ((state & State.Stale) === 0) {
        if (state === State.Pending) {
            observer.state = State.Stale
            if (owned !== null) markForDisposal(owned, false)
        } else if ((state & State.PendingDisposal) !== 0) {
            observer.state |= State.Stale
            if (owned !== null) markForDisposal(owned, false)
        }
    }
}

function prepareDownstream<T>(observer: ObserverNode<T>, pending: boolean): void {
    if (observer.eq) {
        const pending = $$Pending
        $$Pending = observer
        markDownstream(observer, true, false)
        $$Pending = pending
    } else {
        markDownstream(observer, pending, false)
    }
}

function getStateFn(observerType: ObserverType, onChange: boolean, dirty: boolean) {
    if (observerType === ObserverType.Computed) {
        return stale
    } else {
        return dirty ? stalePending : onChange ? pending : stale
    }
}

function markDownstream<T>(observer: ObserverNode<T>, onChange: boolean, dirty: boolean): void {
    if (observer.owned !== null) markForDisposal(observer.owned, onChange && !dirty)
    if (observer.sub !== null) {
        markObservers(observer.sub, getStateFn(observer.type, onChange, dirty))
    }
}

function markObservers(sub: Subscription, stateFn: <T>(item: ObserverNode<T>) => void): void {
    const obs1 = sub.obs1,
        obs = sub.obs
    if (obs1 !== null) stateFn(obs1)
    if (obs !== null) {
        for (let i = 0, l = obs.length; i < l; i++) stateFn(obs[i])
    }
}


function markForDisposal(children: ObserverNode<any>[], pending: boolean): void {
    for (let i = 0, l = children.length; i < l; ++i) {
        const child = children[i]
        if (child !== null) {
            if (pending) {
                if ((child.state & State.Disposed) === 0) {
                    child.state |= State.PendingDisposal
                }
            } else {
                child.age = $$Time
                child.state = State.Disposed
            }
            const owned = child.owned
            if (owned !== null) markForDisposal(owned, pending)
        }
    }
}

function liftObserver<T>(observer: ObserverNode<T>): void {
    if ((observer.state & State.Upstreamable) !== 0) {
        applyUpstream(observer)
    }
    if ((observer.state & State.Stale) !== 0) {
        updateNode(observer)
    }
    resetObserver(observer, State.All)
}

function applyUpstream<T>(observer: ObserverNode<T>): void {
    if ((observer.state & State.PendingDisposal) !== 0) {
        const owner = observer.owner!
        if ((owner.state & State.Liftable) !== 0) liftObserver(owner)
        observer.state &= ~State.PendingDisposal
    }
    if ((observer.state & State.Pending) !== 0) {
        const deps = observer.deps!,
            l = observer.depsCount
        for (let i = observer.depSlot; i < l; ++i) {
            const dep = deps[i]
            if (dep !== null) liftObserver(dep)
            deps[i] = null
        }
        observer.state &= ~State.Pending
    }
}

function disconnect<T>(observer: ObserverNode<T>, final: boolean): void {
    const src1 = observer.src1,
        srcs = observer.srcs,
        cleanups = observer.cleanups,
        owned = observer.owned
    let i: number, l: number
    if (cleanups !== null) {
        for (i = 0; i < cleanups.length; ++i) cleanups[i](final)
        observer.cleanups = null
    }
    observer.ctx = null
    if (owned !== null) {
        for (i = 0; i < owned.length; ++i) dispose(owned[i])
        observer.owned = null
    }
    if (src1 !== null) {
        src1.disconnect(observer.src1Slot)
        observer.src1 = null
    }
    if (srcs !== null) {
        for (i = 0, l = srcs.length; i < l; ++i) {
            srcs[i].disconnect(observer.srcSlots![i])
        }
        observer.srcs = observer.srcSlots = null
    }
}

function resetObserver<T>(observer: ObserverNode<T>, flags: State): void {
    observer.state &= ~flags
    observer.depSlot = 0
    observer.depsCount = 0
}

function dispose<T>(observer: ObserverNode<T>): void {
    observer.fn = null
    observer.sub = null
    observer.deps = null
    disconnect(observer, true)
    resetObserver(observer, State.All)
}

export function handleError<E>(e: E) {
    const fns = lookup<ErrorHandler[]>($$Owner!, ERROR)
    if (!fns) throw e
    runAll(fns, e)
}

export function suspend<T>(promise: Promise<T>): T {
    const suspenseContext = lookup<SuspenseContext>($$Owner, SUSPENSE);
    if (!suspenseContext) {
        throw new Error("Suspend called outside a Suspense boundary");
    }

    suspenseContext.increment()

    // When promise resolves, decrement count
    promise.then(value => {
        suspenseContext.decrement()
        return value;
    }).catch(error => {
        suspenseContext.setError(error instanceof Error ? error : new Error(String(error)))
    });

    // Throw the suspension signal
    throw new SuspensionSignal()
}

export function createSuspense<T, F>(
    fn: () => T,
    fallback: (error?: Error | Observable<Error | null>) => T,
    errorAsObservable: boolean = false
): () => T {
    return root(() => {
        const suspenseContext = new SuspenseContext();

        // Create the fallback observer
        const fallbackObserver = computed(() => {
            const error = errorAsObservable ? suspenseContext.error : suspenseContext.getError();
            return fallback(error || undefined);
        });

        // Create the main content observer
        const contentObserver = memo(() => {
            suspenseContext.registerContent($$Observer); // Have to be re-registered on re-computing
            try {
                const result = fn();
                // If we get here, we didn't suspend - switch back to content
                if (suspenseContext.isSuspended()) {
                    suspenseContext.isSuspended(false)
                }
                return result;
            } catch (e) {
                if (e instanceof SuspensionSignal) {
                    // Return the fallback content
                    return fallbackObserver()
                }
            }

            return fallbackObserver()
        });

        // Store the suspense context in the owner
        if ($$Owner) {
            if ($$Owner.ctx) $$Owner.ctx[SUSPENSE] = suspenseContext;
            else $$Owner.ctx = { [SUSPENSE]: suspenseContext };
        }

        // Return a function that selects between content and fallback
        return contentObserver;
    })
}

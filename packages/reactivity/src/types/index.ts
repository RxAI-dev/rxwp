/* ******************************************************************* *
 * Reactive Node Creators                                              *
 * ******************************************************************* *
 * Functions used to create reactive nodes. They aren't returning      *
 * created nodes, but controller functions or nothing (effects),       *
 * so I think that Creators is better naming convention than Factories *
 * ******************************************************************* */

import {ObserverType, State} from '../enums'

/**
 * Observable Creator
 *
 * Create Observable node instance and return its controller
 */
export interface ObservableCreator {
    <T>(): Observable<T | undefined>

    <T>(value: T): Observable<T>

    <T>(value: T, equals: Equals<T>): Observable<T>

    <T>(value: T, equals?: Equals<T>): Observable<T>
}

/**
 * Observable Signal Creator
 *
 * Create Observable node instance and return its signal
 * controller - the getter/setter tuple
 */
export interface SignalCreator {
    <T>(): ObservableSignal<T | undefined>

    <T>(value: T): ObservableSignal<T>

    <T>(value: T, equals: Equals<T>): ObservableSignal<T>

    <T>(value: T, equals?: Equals<T>): ObservableSignal<T>
}

export interface ObservableSignal<T> extends Array<Readable<T> | Writable<T>> {
    0: Readable<T>
    1: Writable<T>
    length: 2
}

/**
 * Observer Creator
 *
 * Create Observer
 */
export interface ObserverCreator {
    (fn: () => void): void

    <T>(fn: () => T): void

    <T>(fn: (v?: T) => T): void

    <T>(fn: (v: T) => T, seed: T): void

    <T>(fn: (v?: T) => void, seed: T): void

    <T>(fn: (v?: T) => T, seed?: T): void
}

/**
 * Memo Creator
 *
 * Create Memo (Observable) Observer
 */
export interface MemoCreator {
    <T>(fn: () => T): Readable<T>

    <T>(fn: (v?: T) => T): Readable<T>

    <T>(fn: (v: T) => T, seed: T): Readable<T>

    <T>(fn: (v: T) => T, seed: T, equals: Equals<T>): Readable<T>

    <T>(fn: (v?: T) => T, seed?: T, equals?: Equals<T>): Readable<T>
}

export type Equals<T> = false | ((previousValue: T, nextValue: T) => boolean)

/* ******************************* *
 * Observable Controller functions *
 * ******************************* */

/**
 * Observable Controller
 *
 * Simple & small function, used to interact with its wrapped Observable instance.
 * Controller function has 2 different behaviors, depending on passed (or not passed) argument:
 * - without argument - Read current value and connect running Observer
 * - with argument - Update value and notify Observers about update,
 * or add update to Scheduler queue, if used in batch
 * Created with Observable instance, by Observable Creator.
 */
export interface Observable<T> extends Readable<T>, Writable<T> {
    __src__: WritableNode<T>
}

/**
 * Read<T> Observable value and observe changes with running Observer
 */
export interface Readable<T> {
    /**
     * Read Observable Value
     *
     * Connect Observable to currently running Observer (if running in tracked execution context,
     * like effect(), memo() or JSX) and/or read (extract/unwrap) its actual value. Then, when Observer
     * is connected and Observable value is changing, it's re-executing Observer computation function.
     * Observables could be connected with many Observers (and Observers could be also connected with
     * many Observables) and are multicasted.
     * All the connect/disconnect/manage connections logic is handled implicitly (automatically)
     * by library - all Observables, Observers and other objects, are hidden inside the closures,
     * created by their factory functions. So, from the library user (developer) perspective,
     * Read Observable is a very simple function for read operations, that returns normal plain
     * value, and it just needs to be read inside the tracked reactive context, like memo() or effect(),
     * to be reactive data source for that context.
     */
    (): T
}

/**
 * Schedule Observable update, when used in batch mode or run update immediately otherwise
 */
export interface Writable<T> {
    /**
     * Map the current value into the next value, then notify & re-execute connected Observer computations
     * @param mapValue
     */
    (mapValue: ValueMapper<T>): T

    /**
     * Set next Observable value, then notify & re-execute connected Observer computations
     * @param value - new value to set
     */
    (value: T): T

    (valueOrMapper: T | ValueMapper<T>): T
}

export interface ValueMapper<T> {
    (value: T): T
}

/* ***************************************** *
 * Reactive Graph Nodes and their base types *
 * ***************************************** */

/**
 * State is a base object interface, that wraps Observable or Observer value
 */
export interface ValueWrapper<T> {
    value?: T | undefined
}

export interface ConnectableNode {
    sub: Subscription | null
}

export interface Subscription {
    obs1: ObserverNode<any> | null
    obs1Slot: number
    obs: ObserverNode<any>[] | null
    obsSlots: number[] | null

    connect(): void

    disconnect(slot: number): void
}

/**
 * Observable
 */
export interface ObservableNode<T> extends ValueWrapper<T>, ConnectableNode {
}

/**
 * WritableObservable<T> - Observable Data Source
 *
 * Source is an Observable function connected object instance - it means that it is created
 * with Observable, by its factory. But unlike Observable function, it's not returned
 * from factory, but is kept inside closure (it's also referenced in connected
 * Observers dependencies), invisible to the library user
 *
 * It has all the fields that Observable need to work:
 * - value - from State interface
 * - observers - from ReadableObservable interface
 * - pending - used to set next state value, when scheduling update (also without batch() - in
 * that scenario, pending value is also set and update is added to Scheduler queue, but then
 * change is committed immediately)
 */
export interface WritableNode<T> extends ObservableNode<T> {
    pending: T | NotPending
    lock: () => void;
    unlock: () => void;
}

/**
 * Owner
 * It's the part of Observer interface. Owner storing information
 * about its parent and children relations, and data specific to
 * reactive scope, like context and cleanups
 */
interface Owner {
    app: (Record<string | symbol, any> & { owner: ObserverNode<any> }) | null
    owner: ObserverNode<any> | null
    owned: ObserverNode<any>[] | null
    cleanups: CleanupFn[] | null
    ctx: OwnerContext | null
}

/**
 *
 */
interface Observations {
    src1: Subscription | null
    src1Slot: number
    srcs: Subscription[] | null
    srcSlots: number[] | null
}

interface ChangedDeps<T> {
    eq: Equals<T> | null
    deps: (ObserverNode<any> | null)[] | null
    depSlot: number
    depsCount: number
}

/**
 * Owner - Base Reactive Execution Context Node
 *
 * Minimal interface required for untracked reactive context node - used mainly for roots
 */
export interface ObserverNode<T>
    extends Owner,
        Observations,
        ChangedDeps<T>,
        ValueWrapper<T>,
        ObservableNode<T> {
    fn: (() => void) | ((value: T) => T) | ((value?: T) => T) | null
    age: number
    state: State
    type: ObserverType
}

export type InactiveObserver = NullableProps<ObserverNode<null>, 'fn'>
export type LiveObserver<T> = NonNullableProps<ObserverNode<T>, 'fn'>

export type NullableProps<T, K extends keyof T> = {
    [P in keyof T]: P extends K ? null : T[P]
}

export type NonNullableProps<T, K extends keyof T> = {
    [P in keyof T]: P extends K ? NonNullable<T[P]> : T[P]
}

export interface CleanupFn {
    (final: boolean): void
}

export interface ErrorHandler {
    (): void

    <E extends Error>(error: E): void

    (error: Error): void

    (error?: any): void
}

export type OwnerContext = Record<symbol, unknown>

export type NotPending = {}

export type QueueItem<T> = WritableNode<T> | ObserverNode<T> | (() => void)

export interface Queue<T extends QueueItem<any>> {
    items: T[]
    size: number
}

export interface PoolItem<T, U> {
    mapped: U
    disposer: () => void
    index?: Observable<number>
    source?: Observable<T>
}

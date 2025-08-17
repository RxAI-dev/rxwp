import {
    batch,
    cleanup,
    signal,
    observer,
    effect,
    renderEffect,
    getOwner,
    SuspenseContext,
    SUSPENSE,
    SuspensionSignal,
    handleError
} from './observable'
import {Observable, Readable} from "./types";
import {lookup} from "./utils";

class TimelineScheduler {
    private tasks = new Map<number, Array<() => void>>();
    public nextCheck: number | null = null;
    private timeoutId: number | null = null;

    schedule(delay: number, callback: () => void): () => void {
        const time = performance.now() + delay;
        if (!this.tasks.has(time)) {
            this.tasks.set(time, []);
        }
        this.tasks.get(time)!.push(callback);

        this.rescheduleCheck();

        return () => {
            const callbacks = this.tasks.get(time);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) callbacks.splice(index, 1);
                if (callbacks.length === 0) this.tasks.delete(time);
            }

            if (this.nextCheck === time) {
                this.rescheduleCheck();
            }
        };
    }

    rescheduleCheck() {
        if (this.tasks.size === 0) {
            if (this.timeoutId !== null) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            this.nextCheck = null;
            return;
        }

        const earliestTime = Math.min(...this.tasks.keys());

        if (this.nextCheck === earliestTime) return;

        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }

        const now = performance.now();
        const waitTime = Math.max(0, earliestTime - now);

        this.timeoutId = window.setTimeout(() => {
            this.executeTasks(earliestTime);
            this.rescheduleCheck();
        }, waitTime);

        this.nextCheck = earliestTime;
    }

    executeTasks(time: number) {
        const callbacks = this.tasks.get(time);
        if (callbacks) {
            this.tasks.delete(time);
            batch(() => {
                for (const callback of callbacks) {
                    callback();
                }
            });
        }
    }
}

export const timeline = new TimelineScheduler();

type AsynxId = [tick: number, index: number]

type AsapAction = () => void
type Dispose = () => void

class AsapQueue {
    readonly now: () => number
    readonly items: AsapAction[]
    size: number
    private count: number

    constructor(now: () => number) {
        this.now = now
        this.items = []
        this.size = 0
        this.count = 0
    }

    add(item: AsapAction): AsynxId {
        this.count++
        this.items[this.size] = item
        return [this.now(), this.size++]
    }

    remove([tick, index]: AsynxId): number {
        if (tick === this.now()) {
            this.items[index] = null!
            return --this.count === 0 ? (this.size = 0) : this.count
        } else {
            return -1
        }
    }

    run(checkTimeline: boolean = false) {
        if (this.count === 0) return
        const items = this.items.slice(),
            size = this.size
        this.size = this.count = 0
        for (let i = 0; i < size; ++i) items[i]()

        if (checkTimeline && timeline.nextCheck) {
            // check if there are some items scheduled for now
            if (timeline.nextCheck - performance.now() <= 0) {
                timeline.executeTasks(timeline.nextCheck)
                timeline.rescheduleCheck()
            }
        }
    }
}


// Queues
let $$Running = false,
    $$Scheduled = false,
    $$ScheduledFrame = false,
    $$RunningFrame = false,
    $$Tick = 0,
    $$Frame = 0

const Resolved = Promise.resolve()

const $$Queue = new AsapQueue(() => $$Tick)
const $$Frames = new AsapQueue(() => $$Frame)

const runMicroQueue = () => {
    $$Scheduled = false
    $$Running = true
    batch(() => $$Queue.run(true))
    $$Running = false
}

const scheduleTick = () => {
    if (!$$Scheduled) {
        $$Scheduled = true
        $$Tick++
        Resolved.then(() => {
            if (!$$Scheduled) return
            runMicroQueue()
        })
    }
}

const scheduleFrame = () => {
    if (!$$ScheduledFrame) {
        $$ScheduledFrame = true
        $$Frame = window.requestAnimationFrame(() => {
            $$ScheduledFrame = false
            $$RunningFrame = true
            batch(() => $$Frames.run())
            $$RunningFrame = false
        })
    }
}

export const tick = (action: AsapAction): Dispose => {
    scheduleTick()
    const id = $$Queue.add(action)
    return () => $$Queue.remove(id)
}

export const frame = (action: AsapAction): Dispose => {
    scheduleFrame()
    const id = $$Frames.add(action)
    return () => {
        if ($$Frames.remove(id) === 0) window.cancelAnimationFrame($$Frame)
    }
}

export const delayed = (delay: number, action: AsapAction) => {
    return timeline.schedule(delay, action)
}

export const interval = (timeout: number, action: AsapAction) => {
    let dispose: () => void
    const replayedAction = () => {
        action()
        dispose = timeline.schedule(timeout, replayedAction)
    }

    dispose = timeline.schedule(timeout, replayedAction)

    return () => dispose()
}

type AsynxSource = 'asap' | 'frame' | number | (() => any);
type AsynxAction<T = void, R = void> = (value?: T) => R;
type AsynxLock = Observable<any>[]
type AsynxActionTuple<T = void, R = void> = [AsynxAction<T, R>, AsynxLock]
type AsynxActionOrTuple<T = void, R = void> = AsynxAction<T, R> | AsynxActionTuple<T, R>

function getInternalSource(obs: Observable<any>) {
    return obs.__src__;
}

function scheduleAsynx<T, R>(
    source: AsynxSource,
    actions: AsynxActionOrTuple<T, any>[],
    initialValue?: T
): Dispose {
    const disposes = [] as Dispose[]

    const lockDeps = (lock: AsynxLock) => {
        // Lock observables
        lock.forEach(obs => {
            const source = getInternalSource(obs);
            source.lock();
        });

        // Cleanup function
        return () => {
            lock.forEach(obs => {
                const source = getInternalSource(obs);
                source.unlock();
            });
        };
    }

    // Execute the next action in the pipeline
    const executeNext = (action: AsynxAction<T, R>, value: T, lockCleanup: () => void) => {
        try {
            const result = action(value);
            lockCleanup();
            const nextSource = () => result;
            const newDispose = scheduleAsynx<T, any>(nextSource, actions);
            disposes.push(newDispose);
        } catch (error) {
            console.error('AsynX pipeline error:', error);
            handleError(error)
            lockCleanup();
        }
    };

    let action = actions.shift()
    if (!action) return () => {}

    let cleanup: () => void;
    if (Array.isArray(action)) {
        cleanup = lockDeps(action[1])
        action = action[0]
    } else {
        cleanup = () => {}
    }


    // Schedule based on source type
    if (source === 'asap') {
        const dispose = tick(() => {
            try {
                executeNext(action, initialValue as T, cleanup);
            } catch (error) {
                console.error('AsynX pipeline error:', error);
                handleError(error);
                cleanup();
            }
        });

        disposes.push(dispose);
    }
    else if (source === 'frame') {
        const dispose = frame(() => {
            try {
                executeNext(action, initialValue as T, cleanup);
            } catch (error) {
                console.error('AsynX pipeline error:', error);
                handleError(error);
                cleanup();
            }
        });
        disposes.push(dispose);
    }
    else if (typeof source === 'number') {
        const dispose = delayed(source, () => {
            try {
                executeNext(action, initialValue as T, cleanup);
            } catch (error) {
                console.error('AsynX pipeline error:', error);
                handleError(error);
                cleanup();
            }
        });
        disposes.push(dispose);
    }
    else if (typeof source === 'function') {
        const srcResult = source();
        if (srcResult instanceof Promise) {
            srcResult.then(result => {
                if ($$Scheduled) {
                    $$Queue.add(() => {
                        try {
                            executeNext(action, result as T, cleanup);
                        } catch (error) {
                            console.error('AsynX pipeline error:', error);
                            handleError(error);
                            cleanup();
                        }
                    })
                    runMicroQueue()
                } else {
                    try {
                        executeNext(action, result as T, cleanup);
                    } catch (error) {
                        console.error('AsynX pipeline error:', error);
                        handleError(error);
                        cleanup();
                    }
                }
            })
        } else {
            const dispose = tick(() => {
                try {
                    executeNext(action, srcResult as T, cleanup);
                } catch (error) {
                    console.error('AsynX pipeline error:', error);
                    handleError(error);
                    cleanup();
                }
            });
            disposes.push(dispose);
        }
    } else {
        throw new Error('Invalid asynx source');
    }

    return () => {
        cleanup();
        disposes.forEach((dispose) => dispose());
    }

}

function createAsynxLazy<T = void, R = void>() {
    return (
        source: AsynxSource,
        actions: AsynxActionOrTuple<T, any>[],
        initialValue?: T
    ): Dispose => {

        return scheduleAsynx(source, actions, initialValue);
    };
}

export function asynx<T = void, R = void>(
    source?: AsynxSource | AsynxActionOrTuple<T, any>[],
    actions?: AsynxActionOrTuple<T, any>[],
    initialValue?: T
): Dispose | ((source: AsynxSource, actions: AsynxActionOrTuple<T, any>[], initialValue?: T) => Dispose) {
    if (arguments.length === 0) {
        return createAsynxLazy();
    }

    if (typeof source === 'function' && actions === undefined) {
        actions = [source];
        source = 'asap';
    }

    return scheduleAsynx(source as AsynxSource, actions!, initialValue);
}

export const WAITING = {
    __waiting__: true
} as const;
type Waiting = typeof WAITING;

const awaitAsynx = <T = void, R = void>(
    source: AsynxSource | AsynxActionOrTuple<T, any>[],
    actions?: AsynxActionOrTuple<T, any>[],
    initialValue?: T
): Readable<R | Waiting> => {
    if (typeof source === 'function' && actions === undefined) {
        actions = [source];
        source = 'asap';
    } else if (actions === undefined) throw Error('Actions should be defined!')

    const [finalResult, setFinalResult] = signal<R | Waiting>(WAITING)

    actions.push(value => setFinalResult(value as R))

    const dispose = scheduleAsynx(source as AsynxSource, actions, initialValue);

    cleanup(dispose);
    return finalResult;
}

export const asynxObserver = <T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E) => {
    return observer((prev?: E) => {
        const awaited = on();
        if (awaited === WAITING) return prev;
        else return fn(awaited as T, prev);
    }, initialValue)
}

export const asynxEffect = <T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E) => {
    return effect((prev?: E) => {
        const awaited = on();
        if (awaited === WAITING) return prev;
        else return fn(awaited as T, prev);
    }, initialValue)
}

export const asynxRenderEffect = <T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E) => {
    return renderEffect((prev?: E) => {
        const awaited = on();
        if (awaited === WAITING) return prev;
        else return fn(awaited as T, prev);
    }, initialValue)
}

export const suspendedAsynx = <T>(
    source: AsynxSource | AsynxActionOrTuple<T, any>[],
    actions?: AsynxActionOrTuple<T, any>[],
    initialValue?: T
) => {
    const suspenseContext = lookup<SuspenseContext>(getOwner(), SUSPENSE);
    if (!suspenseContext) {
        throw new Error("Suspended Asynx called outside a Suspense boundary");
    }

    if (typeof source === 'function' && actions === undefined) {
        actions = [source];
        source = 'asap';
    } else if (actions === undefined) throw Error('Actions should be defined!')

    suspenseContext.increment()
    actions.push(() => suspenseContext.decrement());

    const dispose = scheduleAsynx(source as AsynxSource, actions, initialValue);
    cleanup(dispose);

    throw new SuspensionSignal();
}


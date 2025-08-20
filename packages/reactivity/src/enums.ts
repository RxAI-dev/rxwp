// State
// 1 - Stale
// 2 - Pending
// 4 - Pending Disposal
// 8 - Running
// 16 - Disposed
// Functions
export const enum State {
    Actual = 0,
    Stale = 1 << 0,
    Pending = 1 << 1,
    PendingDisposal = 1 << 2,
    Running = 1 << 3,
    Disposed = 1 << 4,
    // Check flags
    Upstreamable = Pending | PendingDisposal,
    Liftable = Stale | Pending | PendingDisposal,
    All = 31,
    PendingStates = 14
}

// export const enum EffectType {
//   NotEffect = 0,
//   RenderEffect = 1,
//   Effect = 2
// }
export const enum ObserverType {
    Memo = 1 << 0,
    Observer = 1 << 1,
    UpdatesQueue = Memo | Observer,
    RenderEffect = 1 << 2,
    AfterEffect = 1 << 3,
    EffectsQueue = RenderEffect | AfterEffect,
    Computed = 1 << 4,
    Root = 1 << 5,
    RemountableRoot = 1 << 6,
}

import type { ObserverNode, CleanupFn, OwnerContext } from '@rxwp/reactivity'
import { renderEffect, getOwner, untrack, root } from "@rxwp/reactivity";
import { createComponent, mergeProps } from "../component";
import { sharedConfig } from "../hydration";
import { memo } from "../dom-expressions-memo";


declare module 'rxcore' {
    export interface Owner {
        owner: ObserverNode<any> | null
        owned: ObserverNode<any>[] | null
        cleanups: CleanupFn[] | null
        ctx: OwnerContext | null
    }
    export declare const createRoot: typeof root
    export declare const createEffect = typeof renderEffect
    export declare const createMemo: typeof memo
    export declare const getMemo: typeof getOwner
    export declare const createComponent: typeof createComponent
    export declare const sharedConfig: typeof sharedConfig
    export declare const untrack: typeof untrack
    export declare const mergeProps: typeof mergeProps
}

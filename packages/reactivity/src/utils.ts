import { ObserverNode, OwnerContext } from './types'

export function isFunction<F extends Function = Function>(v: any): v is F {
  return typeof v === 'function'
}

export function runAll<T>(fns: ((prop?: T) => any)[], arg?: T): void {
  for (let i = 0; i < fns.length; i++) fns[i](arg)
}
export function callAll(fns: (() => any)[]) {
  return function all() {
    for (let i = 0; i < fns.length; i++) fns[i]()
  }
}
export function lookup<C>(owner: ObserverNode<any> | null, key: symbol): C | undefined {
  return (owner && ((owner.ctx && owner.ctx[key]) || (owner.owner && lookup(owner.owner, key)))) as
    | C
    | undefined
}

export function traverseUp<C>(
  owner: ObserverNode<any> | null,
  keyOrFilterOrMap:
    | symbol
    | ((ctx: OwnerContext) => boolean | null)
    | (<R = OwnerContext[keyof OwnerContext]>(ctx: OwnerContext) => R),
  callback?: (value: OwnerContext | C) => any,
  results?: (C | undefined)[]
): (C | undefined)[] {
  !results && (results = [])
  if (owner && owner.ctx) {
    const curr = getCurrentLevelCtx(owner.ctx, keyOrFilterOrMap, callback)
    if (curr === null) return results
    else if (curr !== false) results.push(curr as C | undefined)
  }
  if (owner?.owner) {
    results = traverseUp(owner.owner, keyOrFilterOrMap, callback, results)
  }
  return results
}

function getCurrentLevelCtx<C>(
  ctx: OwnerContext,
  keyOrFilterOrMap:
    | symbol
    | ((ctx: OwnerContext) => boolean | null)
    | (<R = OwnerContext[keyof OwnerContext]>(ctx: OwnerContext) => R),
  callback?: (value: OwnerContext | C) => any
): C | undefined | null | false | OwnerContext {
  if (typeof keyOrFilterOrMap === 'function') {
    const result = keyOrFilterOrMap(ctx)
    if (result === null) return null
    else if (result === false) return false
    else if (result === true) {
      callback?.(ctx)
      return ctx
    } else {
      callback?.(result as C)
      return result as C
    }
  } else {
    const v = ctx[keyOrFilterOrMap] as C | undefined
    v && callback?.(v)
    return v
  }
}


import { memo as $memo } from '../reactivity'

export function memo<T>(fn: (v?: T) => T, equals: boolean) {
    if (typeof fn !== 'function') return fn
    return $memo(fn, undefined, !equals ? false : undefined)
}

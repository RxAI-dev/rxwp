import type { Readable, Observable, PoolItem } from '@x-rx/core'
import { cleanup, root, untrack, observable, runAll } from '@x-rx/core'

import { DEFAULT_POOL_LIMIT, FALLBACK } from './constants'

export interface IndexArrayOptions<T, R> {
  fallback?: Readable<any>
  pool?: true | Map<number, PoolItem<T, R>>
  poolLimit?: number
}

/**
 * Index Array
 *
 * Reactively maps arrays by index instead of value - memoize array item values
 * for the same objects on the same index - so index in map callback is always
 * the same plain number and item value is Observable - opposite to mapArray().
 * When value on some index changed, it's emitted by its Observable. This
 * approach only adding/removing items to/from the end of array.
 *
 * - If optional fallback is provided, it will be returned as one and only element
 * of mapped array, when new array is empty
 * - Optionally can use Pooling - when Pool Mode is activated, items are not
 *  disconnected (disposed and discarded) when removed from array, but are
 *  saved in pool instead - items are saved by index. Then instead of creating
 *  new items on that indexes, they will be recycled from pool.
 * - Pools can increase Indexed Arrays performance, in cases when lot items are
 *  removed and added. But they will also increase memory usage - it's less
 *  dangerous for Indexed Arrays than Keyed Arrays, as elements are not saved
 *  by unique values, but by indexes - but in some cases may cause performance
 *  issues.
 * - Additionally, in obserVx pools can be explicitly managed, just by passing
 *  compatible object as `pool` prop - for indexArray it's object compatible with
 *  `Map<number, PoolItem<T, R>>`. Then, when in example it will have too many items,
 *  it can be explicitly disposed using its reference.
 *
 * @param list readable observable of array to map
 * @param mapFn function to apply on every added item
 * @param options optional options - fallback and pool
 * @returns {Readable<R[]>} read-only observable array
 */
export function indexArray<T, R>(
  list: Readable<readonly T[] | undefined | null | false>,
  mapFn: (v: Readable<T>, i: number) => R,
  options: IndexArrayOptions<T, R> = {}
): Readable<R[]> {
  let items: (T | typeof FALLBACK)[] = [],
    mapped: R[] = [],
    disposers: (() => void)[] = [],
    sources: Observable<T>[] = [],
    len = 0,
    i: number,
    poolItem: PoolItem<T, R> | undefined
  const pool: Map<number, PoolItem<T, R>> | null =
      options.pool === true ? new Map() : options.pool || null,
    poolLimit = pool !== null && (options.poolLimit || DEFAULT_POOL_LIMIT)

  cleanup(() => {
    runAll(disposers)
    if (pool !== null) {
      for (const item of pool.values()) item.disposer()
      pool.clear()
    }
  })
  return () => {
    const newItems = list() || []

    return untrack(() => {
      if (newItems.length === 0) {
        // Remove fast path
        if (len !== 0) {
          if (pool !== null) {
            for (i = 0; i < len; ++i) saveInPool()
          } else runAll(disposers)
          disposers = []
          items = []
          mapped = []
          len = 0
          sources = []
        }
        // Add optional fallback
        if (options.fallback) {
          items = [FALLBACK]
          mapped[0] = root(disposer => {
            disposers[0] = disposer
            return options.fallback!()
          })
          len = 1
        }
        return mapped
      }
      // Remove optional fallback if set
      if (items[0] === FALLBACK) {
        disposers[0]()
        disposers = []
        items = []
        mapped = []
        len = 0
      }

      // Iterate new items and check if item on current index in old items is the
      // same as new item
      for (i = 0; i < newItems.length; i++) {
        if (i < items.length && items[i] !== newItems[i]) {
          // If not, update its observable
          sources[i](() => newItems[i])
        } else if (i >= items.length) {
          // If new items are longer than old, add new items or recycle from pool
          if (pool !== null && (poolItem = pool.get(i))) recycleFromPool()
          else mapped[i] = root(mapper)
        }
      }
      // If old items are longer than new, remove excessive items or save them in pool
      for (; i < items.length; i++) {
        if (pool !== null) saveInPool()
        else disposers[i]()
      }
      // Save new memoized items for next update
      len = sources.length = disposers.length = newItems.length
      items = newItems.slice(0)
      return (mapped = mapped.slice(0, len))
    })
    function mapper(disposer: () => void) {
      disposers[i] = disposer
      const s = (sources[i] = observable(newItems[i]))
      return mapFn(() => s(), i)
    }
    function recycleFromPool() {
      mapped[i] = poolItem!.mapped
      disposers[i] = poolItem!.disposer
      sources[i] = poolItem!.source!
      pool!.delete(i)
    }
    function saveInPool() {
      if (poolLimit <= pool!.size) pool!.delete(newItems.length - 1 + pool!.size)
      pool!.set(i, {
        mapped: mapped[i],
        disposer: disposers[i],
        source: sources[i]
      })
    }
  }
}

import { Observable, PoolItem, Readable } from '@x-rx/core'
import { cleanup, observable, root, untrack, runAll } from '@x-rx/core'

import { FALLBACK, META } from './constants'

export interface MapArrayOptions<T, R> {
  fallback?: Readable<any>
  pool?: true | Map<T, PoolItem<T, R>>
}

export interface PreAnalyzeMeta {
  inserts: number
  removes: number
  replaceAll?: boolean
  noInserts?: boolean
}

export type ArrayWithMeta<T> = Array<T> & {
  [K in typeof META]?: K extends typeof META ? PreAnalyzeMeta : never
}

/**
 * Map Array (Keyed Array)
 *
 * Reactively maps arrays by its value - memoize array item unique values and
 * change their order - when new item exists in old array, it will be moved to
 * new index or skipped if its index is the same as old. Item value passed to
 * map callback function is stable and always the same and index is observable.
 *
 * - If optional fallback is provided, it will be returned as one and only element
 * of mapped array, when new array is empty
 *
 * - Optionally can use Pooling - when Pool Mode is activated, items are not
 *  disconnected (disposed and discarded) when removed from array, but are
 *  saved in pool instead - mapped items (with disposers and index observables)
 *  are saved in pool by its value. Then, when the same item is added again,
 *  it will be recycled from pool, instead of creating and connecting new one.
 * - Pooling is advanced concept, that can increase performance in some cases
 *  and enable additional features like preserving state on removed nodes, but
 *  it will increase memory usage and can also reduce performance, especially
 *  for Keyed Arrays, so it's recommended to manually manage and cleanup pool
 * - pools can be explicitly managed, just by passing compatible object as `pool`
 *  option - for mapArray it has to be Map collection (`Map<T, PoolItem<T, R>>`).
 *
 * @param list readable observable of array to map
 * @param mapFn function to apply on every added item
 * @param options optional options - fallback and pool
 * @returns {Readable<R[]>} read-only observable array
 */
export function mapArray<T, R>(
  list: Readable<readonly T[] | undefined | null | false>,
  mapFn: (v: T, i: Readable<number>) => R,
  options: MapArrayOptions<T, R> = {}
): Readable<ArrayWithMeta<R>> {
  let items: (T | typeof FALLBACK)[] = [],
    mapped: ArrayWithMeta<R> = [],
    disposers: (() => void)[] = [],
    len = 0,
    indexes: Observable<number>[] | null = mapFn.length > 1 ? [] : null,
    meta: PreAnalyzeMeta
  const pool: Map<T, PoolItem<T, R>> | undefined = options.pool === true ? new Map() : options.pool
  cleanup(() => {
    runAll(disposers)
    if (pool) {
      for (const item of pool.values()) item.disposer()
    }
  })

  return () => {
    const newItems = list() || []
    let i: number, j: number

    return untrack(() => {
      const newLen = newItems.length
      let newIndices: Map<T | typeof FALLBACK, number>,
        newIndicesNext: number[],
        temp: R[],
        tempDisposers: (() => void)[],
        tempIndexes: Observable<number>[],
        start: number,
        newStart: number,
        end: number,
        newEnd: number,
        item: T | typeof FALLBACK,
        poolItem: PoolItem<T, R> | undefined
      meta = { inserts: 0, removes: 0 }
      // A) Remove all - fast path for empty arrays
      if (newLen === 0) {
        if (len !== 0) {
          if (pool) {
            for (i = 0; i < len; ++i) saveInPool()
          } else runAll(disposers)
          disposers = []
          items = []
          mapped = []
          len = 0
          indexes && (indexes = [])
        }
        if (options.fallback) {
          items = [FALLBACK]
          mapped[0] = root(disposer => {
            disposers[0] = disposer
            return options.fallback!()
          })
          len = 1
        }
      } else if (len === 0) {
        // B) Append all - fast path for new create
        mapped = new Array(newLen)
        for (j = 0; j < newLen; ++j) {
          items[j] = newItems[j]
          if (pool && (poolItem = pool.get(items[j] as T))) {
            mapped[j] = recycleFromPool(poolItem)
          } else mapped[j] = root(mapper)
        }
        len = newLen
      } else {
        // C) Keyed memo-map algorithm
        temp = new Array(newLen)
        tempDisposers = new Array(newLen)
        indexes && (tempIndexes = new Array(newLen))

        // 1. Initial optimization - prefix/suffix + swap
        start = newStart = 0
        end = len - 1
        newEnd = newLen - 1
        while (start <= end && newStart <= newEnd) {
          if (items[start] === newItems[newStart]) {
            // 1.1 Prefix optimization - just skip same items
            start++
            newStart++
          } else if (items[end] === newItems[newEnd]) {
            // 1.2 Suffix optimization - add items from the end
            // of current mapped list to the end of temp list
            temp[newEnd] = mapped[end]
            tempDisposers[newEnd] = disposers[end]
            indexes && (tempIndexes![newEnd] = indexes[end])
            end--
            newEnd--
          } else if (items[end] === newItems[newStart]) {
            // 1.3 Swap - Left move (from the end of old array to the start of new)
            mapped[newStart] = mapped[end]
            disposers[newStart] = disposers[end]
            indexes && (indexes![newStart] = indexes[end])
            end--
            newStart++
          } else if (items[start] === newItems[newEnd]) {
            // 1.4 Swap - Right move (from the start of old array to the end of new)
            temp[newEnd] = mapped[start]
            tempDisposers[newEnd] = disposers[start]
            indexes && (tempIndexes![newEnd] = indexes[start])
            start++
            newEnd--
          } else break
        }
        // 2. After init optimization
        if (start > end) {
          // 2.1 New items fast path - if there are no old items left,
          // fast path for create new (and insert items from suffix opt)
          while (newStart <= newEnd) {
            j = newStart++
            if (j in temp) {
              mapped[j] = temp[j]
              disposers[j] = tempDisposers[j]
              if (indexes) {
                indexes[j] = tempIndexes![j]
                indexes[j](j)
              }
            } else {
              if (pool && (poolItem = pool.get(items[j] as T))) {
                mapped[j] = recycleFromPool(poolItem)
              } else mapped[j] = root(mapper)
              meta.inserts++
            }
          }
        } else if (newStart > newEnd) {
          // 2.2 Remove old items fast path - if there are no new items left,
          // dispose remaining old items
          while (start <= end) {
            i = start++
            if (pool) saveInPool()
            else disposers[i]()
            meta.removes++
          }
        } else {
          // 3. Switch to new items indexing and copying

          // 3.1 prepare a map of all indices in newItems, scanning backwards,
          // so we encounter them in natural order
          newIndices = new Map<T, number>()
          newIndicesNext = new Array(newEnd + 1)
          for (j = newEnd; j >= newStart; --j) {
            item = newItems[j]
            i = newIndices.get(item)!
            newIndicesNext[j] = i === undefined ? -1 : i
            newIndices.set(item, j)
          }
          // 3.2 step through all old items and see if they can be found in the new set;
          // if so, save them in a temp array and mark them moved; if not, exit them
          for (i = start; i <= end; ++i) {
            item = items[i]
            j = newIndices.get(item)!
            if (j !== undefined && j !== -1) {
              temp[j] = mapped[i]
              tempDisposers[j] = disposers[i]
              indexes && (tempIndexes![j] = indexes[i])
              j = newIndicesNext[j]
              newIndices.set(item, j)
            } else {
              if (pool) saveInPool()
              else disposers[i]()
              meta.removes++
            }
          }
        }

        // 4. set all the new values, pulling from the temp
        // array if copied, otherwise entering the new value
        for (j = newStart; j < newLen; ++j) {
          if (j in temp) {
            mapped[j] = temp[j]
            disposers[j] = tempDisposers[j]
            if (indexes) {
              indexes[j] = tempIndexes![j]
              indexes[j](j)
            }
          } else {
            if (pool && (poolItem = pool.get(newItems[j] as T))) {
              mapped[j] = recycleFromPool(poolItem)
            } else mapped[j] = root(mapper)
            meta.inserts++
          }
        }
        meta.inserts === 0 && (meta.noInserts = true)
        meta.removes === len && (meta.replaceAll = true)
        // 4. in case the new set is shorter than the old, set the length of the mapped array
        mapped = mapped.slice(0, (len = newLen))
        // 5. save a copy of the mapped items for the next update
        items = newItems.slice(0)
        mapped[META] = meta
      }
      return mapped
    })

    function mapper(disposer: () => void): R {
      disposers[j] = disposer
      if (indexes) {
        const s = (indexes[j] = observable(j))
        return mapFn(newItems[j], () => s())
      }
      return (mapFn as any)(newItems[j])
    }

    function recycleFromPool(poolItem: PoolItem<T, R>): R {
      disposers[j] = poolItem.disposer
      if (indexes) {
        indexes[j] = poolItem.index!
        indexes[j](j)
      }
      pool!.delete(items[j] as T)
      return poolItem.mapped
    }

    function saveInPool() {
      const poolItem: PoolItem<T, R> = {
        mapped: mapped[i],
        disposer: disposers[i]
      }
      indexes && (poolItem.index = indexes[i])
      pool!.set(items[i] as T, poolItem)
    }
  }
}

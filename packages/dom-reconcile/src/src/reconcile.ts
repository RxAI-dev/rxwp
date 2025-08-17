// current: [(b) (c) d e f]
// next:    [(c) (b) h f e]
// 1. (c) is in current (Set), find its index in current, move to its target from
//    next (before (b)) - in both DOM and current list (!), then recognize that new
//    (b) position is the same as its position on next list - skip it
// current: [c b (d) e f]
// next:    [c b (h) f e]
// 2. (h) is not in current (Set) and (d) is not in next (Map), replace
//    in DOM and current array
// current: [c b h (e) (f))]
// next:    [c b h (f) (e)]
// 3. (f) is in current (Set), find its index in current, move to its target from
//    next (before (e)) - in both DOM and current list, then recognize that new
//    (e) position is the same as its position on next list - skip it
// Then it's finished, in just 3 DOM updates

/**
 * Reconcile
 *
 * The Sequential Three-Way Splice (STWS) Algorithm - DOM Nodes List Reconciliation.
 * Diff & re-arrange child nodes of a parent DOM node - find the shortest update path.
 *
 * Unlike most common reconciliation algorithms (based on LIS concepts), STWS algorithm
 * isn't comparing initial, input arrays, but it's updating current nodes list after every
 * move/insert/remove and comparing next nodes array against actual, synchronized DOM children.
 *
 * Thanks to that approach and unique specification of DOM children list (one move could modify
 * list in 2 places), when STWS algorithm performs smart DOM moves in specific order, other
 * elements are also moving, their update paths are changing and a lot of elements are resolved
 * automatically and could be skipped. Algorithm also detects and moves sequences of same nodes
 * on both lists - smart moves are based on sequence length and distance between sequences - in
 * example, when there are 10 nodes in sequence, but distance is only 5 nodes, it's better to move
 * that 5 preceding nodes after sequence, than 10 nodes sequence itself - it could reduce number
 * of DOM operations even more. It has full control over DOM nodes list, always place elements
 * on correct position, and in correct order - ensures that every element can be processed only
 * once (in "classic" algorithms it's possible, that one element is processed twice).
 *
 * In result, it (almost) always needs less DOM operations than "classic" algorithms. Depending
 * on situation, it's even 2x less DOM moves. That operations, like insertBefore or replaceChild,
 * are the heaviest parts of DOM reconciliation algorithms - a lot slower than other logic, like
 * array operations, so reducing the number of DOM updates is the most important in case of performance
 *
 * However, everything has its price - for STWS Algorithm it means:
 * - more array operations (splice, indexOf)
 * - lot of math calculations (indexes, sequences, distance)
 * - has a little bigger memory usage (Map and additional Set, more variables)
 * - it's a lot more code (compared to algorithm from dom-expressions, it's ~400 vs ~75 lines) - so,
 *   the runtime bundle size is also bigger
 * - the algorithm code is also a lot more complicated, has a lot of steps, conditions and branches,
 *   but that's all to achieve its incredible performance results - it's probably the most advanced
 *   DOM reconciliation algorithm on the market
 *
 * Like explained above, generally array operations are a lot faster, than DOM updates, and doing more
 * array operations, if it reduces DOM updates in result, shouldn't have big impact on performance.
 *
 * But even while array operations are fast, they aren't free - algorithm has rich set of optimizations:
 * - looking for next node index in current nodes (indexOf), only if it's rendered (check in prev nodes Set)
 * - skip searching for index for every node from sequence
 * - single operation replace - handle replaces in one replaceChild and skip splices - mutate array instead
 * - skip same nodes on start position (prefix)
 * - ends optimizations - run when nodes on arrays ends are changing:
 *   - skip same nodes (suffix)
 *   - replace end nodes, that could be replaced
 *   - insert new end nodes, that aren't in current nodes
 *   - remove current end nodes, that aren't in next nodes
 * - swap/inner swap - skip splices if nodes could be swapped - mutate array instead
 *
 * @param parent {Node} - array's parent DOM Node
 * @param current {Node[]} - current list - memoized array of nodes from previous iteration
 * @param next {Node[]} - next list - new nodes to process
 */
export default function reconcile(parent: Node, current: Node[], next: Node[]): void {
  /** I) Declare shared variables */
  let currentEnd = current.length, // current list end position
    nextEnd = next.length, // next list end position
    start = 0, // start position on both lists - there's no need for 2 separate iterators
    i = -1, // found index
    j = -1, // local index or local iterator (when main iterators shouldn't be moved)
    k = -1, // temporary index
    d = 0, // distance between node positions in both arrays
    seq = 0, // found sequence length
    cSeq = 0, // temporary found current nodes sequence length
    ins = 0, // number of last elements from current list, that were inserted after current end
    advancedDiff = false, // flag indicating if advanced diff mode is started
    target: Node | null = null, // first element after list end position, target for insertBefore()
    lastCurrent: Node | null = null, // saved reference to last checked node from current end
    lastNext: Node | null = null, // saved reference to last checked node from next end
    nextIndexes: Map<Node, number> | null = null, // Map with next nodes indexes and Node as key
    prevNodes: Set<Node> | null = null, // Set with previous nodes - used for O(1) inserts
    cNodes: Node[] | null = null, // current nodes to process in step 3, removed from current list in step 2
    currentNode: Node, // currently processed Node from current list
    nextNode: Node // currently processed Node from next list

  /** II) Traverse lists and move items - until has items on both lists */
  while (start < currentEnd && start < nextEnd) {
    // Generally, algorithm is traversing both lists in 2 phases (but could finish in 1st phase):
    // - Initial Optimization
    // - Advanced Diff Mode (optional, starts if first phase failed)
    // Each phase has 7 possible checks/steps for each position/iteration and each iteration could move
    // start and end position iterators (depending on step - 1,2 or all 3 iterators), so all variables
    // in while loop condition are dynamic.
    // First 3 steps are running in both phases:
    //  1. Common prefix - skip same nodes on start positions (increment start)
    //  2. Common suffix - skip same nodes on end positions (decrement current & next end)
    //  3. Swap 2 nodes on opposite sides of lists (incr. start and decr. current & next end)
    // Then, in Initial Optimization:
    //  4. Right to left move - move node from end to start (incr. start)
    //  5. Left to right move - move node from start to end (decr. current & next end)
    //  6. Fast path checks - full subsequence & one to many fast path check/run (exit if fast path applied)
    //  7. Init Advanced Diff Mode - create Map of next indexes, Set of previous nodes and start Advanced Diff
    // And in Advanced Diff Mode:
    //  4. Ends optimization - replace all end nodes, that could be replaced (decr. current/next end)
    //  5. Next end optimization - insert all next end nodes, that aren't in current nodes (decr. next end)
    //  6. Current end optimization - remove all curr. end nodes, that aren't in next nodes (decr. curr. end)
    //  7. Run 2-sides rearrange algorithm (Advanced Diff) - move/insert/remove/replace 2 nodes or sequences:
    //    I. Analyze - Find/get next & current node indexes and identify sequences
    //    II. RTL/Insert - move (right-to-left) or insert next node or sequence
    //    III. LTR/Remove - move (left-to-right) or remove current node or sequence
    if (current[start] === next[start]) {
      /** 1. Skip same nodes on start positions */
      start++
    } else if (current[currentEnd - 1] === next[nextEnd - 1]) {
      /** 2. Skip same nodes on end positions */
      currentEnd--
      nextEnd--
      if (ins > 0) --ins
    } else if (
      ins === 0 && // skip swap check if there are nodes inserted after current end
      current[start] === next[nextEnd - 1] &&
      next[start] === current[currentEnd - 1]
    ) {
      /** 3. Swap 2 nodes on opposite sides of lists */
      // [0,1,2,3,(5),6,7,(4)]
      // [0,1,2,3,(4),(5)]
      target = current[--currentEnd].nextSibling
      parent.insertBefore(next[start], current[start])
      // Skip one move, if current or/and next nodes are siblings
      if (--nextEnd - start > 1 && currentEnd - start > 1)
        parent.insertBefore(next[nextEnd], target)
      current[currentEnd] = next[nextEnd]
      current[start] = next[start++]
    } else if (!advancedDiff) {
      /** Initial Optimization */
      // Single moves (4 & 5) and fast paths (6) are not needed in advanced diff, after helper
      // Map and Set are created - it's better to handle it with 2-sides rearrange algorithm

      // Other libraries are skipping single move fast path and doing only swap, but I think that
      // single node move is one of the most common reorder cases - in example drag & drop is
      // almost always single move - so it's better to have it pre-optimized, instead starting
      // advanced diff for just one move
      if (next[start] === current[currentEnd - 1]) {
        /** 4. Right to left move - move node from end to start */
        parent.insertBefore(next[start], current[start])
        current.splice(start++, 0, current.splice(currentEnd - 1, 1)[0])
      } else if (current[start] === next[nextEnd - 1]) {
        /** 5. Left to right move - move node from start to end */
        parent.insertBefore(next[--nextEnd], current[--currentEnd].nextSibling)
        current.splice(currentEnd, 0, current.splice(start, 1)[0])
      } else {
        /** 6. Check and run fast paths optimizations - full subsequence & one to many */
        if (fastPaths(parent, current, next, start, currentEnd, start, nextEnd)) return

        /** 7. Init advanced diff - prepare Map of next nodes indexes and Set of current nodes */
        // - Next Indexes Map - get current node index in next list with O(1), instead O(N)
        // - Prev Nodes Set - check if next node is rendered [O(1)] - skip indexOf iterations if it's not
        nextIndexes = new Map()
        prevNodes = new Set(current.slice(start, currentEnd))
        // Set all next nodes indexes
        for (j = start; j < nextEnd; ++j) nextIndexes.set(next[j], j)
        advancedDiff = true
      }
    } else {
      /** Advanced Diff Mode */
      // Optimize array ends (only when node on array end changed) before rearranging nodes
      if (lastNext !== next[(i = nextEnd - 1)] && !prevNodes!.has((lastNext = next[i]))) {
        if (
          ins === 0 &&
          lastCurrent !== current[(j = currentEnd - 1)] &&
          !nextIndexes!.has((lastCurrent = current[j]))
        ) {
          /** 4. Replace all end nodes, that could be replaced */
          parent.replaceChild(next[i], current[j])
          current[j] = next[i]
          seq = 1
          while (
            i - seq >= start &&
            j - seq >= start &&
            !prevNodes!.has(next[i - seq]) &&
            !nextIndexes!.has(current[j - seq])
          ) {
            parent.replaceChild(next[i - seq], current[j - seq])
            current[j - seq] = next[i - seq++]
          }
          lastCurrent = current[(currentEnd -= seq)]
        } else {
          /** 5. Insert all next end nodes, that aren't in previous nodes */
          target = current[currentEnd - 1].nextSibling
          parent.insertBefore(next[i], target)
          target = next[i]
          seq = 1
          while ((j = i - seq) >= start && !prevNodes!.has(next[j])) {
            parent.insertBefore(next[j], target)
            target = next[i - seq++]
          }
          current.splice(currentEnd, 0, ...next.slice(nextEnd - seq, nextEnd))
        }
        lastNext = next[(nextEnd -= seq)]
      } else if (
        ins === 0 &&
        lastCurrent !== current[(j = currentEnd - 1)] &&
        !nextIndexes!.has((lastCurrent = current[j]))
      ) {
        /** 6. Remove all current end nodes, that aren't in next nodes */
        parent.removeChild(current[j])
        seq = 1
        while (j - seq >= start && !nextIndexes!.has(current[j - seq])) {
          parent.removeChild(current[j - seq++])
        }
        current.splice(nextEnd - seq, seq)
        lastCurrent = current[(currentEnd -= seq)]
      } else {
        /** 7. Advanced Diff - Run 3-step, 2-sides rearrange algorithm */
        // Get nodes from start of both lists
        currentNode = current[start]
        nextNode = next[start]

        /********************************************************************* *
         * Step 1. Analyze - find/get node indexes and look for node sequences *
         ********************************************************************* */

        /** 1. Reset found sequence length, indexes and array of nodes to process in step 3 */
        seq = 1 // next nodes sequence length
        i = -1 // next node index in current list
        k = -1 // current node index in next list
        cNodes = null // current nodes removed with splice in step 2, to move/remove in step 3
        /** 2. Look for next node and sequence in previous nodes, or sequence of nodes to insert */
        if (prevNodes!.has(nextNode)) {
          /** A) Next node move - find index of next node in current list and look for sequence */
          i = current.indexOf(nextNode, start + 1) // indexOf is ~10x faster, than search with for/while
          while (i + seq < currentEnd && current[i + seq] === next[start + seq]) ++seq
        } else {
          /** B) Next node insert - look for sequence of nodes to insert */
          while ((j = start + seq) < nextEnd && !prevNodes!.has(next[j])) ++seq
        }
        /** 3. Check if Step 3 should be skipped */
        cSeq = next[start + seq] === currentNode || (i > -1 && seq > i - start) ? 0 : 1
        if (cSeq > 0) {
          /** 3. Look for current node and sequence in next nodes, or sequence of nodes to remove */
          k = nextIndexes!.get(currentNode) || -1
          if (k > -1) {
            /** A) Current node move - look for sequence of same nodes in both arrays */
            while (k + cSeq < nextEnd && next[k + cSeq] === current[start + cSeq]) ++cSeq
          } else {
            /** B) Current node remove - look for sequence of nodes to remove */
            while ((j = start + cSeq) < currentEnd && !nextIndexes!.has(current[j])) ++cSeq
          }
        }

        /********************************************************************* *
         * Step 2. RTL/Insert - Right-to-left (next node) move(A) or insert(B) *
         ********************************************************************* */

        /** I. Check if next node should be moved (it was in previous nodes) or inserted */
        if (i > -1) {
          /** A) Has next node in current items - move item(s) */
          /** Check if it's a single node (1) or sequence - longer (2) or shorter (3) than distance */
          if (seq === 1) {
            /** 1. Single node */
            if (i === k && cSeq === 1) {
              /** 1.1 Inner swap fast path */
              // When next and current target indexes are the same, and both nodes are single,
              // without sequence, we can swap them and save some time, by overwriting nodes
              // on current list, instead of 3 splices
              target = current[i].nextSibling
              parent.insertBefore(next[start], current[start])
              // Skip one move, if current or/and next nodes are siblings
              if (i - start > 1) parent.insertBefore(next[i], target)
              current[i] = next[i]
              current[start] = next[start++]
              continue
            }
            /** 1.2 Move next node */
            parent.insertBefore(nextNode, currentNode)
            /** 1.3 Update current list */
            cNodes = current.splice(start, cSeq, current.splice(i, 1)[0])
          } else if (seq > i - start) {
            /** 2. Sequence is longer than distance - move preceding items after sequence */
            // [E,J,F,(A,B,C,D),G,K,H]
            // [(A,B,C,D),H,G,E,J,K,F]
            /** 2.1 Move preceding nodes */
            target = current[i - 1 + seq].nextSibling
            for (j = start; j < i; ++j) parent.insertBefore(current[j], target)
            /** 2.2 Update current list */
            current.splice(start + seq, 0, ...current.splice(start, i - start))
          } else {
            /** 3. Sequence is shorter or equal distance - move all sequence items before current node */
            // [D,E,F,G,H,(A,B,C),I]
            // [(A,B,C),D,E,F,G,H,I]
            /** 3.1 Move sequence of nodes */
            for (j = 0; j < seq; ++j) parent.insertBefore(next[start + j], currentNode)
            /** 3.2 Update current list */
            cNodes = current.splice(start, cSeq, ...current.splice(i, seq))
          }
        } else {
          /** B) Has not next node in current items - insert/replace new item(s) */
          j = 0
          /** Check if current node or sequence should be removed */
          if (k === -1) {
            /** 1. Replace current node(s) with next node(s), when current nodes should be removed */
            // [{D,E,F,G},H,J,K,L,I]
            // [(A,B,C),H,I,M,N,O,P]
            while (j < seq && j < cSeq) {
              parent.replaceChild(next[start + j], current[start + j])
              current[start + j] = next[start + j++]
            }
            /** 1.1 Check if there is any sequence left to insert or remove, after replaces */
            if (j < seq) {
              /** 1.2 Sequence to insert left - insert remaining nodes */
              target = current[start + j - 1].nextSibling
              while (j < seq) {
                parent.insertBefore(next[start + j++], target)
                ++currentEnd
              }
              current.splice(start + j, 0, ...next.slice(start + j, start + seq))
            } else if (j < cSeq) {
              /** 1.3 Sequence to remove left - remove remaining nodes */
              while (j < cSeq) {
                parent.removeChild(current[start + j++])
                --currentEnd
              }
              current.splice(start + j, cSeq - j)
            }
            /** 1.4 Skip Step 3. - everything is already processed */
            cSeq = 0
          } else {
            /** 2. Insert next node(s), when current nodes should be moved or skipped */
            // [{D},E,F,G,H,J,K,L,I]
            // [(A,B,C),{D},E,F,G,H,I]
            while (j < seq) parent.insertBefore(next[start + j++], currentNode)
            cNodes = current.splice(start, cSeq, ...next.slice(start, start + seq))
            currentEnd += seq
          }
        }
        /** II. Update start position */
        start += seq
        /** III. Skip Step 3. if current sequence is 0 */
        if ((seq = cSeq) === 0) continue

        /************************************************************************ *
         * Step 3. LTR/Remove - Left-to-right (current node) move(A) or remove(B) *
         ************************************************************************ */

        /** I. Check if current node should be moved (is in next nodes) or removed */
        if ((i = k) > -1) {
          /** A) Has current node in next list - move node(s) to target position(s) */
          /** !!
           * After last splice in previous step, node or sequence of nodes are already removed
           * from current list (for 3 splices instead of 4), but positions (start & i) are not
           * changed - it's safe and easier to do calculations based on target positions and just
           * use `index - sequence` to access current array elements
           */
          /** 1. Get distance and last sequence index (if it's not sequence, it's just node index) */
          d = i - start // distance from found node to currently processed node
          i = i + seq - 1 // last sequence index as target index
          /** 2. Insert after current end edge-case optimization - re-calculate target index & distance */
          /** !!
           * When target index is greater than last current node index, calculate its new
           * target index and distance - check already inserted nodes indexes (from the end),
           * and save (as target) index of first found element with index lower than sequence
           * target index, or save index of first element before sequence, if target index is
           * the lowest in inserted items
           */
          if (i >= currentEnd || (ins && i >= currentEnd - ins)) {
            /** 2.1 Re-calculate target index, based on next indexes of already inserted nodes */
            for (j = i >= currentEnd ? currentEnd - 1 : i; j >= currentEnd - ins; --j) {
              if (nextIndexes!.get(current[j - seq])! < i) break
            }
            /** 2.2 Save new target index */
            i = j
            /** 2.3 Update inserted count */
            ins += seq
            /** 2.4 Recalculate distance */
            d = i - seq + 1 - start
          }

          /** 3. Check if there is any node after node/sequence and get its index */
          if ((k = start + seq) === currentEnd) continue // skip when there are no nodes after sequence

          /** 4. Check if it's sequence or single node */
          if (seq === 1) {
            /** 4.1 Single node - move node to target position */
            parent.insertBefore(currentNode, current[i - seq].nextSibling)
            /** Finish updating current list */
            current.splice(i, 0, currentNode)
          } else if (seq > d || seq > currentEnd - k) {
            /** 4.2 Sequence is longer than distance - move elements next to sequence, before the sequence */
            // [1,(5,6,7),2,9,0]
            // [1,2,8,(5,6,7),3,4]
            for (j = k; j < currentEnd && j < k + d; ++j)
              parent.insertBefore(current[j - seq], currentNode)
            /** Finish updating current list */
            current.splice(j - seq, 0, ...cNodes!)
          } else {
            /** 4.3 Sequence is shorter or equal distance - move all sequence items to target positions */
            // [1,(5,6),2,3,4,7,8]
            // [1,2,3,7,(5,6),8,4]
            target = current[i - seq].nextSibling
            for (j = 0; j < seq; ++j) parent.insertBefore(cNodes![j], target)
            /** Finish updating current list */
            current.splice(i - seq + 1, 0, ...cNodes!)
          }
        } else {
          /** B) Has not current node in next list - remove node(s) */
          for (j = 0; j < seq; ++j) parent.removeChild(cNodes![j])
          currentEnd -= seq
        }
      }
    }
  }

  /** III) Final optimization - insert or remove remaining elements */
  if (start === currentEnd) {
    if (start === nextEnd) return
    target = current[currentEnd - 1].nextSibling
    while (start < nextEnd) parent.insertBefore(next[start++], target)
  } else if (start === nextEnd) {
    while (start < currentEnd) parent.removeChild(current[start++])
  }
}

function fastPaths(
  parent: Node,
  current: Node[],
  next: Node[],
  currentStart: number,
  currentEnd: number,
  nextStart: number,
  nextEnd: number
): boolean {
  const currentLeft = currentEnd - currentStart,
    nextLeft = nextEnd - nextStart
  let i = -1
  /** 1. Full subsequence fast path - shorter array is a part of longer */
  if (currentLeft < nextLeft) {
    /** A. More next nodes left */
    // Check if increasing sequence of all current nodes left is a subsequence of next nodes left
    // and get its index - exit early if index not found, if there are less remaining nodes after
    // index, than all current nodes or if some item in sequence doesn't match
    if ((i = subsequenceIndex(next, nextStart, nextEnd, current, currentStart, currentEnd)) > -1) {
      // if it's subsequence, first insert next nodes, from start to subsequence index,
      // before first current node
      while (nextStart < i) parent.insertBefore(next[nextStart++], current[currentStart])
      const target = current[currentEnd - 1].nextSibling
      nextStart = i + currentLeft
      // then insert rest of next nodes after last current node
      while (nextStart < nextEnd) parent.insertBefore(next[nextStart++], target)
      return true
    }
  } else if (nextLeft < currentLeft) {
    /** B. More current nodes left */
    // Check if increasing sequence of all next nodes left is a subsequence of next nodes left
    // and get its index - exit early if index not found, if there are less remaining nodes after
    // index, than all current nodes or if some item in sequence doesn't match
    if ((i = subsequenceIndex(current, currentStart, currentEnd, next, nextStart, nextEnd)) > -1) {
      // if it's subsequence, first remove current nodes, from start to subsequence index,
      while (currentStart < i) parent.removeChild(current[currentStart++])
      // then skip subsequence...
      currentStart = i + nextLeft
      // ...and remove rest of current nodes after it
      while (currentStart < currentEnd) parent.removeChild(current[currentStart++])
      return true
    }
  }

  /** 2. One to many fast path */
  // Replace one current element with many next elements,
  // or replace many current elements with one next element
  if (currentLeft === 1 || nextLeft === 1) {
    /** A) Insert one or many (all) next nodes before first current node */
    while (nextStart < nextEnd) parent.insertBefore(next[nextStart++], current[currentStart])
    /** B) Remove one or many (all) current nodes */
    while (currentStart < currentEnd) parent.removeChild(current[currentStart++])
    return true
  }
  return false
}

/**
 * Subsequence Index
 *
 * Find index of first element from shorter array in longer array,
 * if shorter array is subsequence of longer or -1 if it's not subsequence
 * @param moreNodes
 * @param moreStart
 * @param moreEnd
 * @param lessNodes
 * @param lessStart
 * @param lessEnd
 */
function subsequenceIndex(
  moreNodes: Node[],
  moreStart: number,
  moreEnd: number,
  lessNodes: Node[],
  lessStart: number,
  lessEnd: number
): number {
  // 1. Find index of shorter array's first item in longer array
  const i = moreNodes.indexOf(lessNodes[lessStart], moreStart)
  // 2. Check if index is found, and if there are more remaining items after that index in longer array,
  // than shorter array length (if not, it's not subsequence - return -1)
  if (i > -1 && moreEnd - (moreStart = i + 1) >= lessEnd - lessStart++) {
    // 3. Check if all rest items from shorter list are a sequence in longer list, if some
    // item is not in sequence, return -1
    while (lessStart < lessEnd) {
      if (moreNodes[moreStart++] !== lessNodes[lessStart++]) return -1
    }
  }
  // 4. Return found index or -1
  return i
}

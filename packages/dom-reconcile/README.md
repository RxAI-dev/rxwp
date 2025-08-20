# Sequential Three-Way Splice (STWS) Dom Reconciliation algorithm

The Sequential Three-Way Splice (STWS) Algorithm - DOM Nodes List Reconciliation.
Diff & re-arrange child nodes of a parent DOM node - find the shortest update path.

Unlike most common reconciliation algorithms (based on LIS concepts), STWS algorithm
isn't comparing initial, input arrays, but it's updating current nodes list after every
move/insert/remove and comparing next nodes array against actual, synchronized DOM children.

Thanks to that approach and unique specification of DOM children list (one move could modify
list in 2 places), when STWS algorithm performs smart DOM moves in specific order, other
elements are also moving, their update paths are changing and a lot of elements are resolved
automatically and could be skipped. Algorithm also detects and moves sequences of same nodes
on both lists - smart moves are based on sequence length and distance between sequences - in
example, when there are 10 nodes in sequence, but distance is only 5 nodes, it's better to move
that 5 preceding nodes after sequence, than 10 nodes sequence itself - it could reduce number
of DOM operations even more. It has full control over DOM nodes list, always place elements
on correct position, and in correct order - ensures that every element can be processed only
once (in "classic" algorithms it's possible, that one element is processed twice).

In result, it (almost) always needs less DOM operations than "classic" algorithms. Depending
on situation, it's even 2x less DOM moves. That operations, like insertBefore or replaceChild,
are the heaviest parts of DOM reconciliation algorithms - a lot slower than other logic, like
array operations, so reducing the number of DOM updates is the most important in case of performance

However, everything has its price - for STWS Algorithm it means:
- more array operations (splice, indexOf)
- lot of math calculations (indexes, sequences, distance)
- has a little bigger memory usage (Map and additional Set, more variables)
- it's a lot more code (compared to algorithm from dom-expressions, it's ~400 vs ~75 lines) - so,
  the runtime bundle size is also bigger
- the algorithm code is also a lot more complicated, has a lot of steps, conditions and branches,
  but that's all to achieve its incredible performance results - it's probably the most advanced
  DOM reconciliation algorithm on the market

Like explained above, generally array operations are a lot faster, than DOM updates, and doing more
array operations, if it reduces DOM updates in result, shouldn't have big impact on performance.

But even while array operations are fast, they aren't free - algorithm has rich set of optimizations:
- looking for next node index in current nodes (indexOf), only if it's rendered (check in prev nodes Set)
- skip searching for index for every node from sequence
- single operation replace - handle replaces in one replaceChild and skip splices - mutate array instead
- skip same nodes on start position (prefix)
- ends optimizations - run when nodes on arrays ends are changing:
    - skip same nodes (suffix)
    - replace end nodes, that could be replaced
    - insert new end nodes, that aren't in current nodes
    - remove current end nodes, that aren't in next nodes
- swap/inner swap - skip splices if nodes could be swapped - mutate array instead

### Quick look at very small example
> `a/b/c/d/e/f` letters are symbolizing separate DOM nodes
1. First element is the same in both lists, so all algorithms will skip it as fast path:
    ```text
       current: [a, (b) (c) d e f]
       next:    [a, (c) (b) h f e]
    ```
2. (c) is in current (Set), find its index in current, move to its target from next (before (b)) - in both DOM and current list (!), then recognize that new (b) position is the same as its position on next list - skip it
    ```text
       current: [a, (b) (c) d e f]
       next:    [a, (c) (b) h f e]
    ```
3. (h) is not in current (Set) and (d) is not in next (Map), replace in DOM and current array
    ```text
       current: [c b (d) e f]
       next:    [c b (h) f e]
    ```
4. (f) is in current (Set), find its index in current, move to its target from next (before (e)) - in both DOM and current list, then recognize that new (e) position is the same as its position on next list - skip it
    ```text
       current: [c b h (e) (f))]
       next:    [c b h (f) (e)]
    ```

Then it's finished, in just 3 DOM updates. In compared standard `dom-expressions` (used in example in **Solid**), that simple
example will require 6 DOM updates, because it's separately removing/appending two of the nodes, while **STWS** algorithm
is using single replace operations
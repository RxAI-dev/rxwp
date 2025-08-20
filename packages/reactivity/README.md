<img src="https://raw.githubusercontent.com/RxAI-dev/RxNN/refs/heads/main/assets/logo/logo_rxai_v2.png" width="400" />

# rx:WebPlatform Reactivity - Fine-Grained Reactivity Library

## Introduction

rx:WP Reactivity is a **high-performance fine-grained reactivity library** designed for building reactive applications with minimal overhead and maximum efficiency. It serves as the reactive core for the Reactive Web platform and is optimized for stateful, event-driven applications like Reactive Transformer (RxT) AI models.

### Why Fine-Grained Reactivity?

Unlike Virtual DOM-based approaches that compare entire component trees, fine-grained reactivity:

- **Updates only what's necessary** - no diffing required
- **Has O(D) complexity** where D is the number of affected graph nodes
- **Provides immediate access** to current values
- **Enables true real-time processing** - critical for event-driven AI

rx:WP Reactivity achieves **better performance than Solid.js** in benchmarks while providing additional features like hybrid eager/lazy evaluation and complex owner/child tree structures.

### Key Benefits

- **Minimal overhead**: Single-function observable pattern
- **Hybrid evaluation**: Mix eager (`memo`, `observer`) and lazy (`computed`) observers
- **Synchronized async**: AsynX ensures batched async updates from multiple sources
- **Suspense integration**: Seamless async UI handling
- **Event-driven architecture**: Perfect for Reactive AI models
- **Small bundle size**: Only what you need, when you need it

## Core Concepts

### Reactive Graph

rx:WP Reactivity builds a **Reactive Graph** structure that connects all reactive nodes:

```
Observable (Source) → Observer (Computation)
       ↑                  ↓
       └─── Subscription ─┘
```

- **Observables** are data sources that store values
- **Observers** are computations that react to changes
- **Subscriptions** connect observables to observers
- **Owners** form a tree structure for scope management

### State Management

rx:WP Reactivity uses **bit flags** for efficient state tracking:

```typescript
export const enum State {
  Actual = 0,
  Stale = 1 << 0,       // Needs update
  Pending = 1 << 1,     // In batch queue
  PendingDisposal = 1 << 2,
  Running = 1 << 3,
  Disposed = 1 << 4,
  // Check flags
  Upstreamable = Pending | PendingDisposal,
  Liftable = Stale | Pending | PendingDisposal,
  All = 31,
  PendingStates = 14
}
```

### Batching and Scheduling

rx:WP Reactivity uses multiple queues for efficient scheduling:

- **$$Changes**: Observable value changes
- **$$Updates**: Eager observers and memos
- **$$Effects**: Lazy effects (renderEffects + effects)
- **TimelineScheduler**: For time-based scheduling
- **AsapQueue**: Microtask queue (`Promise.resolve()`)
- **FrameQueue**: Animation frame queue

All updates run within a single `batch()` to ensure atomic updates.

## Observable API

### `observable<T>(value?: T, equals?: Equals<T>): Observable<T>`

Creates a reactive data source.

```typescript
const count = observable(0);
count(); // Read: 0
count(1); // Write: 1
count(p => p + 1); // Update: 2
```

**Parameters:**
- `value`: Initial value (optional)
- `equals`: Equality function (default: `===`)

**Returns:** An `Observable<T>` function with dual behavior:
- No arguments: Read value and subscribe
- With argument: Update value

### `signal<T>(value?: T, equals?: Equals<T>): ObservableSignal<T>`

Creates an observable signal with getter/setter tuple.

```typescript
const [count, setCount] = signal(0);
count(); // Read: 0
setCount(1); // Write: 1
```

**Parameters:** Same as `observable()`

**Returns:** A tuple `[Readable<T>, Writable<T>]`

### `computed<T>(fn: (v?: T) => T, initial?: T, equals?: Equals<T>): Readable<T>`

Creates a **lazy-evaluated** observable value.

```typescript
const count = observable(0);
const doubled = computed(() => count() * 2);
// doubled() only runs when read
```

**Parameters:**
- `fn`: Computation function
- `initial`: Initial value (for first read)
- `equals`: Equality function

**Key Insight:** Only evaluates when read, not on every dependency change.

### `memo<T>(fn: (v?: T) => T, initial?: T, equals?: Equals<T>): Readable<T>`

Creates an **eagerly-evaluated** observable value.

```typescript
const count = observable(0);
const doubled = memo(() => count() * 2);
// doubled() runs immediately and on every count change
```

**Parameters:** Same as `computed()`

**Key Insight:** Runs immediately on creation and added to update queues.

### `observer<T>(fn: (v?: T) => T, initial?: T): void`

Creates the most basic **eager observer**.

```typescript
const count = observable(0);
observer(() => console.log('Count:', count()));
count(1); // Logs: Count: 1
```

**Parameters:**
- `fn`: Observer function
- `initial`: Initial value (for first run)

**Execution Order:** Runs with memos, before renderEffects and effects.

### `renderEffect<T>(fn: (v?: T) => T, initial?: T): void`

Creates a **render-time delayed effect**.

```typescript
const count = observable(0);
renderEffect(() => {
  console.log('Render effect:', count());
});
count(1); // Logs after all memos/observers
```

**Parameters:** Same as `observer()`

**Execution Order:** Runs after all observables/memos/observers are updated, before effects.

### `effect<T>(fn: (v?: T) => T, initial?: T): void`

Creates an **after-render delayed effect**.

```typescript
const count = observable(0);
effect(() => {
  console.log('Effect:', count());
});
count(1); // Logs after all renderEffects
```

**Parameters:** Same as `observer()`

**Execution Order:** Runs after all renderEffects - behaves like "fake-async" queue.

### `selector<T, U>(source: Readable<T>, fn: Equals<T | U> = EQUALS): (key: U) => boolean`

Creates a **computed selector** for efficient filtering.

```typescript
const items = observable([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
const selectedId = observable(1);
const selected = selector(items, (a, b) => a.id === b);

selected(1); // true
selected(2); // false
```

**Parameters:**
- `source`: Observable source
- `fn`: Equality function (default: `===`)

**Returns:** A function that checks if a key matches the current value.

### `on<T, D extends Readable<any>>(deps: D | D[], fn: (v?: T) => T, onChanges?: boolean): (v?: T) => T`

Creates an observer that only runs **when dependencies change**.

```typescript
const count = observable(0);
const effect = on(count, () => console.log('Count changed!'));
count(1); // Logs: Count changed!
count(1); // No log (value didn't change)
```

**Parameters:**
- `deps`: Dependency(ies) to watch
- `fn`: Observer function
- `onChanges`: Whether to run on first execution

### `batch<T>(fn: () => T): T`

Groups multiple updates into a **single batch**.

```typescript
batch(() => {
  count(1);
  name('John');
});
// Only one UI update instead of two
```

**Key Insight:** Prevents intermediate states and multiple reactive updates.

**Info:** in most of Reactive Web Platform, batching is handled implicitly by framework - even delegation updates and asynx updates are scheduled in single batches
### `untrack<T>(fn: () => T): T`

Runs a function **without tracking** dependencies.

```typescript
const count = observable(0);
const effect = observer(() => {
  console.log('Observer:', count());
  untrack(() => console.log('Untracked:', count()));
});

count(1);
// Logs:
// Observer: 1
// Untracked: 1
// (But second log won't re-run when count changes again)
```

**Use Case:** Read values without creating dependencies.

### `cleanup(fn: (final: boolean) => void): void`

Adds a cleanup function to the current owner scope.

```typescript
observer(() => {
  const interval = setInterval(() => console.log('Tick'), 1000);
  cleanup(() => clearInterval(interval));
});
// Interval cleared when observer is disposed
```

**Parameters:**
- `fn`: Cleanup function
    - `final`: `true` on final disposal, `false` before re-execution

### `error(fn: ErrorHandler): void`

Adds an error boundary to the current owner scope.

```typescript
observer(() => {
  error(e => console.error('Observer error:', e));
  throw new Error('Test');
});
// Logs: Observer error: Error: Test
```

**Parameters:**
- `fn`: Error handler function

### `context<T>(id: symbol, value?: T): T | undefined`

Creates or retrieves context values.

```typescript
const ThemeContext = contextId();
observer(() => {
  context(ThemeContext, 'dark');
  console.log(context(ThemeContext)); // 'dark'
});
```

**Parameters:**
- `id`: Context identifier (symbol)
- `value`: Value to set (optional)

**Returns:** Current context value

### `contextId(): symbol`

Generates a unique context identifier.

```typescript
const ThemeContext = contextId();
```

### `getOwner(): ObserverNode<any> | null`

Gets the current owner node.

```typescript
const owner = getOwner();
```

**Use Case:** Advanced reactive patterns requiring owner access.

### `isListening(): boolean`

Checks if currently in a tracked context.

```typescript
isListening(); // true inside observer/memo/etc.
```

**Use Case:** Conditional tracking behavior.

## AsynX API

AsynX is rx:WP Reactivity's **synchronized async execution system** that ensures batched updates from multiple async sources.

### The Core Concept

**AsynX doesn't batch actions within a single pipeline call. Instead, it batches async operations that are scheduled during the same synchronous execution context, regardless of where they're called from.**

This is the critical distinction:

```typescript
// CORRECT: These two calls will be batched into a single microtask
// (scheduled during the same synchronous execution)
asynx(() => count(1))
asynx(() => name('John'))

// INCORRECT: This pipeline will execute in two separate microtasks
// (second action runs after first completes)
asynx(
  () => count(1),
  value => name('John')
)
```

### Why This Matters

The real power of AsynX is that it **batches async operations from different parts of your application** that are triggered by the same synchronous event:

1. **Component initialization** - multiple components scheduling async operations
2. **Event handling** - multiple observers reacting to a single event
3. **Reactive updates** - multiple computations triggering async operations

Without AsynX, each would cause separate reactive updates. With AsynX, they're batched into a single update.

### `asynx<T = void, R = void>(source?: AsynxSource, ...actions: AsynxActionOrTuple<T, any>[]): Dispose | ((source: AsynxSource, ...actions: AsynxActionOrTuple<T, any>[]) => Dispose)`

Schedules asynchronous actions with transaction locking.

```typescript
// Schedules action for next microtask
asynx(() => console.log('Runs in next microtask'));

// Schedules action with observable locking
asynx([() => count(1), [count]]);

// Schedules delayed action
asynx(500, () => console.log('Runs after 500ms'));

// Schedules action for next animation frame
asynx('frame', () => console.log('Runs in next frame'));
```

**Parameters:**
- `source`: Scheduling source:
    - `'asap'` (default): Next microtask
    - `'frame'`: Next animation frame
    - `number`: Milliseconds delay
    - `() => any | Promise<any>`: Custom source (returns initial value) - could return promise, that wil be also synchronized with other micro-queue tasks
- `actions`: Actions to execute (rest parameters)
    - Regular function: `(value: T) => R`
    - Tuple with lock: `[(value: T) => R, [observable1, observable2]]`

**Returns:**
- `Dispose`: Function to cancel the scheduled action
- Or a lazy scheduler when called as `asynx()`

**Key Features:**
- Batches async operations from same synchronous context
- Transaction locking for observables
- Proper cleanup and disposal
- Works across component boundaries

### `suspendedAsynx<T = void, R = void>(source?: AsynxSource, ...actions: AsynxActionOrTuple<T, any>[]): never`

Schedules actions with **Suspense integration**.

```typescript
input.onInput = e => suspendedAsynx(500, [
  () => fetchResponse(e.target.value),
  response => setResponse(response)
]);
```

**Behavior:**
- Immediately throws `SuspensionSignal`
- Increments Suspense pending count
- Automatically decrements when complete
- Integrates with Suspense boundaries
- Batches with other async operations from same event

### `awaitAsynx<T = void, R = void>(source?: AsynxSource, ...actions: AsynxActionOrTuple<T, any>[]): Readable<R | Waiting>`

Creates a **reactive awaitable** for use inside observers.

```typescript
const response = awaitAsynx(500, [() => fetchResponse()]);
asynxEffect(response, value => {
  console.log('Response:', value);
});
```

**Returns:** A readable that:
- Starts as `WAITING`
- Updates to final value when pipeline completes
- Batches with other async operations

### `asynxObserver<T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E): void`

Observer that **only runs when value is ready**.

```typescript
asynxObserver(awaitAsynx(500, [() => fetchResponse()]), value => {
  console.log('Response:', value);
  console.log('After awaited, works like regular observer: ', otherObservable())
});
```

**Behavior:**
- Skips execution while `WAITING`
- Runs only with actual values
- Maintains proper reactivity
- Batches with other async operations

### `asynxEffect<T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E): void`

Effect that **only runs when value is ready**.

```typescript
asynxEffect(awaitAsynx(500, [() => fetchResponse()]), value => {
  console.log('Response:', value);
  console.log('After awaited, works like regular effect: ', otherObservable())
  // Runs after render
});
```

### `asynxRenderEffect<T, E = void>(on: Readable<T | Waiting>, fn: (awaited: T, acc?: E) => E, initialValue?: E): void`

RenderEffect that **only runs when value is ready**.

```typescript
asynxRenderEffect(awaitAsynx(500, [() => fetchResponse()]), value => {
  console.log('Response:', value);
  console.log('After awaited, works like regular renderEffect: ', otherObservable())
  // Runs during render
});
```

## Suspense API

### `createSuspense<T>(fn: () => T, fallback: (error?: Error) => JSX.Element): () => JSX.Element`

Creates a Suspense boundary.

```tsx
const Content = createSuspense(
  () => <Message response={fetchResponse()} />,
  error => error ? <Error message={error.message} /> : <Spinner />
);
```

**Parameters:**
- `fn`: Content function (may suspend)
- `fallback`: Fallback function (with optional error)

**Behavior:**
- Runs content in isolated root
- Switches to fallback when suspended
- Automatically re-renders when async completes
- Handles errors properly

### `suspend<T>(promise: Promise<T>): T`

Suspends execution until promise resolves.

```typescript
const response = suspend(fetch('/api/data'));
// Throws SuspensionSignal
// Resumes when promise resolves
```

**Behavior:**
- Increments Suspense pending count
- Throws `SuspensionSignal`
- Automatically decrements on resolution/error

### `SuspensionSignal`

Error implementation used for suspension.

```typescript
try {
  suspend(promise);
} catch (e) {
  if (e instanceof SuspensionSignal) {
    // Handle suspension
  }
}
```

## Resource Management

### `createResource<T, U = undefined>(fetcher: (input: U) => Promise<T>, options?: { initialValue?: T }): Resource<T>`

Creates a resource with Suspense integration.

```typescript
const { data, error, loading, load } = createResource(
  async (query: string) => await model.processQuery(query)
);

input.onInput = e => load(e.target.value);
```

**Returns:**
- `data`: Signal with current data
- `error`: Signal with current error
- `loading`: Signal indicating loading state
- `load`: Function to load data (with Suspense)

**Behavior:**
- `load()` suspends when already loading
- Proper error handling
- Seamless Suspense integration

### `asynxResource<T, U = undefined>(fetcher: (input: U) => Promise<T>, options?: { initialValue?: T }): Resource<T>`

Creates a resource with **AsynX integration**.

```typescript
const { data, error, loading, load } = asynxResource(
  async (query: string) => await model.processQuery(query)
);

input.onInput = e => load(e.target.value);
```

**Behavior:**
- Uses AsynX for batched updates
- Better performance with multiple async operations
- No intermediate states

## Advanced Patterns

### Event-Driven AI Integration

rx:WP Reactivity is perfectly suited for Reactive Transformer (RxT) AI models and Live Backend Components:

```tsx

declare const message: Observable<[type: 'query' | 'answer', message: string]>
const ReactiveChatServer = backend(shared(() => {
    const rxlm = rxCloud.loadReactiveModel('model-id', { batchSize: 16 } )
    const windowMs = 1000
    const userInputs = observable<[id: string, query: string, memory: UserStm][]>([])
    const lastEmittedTokens = observable<[id: string, token: string][]>([])

    let lastCallTime = 0

    observer(() => {
        if (userInputs().length >= 16 || (performance.now() - lastCallTime) >= windowMs) {
            const modelInput = rxCloud.prepareBatch(16, userInputs()) // If batch is not full, it's zero-padded
            observer(() => {
                lastEmittedTokens(rxCloud.connectObservable(rxlm, modelInput))
                cleanup(final => {
                    if (final) {
                        lastCallTime = performance.now()
                        userInputs([])
                        lastEmittedTokens([])
                    }
                })
            })
        }
    })

    return (props: { id: string }) => {
        const chatMessages = observable<[type: 'query' | 'answer', value: string][]>([])
        const currentGenerated = observable('')
        const mutableSTM = rxCloud.connectStmFromFastAccessStorage(props.id)
        const loading = observable(false)
        cleanup(() => {
            rxCloud.storeStmInLongPersistanceStorage(props.id, mutableSTM)
        })

        const initInteraction = (event: JSX.ServerEvent) => {
            userInputs(inputs => [...inputs, [props.id, event.value, mutableSTM]])
            loading(true)
            chatMessages(m => [...m, ['query', event.value]])
        }

        observer(() => {
            if (lastEmittedTokens().length === 0 && untrack(currentGenerated) !== '') {
                chatMessages(untrack(currentGenerated))

                currentGenerated('')
            } else {
                const token = lastEmittedTokens().find(t => t[0] == props.id)
                currentGenerated(acc => acc + token)
            }
        })

        const inputData = observable('') // Client-side bound

        return (
            <div class:chat>
                <div $:for={(message as let$) in chatMessages()}>
                    <div class:query={message()[0] === 'query'} class:answer={message()[0] === 'answer'}>{message()[1]}</div>
                </div>
                <div class:answer class:generated>{currentGenerated}</div>
                <input bind:server={inputData} />
                <button onClick:server-bind={[initInteraction, inputData]}>Send Query</button>
            </div>
        )
    }
}))

```

**Benefits:**
- Single batched update for entire AI interaction
- No intermediate states
- Proper STM state management
- Seamless UI integration across components


## Examples

### Basic Counter

```tsx
const Counter = () => {
  const count = observable(0);
  
  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => count(p => p + 1)}>Increment</button>
    </div>
  );
};
```

### Async Data Loading with Suspense

```tsx
const UserList = () => {
  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    return response.json();
  };
  
  const { data, error } = createResource(fetchUsers);
  
  return (
    <Suspense fallback={<Spinner />} error={error}>
      <ul>
        {data().map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </Suspense>
  );
};
```

### Batching Async Operations from Multiple Components

```tsx
// Component A
const ComponentA = () => {
  const count = observable(0);
  
  useEffect(() => {
    // This asynx will be batched with ComponentB's asynx
    asynx(() => count(p => p + 1));
  });
  
  return <div>Count: {count()}</div>;
};

// Component B
const ComponentB = () => {
  const name = observable('John');
  
  useEffect(() => {
    // This asynx will be batched with ComponentA's asynx
    asynx(() => name('Jane'));
  });
  
  return <div>Name: {name()}</div>;
};

// Parent component
const App = () => (
  <div>
    <ComponentA />
    <ComponentB />
  </div>
);
```

**Result:** When both components mount, their async operations are batched into a single UI update.

### Complex State Management with AsynX

```tsx
const TodoApp = () => {
  const todos = observable([]);
  const filter = observable('all');
  
  // Computed filtered todos
  const filteredTodos = computed(() => {
    const all = todos();
    switch (filter()) {
      case 'active': return all.filter(t => !t.completed);
      case 'completed': return all.filter(t => t.completed);
      default: return all;
    }
  });
  
  // Auto-save todos with AsynX
  effect(() => {
    // Multiple components could trigger save operations
    // during the same event - they'll be batched
    asynx(() => {
      localStorage.setItem('todos', JSON.stringify(todos()));
    });
  });
  
  const addTodo = (text) => {
    todos([...todos(), { id: Date.now(), text, completed: false }]);
  };
  
  return (
    <div class="todo-app">
      <input 
        onEnter={e => addTodo(e.target.value)}
        placeholder="What needs to be done?"
      />
      <TodoList todos={filteredTodos} />
      <FilterBar filter={filter} />
    </div>
  );
};
```

## Performance Considerations

### Observable Optimization

- **Single-function pattern** is faster than tuple approach (but we have also tuple based `signal` primitive):
  ```typescript
  // rx:WP Reactivity: 1 function call
  count(p => p + 1);
  
  // Solid: 2 function calls + array access
  const [count, setCount] = createSignal(0);
  setCount(p => p + 1);
  ```

- **Batched async operations** from multiple sources:
  ```typescript
  // Without AsynX: 2 separate updates
  Promise.resolve().then(() => count(1));
  Promise.resolve().then(() => name('John'));
  
  // With AsynX: 1 batched update
  asynx(() => count(1));
  asynx(() => name('John'));
  ```

### Memory Management

- **Transaction locking** prevents memory leaks:
  ```typescript
  asynx(100, 
    [() => fetch1(), [data1]],
    [() => fetch2(), [data2]]
  );
  // Both observables locked during entire operation
  ```

- **Proper cleanup** with `cleanup()`:
  ```typescript
  observer(() => {
    const interval = setInterval(() => console.log('Tick'), 1000);
    cleanup(() => clearInterval(interval));
  });
  ```

## Conclusion

rx:WP Reactivity is the **world's most advanced fine-grained reactivity library** with:

- **Hybrid eager/lazy evaluation**
- **Complete owner/child tree structure**
- **Synchronized async operations**
- **Relative time scheduling**
- **Functional pipeline API**
- **Seamless Suspense integration**

The key innovation of AsynX is **batching async operations that are scheduled during the same synchronous execution context**, regardless of where in the code they're called from. This is crucial for:

- **Component initialization** - multiple components scheduling async operations
- **Event handling** - multiple observers reacting to a single event
- **Reactive updates** - multiple computations triggering async operations

Whether you're building a simple UI or a complex AI application, rx:WP Reactivity gives you the right tools with minimal overhead and maximum efficiency.

---

**Next Steps:**
- [Reactive Web Documentation](https://github.com/RxAI-dev/RxNN/blob/main/docs/web)
- [Reactive Transformer Architecture](https://github.com/RxAI-dev/RxNN/blob/main/docs/research/ReactiveTransformer)
- [View Transfer Protocol](https://github.com/RxAI-dev/RxNN/blob/main/docs/web/vtp)

*© 2023-2025 Reactive AI. All rights reserved.*

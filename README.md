
# rx:Web Platform
#### Next-gen full-stack UI/client-server platform
**Reactive Web Platform (rx:WP)** concept was designed about 3 years ago, now we will go back to its implementation, because it provides crucial features for seamless integration with Reactive Language/Awareness models and Reactive AI Ecosystem - **Live Server/Off-Thread Components** components. They are stateful reactive components running on server or on separate thread - environments without the DOM access. **rx:Web** abstractions like **View Transfer Protocol** are emulating DOM environment on the server/off-thread and reflecting updates on client side, with just minimal granular data transfer/update.
It includes also many breakthroughs in the performance/computational efficiency with next-gen algorithms like **Sequential Three-Way Splice**, and next-gen features, especially components pooling and re-mounting, to avoid recreating new DOM nodes.

**rx:Web Platform**, is a vision of next-gen web & native applications. It's a modular set of libraries

> **rx:WP** introduces many new features/concepts and may seem difficult to learn, at first glance. That's because it's
> a lot of new knowledge, but all these concepts are based on known standards and simple, declarative & functional
> APIs - the architecture is flexible and can be progressively adapted, all advanced features are optional.  
> The goal is to have advanced architecture, but with the simplest possible interface and the best developer experience.

The **rx:WP SDK/Integration Platform** tools and libraries are designed for **rx:View**, but many of them can also be useful
with other libraries/frameworks. That's why all parts are independent and divided into separate packages:
- **rx:View** (`@rxwp/view`) - the world's most advanced DOM rendering framework with new **View Injection** pattern - main part of the platform
- **rx:Runtime** (`@rxwp/runtime`) - reactive runtime library - low level DOM rendering
  **rx:DOM Reconcile** (`@rxwp/dom-reconcile`) - **Sequential Three-Way Splice** list reconciliation algorithm - the world's fastest and most advanced reconcile algorithm
- **rx:WP Reactivity** (`@rxwp/reactivity`) - fine-grained reactivity library - the core of **rx:View** state management and granular
  change detection. Used also in **rx:Backend** for _server-components_ and can be used as independent reactive library.
    - **rx:WP Reactivity AsynX** - synchronized asynchronous event loop for **rx:WP Reactivity** - call async operations scheduled on the same sync run or in the same time (intervals/timeouts), for batched graph update operations
- **rx:FX** (`@rxwp/fx`) - functional programming primitives and utilities
- **rx:FRX** (`@rxwp/frx`) - reactive functional programming streams, integrated with fine-grained reactivity and asynX
- **rx:Threads** (`@rxwp/threads`) - advanced multi-threading library for both browser and node server, including JS
  based async multi-threading with off-thread rendering (with _View Transfer Protocol_) and wasm-based sync
  multi-threading - the next-gen of JS concurrency
- **x:JSX** (`@rxwp/xjsx`) - **x:JSX Dynamic Template Language** SDK - customizable compiler, plugins, types (TS
  mapped types) and runtime utils - for other frameworks, **rx:View** and **rx:Compiler** are using it under the hood.
- **x:TS(X)** (`@rxwp/xtsx`) - **x:TS(X) Meta-language**, based on special types - customizable compiler, types and
  plugins - it's optional in **rx:View** (with `.x.ts(x)` extension), but built in **rx:Compiler**.
- **rx:Create** (`@rxwp/create`) - project and file(s) generator - used to generate new empty project (like CRA) or
  file(s) from simple templates (like `plop`), based on JS Tagged Templates.
- **rx:Backend** (`@rxwp/backend`) - node backend for SSR, server-components and mostly important Live Server Components, that will provide the best integration with Reactive AI real-time models
- **rx:Native** (`@rxwp/native`) - very long-term vision, the **rx:View** implementation for cross-platform mobile
  and desktop apps - however completely different, than current JS cross-platform implementations, that are based on
  running JS code in Virtual Machine - **rx:Native** apps are compiled Ahead of Time to native binaries or embedded
  wasm modules

All the compilers and CLI tools, are reading their configs from `x.config.ts` or `.x.config.ts` files (or `.js`), based
on simple, hook-like interface (instead of JSONs). Some parts are also taken from runtime config, to avoid the code
duplication. More info in the Config section.

> ##### This documentation is focused on rx:View and using the rx:WP SDK Platform with it.
>
> Generic description for other libraries/frameworks or independent usage, could be found in separate docs for every
> package/module and in the _"rx:Web Platform without rx:View"_ section.  
> Some modules will include official plugins for other libraries, like `@x-jsx/react` or `@x-tsx/solid`, but that's
> a long-term vision.

## Overview
#### Renderer basics
**rx:View** renderer is reactive, declarative & functional, and works on native DOM nodes. Its granular change detection
model is based on one of the _Observer design pattern_ variants, known as _**Fine-Grained Reactivity**_, and on reactive
DOM update micro-expressions. This concept is the next step after _**Virtual DOM**_ in DOM rendering solutions - thanks
to direct, reactive connections, between observable state and observers - "connected" with native DOM nodes (observers
hasn't DOM nodes referenced, but only DOM update expressions) - it knows exactly which elements it has to update, without
running tree diffs (excluding list/array reconciliation).  
This approach was introduced by **S.js** (reactivity) & **Surplus** (renderer), then greatly improved and popularised by
**Solid**, and connected (made by the same author) `dom-expressions` SDK platform.

**rx:View** core is also based on `dom-expressions` (custom, compatible runtime) and it's mostly inspired by **Solid**,
but it has a different goal and framework vision. It's made to be the next step after current generation of reactive
frameworks - the most advanced and the fastest implementations of standards, but still based on simple concepts and
APIs, without any boilerplate - providing the best possible developer experience.  
A lot of the framework's performance optimizations and features, are inspired by the world's fastest (but imperative)
template engine **Mikado**, but re-designed for functional architecture - to be the fastest declarative framework on
the market.

#### Architecture basics
**rx:WP** is introducing a lot of completely new features, patterns and possibilities, including the world's most
powerful View Layer Architecture - based on closures, execution contexts, declarative composition and concepts like:
- **x:JSX** - Next-Gen Dynamic Template Language
- _**View Injection** design pattern_ and advanced, 2-level **rx:View Injection System (rx:VI)**
- Closure as an instance - all view layer primitives like Components & Directives are functions, that are called only
  once, on create. Then, initialized closure acts like their "instance", existing as an encapsulated scope and execution
  context, until Component/Directive is removed (or even longer, when using Pools)
- Rich set of built-in view layer primitives, made for the best cooperation with **rx:VI**, **x:JSX** and other **rx:WP**
  features/concepts
- _Higher-order Factories_ - as all Component/Directive functions are called only once, they can act as factories for
  exactly everything - **rx:WP** introduces special, functional factories (functions creating functions), to create
  different kinds of view layer primitives, with different rendering behaviors
- Cascade Closures & Cascade Closure Services patterns - sharing service logic with multi-level closures, created on
  different execution contexts - _Higher-order Factories_ are often expecting Cascade Closures
- **rx:Pools** - concept of storing and re-using objects/expressions that are expensive in create time - mainly DOM
  elements - instead of creating new ones - could greatly decrease the number of most expensive DOM operations, but
  increase the memory usage - depending on the Pool type and the use case
    - pools could also act as explicit memory management solution - especially in environments without Garbage Collection
- Basic, Advanced and Alternative Render Modes - different variations of keyed, non-keyed and hybrid modes, based on
  most advanced and efficient algorithms, providing world's top level performance for every possible use case
- Re-mounting concept - re-mountable components and elements - over the scale performance boost, especially in shared,
  hybrid modes - re-using old (disposed) Component instances, that would be garbage collected normally, with all their
  connected DOM trees
- Pre-mounting concept - re-mountable components and elements, can be also pre-created in background (on idle) with
  some default props and stored in shared pools for re-use - i.e. list (in hybrid mode), that's using data fetched
  from server, could pre-create expected number of rows, when waiting for first response with data. Then, after
  receiving data, only re-mount (re-activate reactivity) pre-created elements, instead of creating new ones. That's
  the **world's fastest** possible way to mount the async-data based list elements.
- Move _everything/everywhere_ concept - every component and element, could be moved anywhere else in the DOM, without
  re-creating DOM nodes and component "instances" - not only within the same parent - with different built-in APIs
- **rx:Backend Server Components** - inspired by **React** Server Components concept, but with key difference -
  in **React** Server Components are just alternative one-time data fetching method, in **rx:WP** they are another
  example of Inversion of Control - they are parts of UI, completely controlled by server and **View Transfer Protocol**.
- **rx:Thread** off-thread components powered by **View Transfer Protocol**

The **rx:WP** platform architecture is made to be customizable, extendable and un-opinionated - whenever it's possible.
While I had to make some decisions (based on strong arguments), even if something looks opinionated, framework always
provides a simple way to create an own abstraction.

It's even possible to write custom, complete "higher-level" framework, with own component system, state management and
custom template DSL - using standard **rx:WP** APIs.

#### JSX/Templates basics
**rx:View** ships with its own, next-gen templating solution - **x:JSX** - the _specification compatible_ JSX, extended
with features known from Template Languages. It provides the best possible developer experience, combining flexibility,
tooling support and all the other JSX pros, with readability and simplicity (same results, with shorter code) of the
best templates (like **Vue** or **Svelte**).

> ##### x:JSX vs JSX Compilation
> The **x:JSX** compilation isn't like classic _JSX-to-JS_ transform, but it's designed as a generic JSX
> compiler extension - independent of rendering library & JSX transform - the "higher-level _(x)JSX-to-JSX_
> transform". So, it's compiled to "plain" JSX runtime - compatible with the classic, target _JSX-to-JS_
> transform, that will compile the result to its target JavaScript code, in the next compilation step.
> Then, standard JSX syntax is a part of **x:JSX** language, but the compilation is separated.

So, while **x:JSX** is a default templating solution in **rx:View**, all the JSX syntax is also supported by default,
as a part of the **x:JSX** language. The additional **x:JSX** syntax is optional. **x:JSX** is made for the best
possible developer experience, and many **rx:View Architecture** features, are designed to work with **x:JSX** (every
framework feature will work with JSX, but some will require an additional boilerplate, and some have no sense at all).

> The framework provides also 2 alternative ways to define the UI:
> - JS Tagged Templates (JSX-like string templates) - exposing `lit-dom-expressions` API
    >   - compiling templates to similar expressions, like JSX compiler, but in the browser/runtime
    >   - slightly worse performance (than JSX), the highest memory usage
>   - preferred solution, when (AoT) compilation isn't possible - faster than HyperScript version
> - HyperScript - exposing `hyper-dom-expressions` API
    >   - JS function based "template"
    >   - the worst performance and developer experience

#### TypeScript basics
**TypeScript** (TSX) is a default and recommended language in **rx:View** - that's because:
- currently most commercial projects are written in **TypeScript**, so it's a standard and the most popular solution in real apps.
- all **rx:View** features, including **x:JSX**, have a great, advanced **TS** support - then it's easier to work with them in **TypeScript**
- using **TypeScript** is considered a _good practice_ - **rx:View** is promoting _good practices_
- the highest level of compilation in **rx:View** - **x:TS(X)** - is working only in **TypeScript**,
  as it's based on special **TS** types. **x:TSX** is also default, but with optional `.x.ts(x)` extension - however
  it's just regular, compatible TypeScript, but with some additional superpowers - it could be compiled to strict **AssemblyScript**
  and then to **WebAssembly**, or directly to native binaries. **x:TSX** is also required for full AoT compilation.

**TS** support could be disabled in compiler options, but generally, if you don't want to use **TypeScript**, maybe
you'll better don't use **rx:Web Platform** at all, unless you have real reason

> ##### x:TS(X) Reactivity & Components Transform / Low-level support
> **rx:View** introduces **TypeScript** extension, based on special types, that compiles reactive
> primitives and component features, called **x.TS**. It enables **Svelte** inspired reactive variables
> and **Virtual DOM**-like component props destructuring, or even single-file-component(s) concept.  
> It's **optional and alternative** components' syntax, but it's enabled by default in compiler - it's
> just based on special `.x.ts`/`.x.tsx` file extensions, `.cx.tsx` for single-file-components and
> `.mx.tsx` for single-file-modules.  
> The **rx:View** idea, using **TS** for reactive variables, has some advantages, over other approaches:
> - type compatible by default - as it's syntax is just based on types (`let data: $let<string> = 'x.TS'`)
> - based on syntax, that's already compiled - i.e. labels are based on runtime JS syntax
> - separated compile-time and runtime code - CTF (compile-time functions) are mixing both
> - doesn't need any hacks (like `@ts-ignore`) or special tooling config (linters, etc.)
> Examples could be found in last documentation section

## Features
### Fine-Grained Reactivity & Renderer Runtime
**rx:View** creates native DOM nodes and connected observers (reactive dom expressions), that are updating DOM elements,
their props, attributes and children structure - in reaction to observable(s) state changes. All reactive primitives
from **rx:WP Reactivity** - observables, different kinds of observers (`observer`, `renderEffect`, `effect`), observable observers
(`memo`, `computed`) and reactive roots - used in the app, are connected to the _**Reactive Graph**_ structure. Thanks
to that connections, **rx:View** knows which nodes it has to update, without running diffs and touching other parts of app & DOM.    
One of the biggest differences between this reactive model and _**React-like VirtualDOM**_, is the function component's
behavior - in **rx:View** and other reactive libraries, component function is called only once, when component is added
to DOM - in **Virtual DOM** (React-like, Vue i.e. works differently), it's recalled on every update.

> ##### Efficiency
> **rx:WP Reactivity Reactive Graph update algorithm** efficiency depends only on number of updated elements - it's always **O(D)**,
> where _**D**_ is the number of traversed graph nodes in update cycle. Unlike **Virtual DOM**, it doesn't depend on
> the number of child elements and their props (typical **Virtual DOM** efficiency is **O(NP)**, where _N_ is the
> number of child elements and _P_ is the number of their props).

Renderer runtime is inspired on `dom-expressions` and **Solid**, has the same interface available and could use
`babel-plugin-jsx-dom-expressions` JSX transform, but have some important implementation differences:
- completely different, custom DOM children/list reconciliation algorithm - **STWS Algorithm** - it adds more code,
  but in complex cases, could be even 2x faster, than algorithm used in `dom-expressions` / Solid
- support for alternative, list two-way binding mode
- auto-batching all events
- **x:TSX** compiler is recommended for **x:JSX/JSX** transform - it includes the fork of `babel-plugin-jsx-dom-expression`,
  but it's using static types for the best optimized compilation - moves some runtime checks to compile time

**rx:WP Reactivity** provides also dedicated asynchronous event loop management library - **asynX**- it's
recommended for async operations in **rx:View**, because it's synchronizing graph updates. It has also features
for observables transactional updates/locks - enable skipping updates for invisible, intermediate states.
Imagine that scenario:
```typescript
const count = observable(0)

Promise.resolve().then(() => count(i => i++))
Promise.resolve().then(() => count(i => i++))
count(i => i++)
```
With native Promises, in most reactive libraries, this code will cause 3 separated graph updates. Moreover, the last synchronous
update will be just almost immediately overwritten, so it's just a waste of resources.
```typescript
asynx('asap', [() => count(i => i++), [count]]) // with observable transaction lock 
asynx('asap', () => count(i => i++)) // without lock
count(i => i++)
```
With **asynX**, both asynchronous updates will be called on the same micro-queue tick. Observable could be also locked.
In this state, it has only updated pending internal value, that's not causing graph update - thanks to it, updates in
**asynX** could access its actual value in functional update mode (in normal access - `count()`, it will return old value
that's still in graph), and it will be reflected in graph, only after unlocking, before performing asynX operation.

## View Layer Architecture
**rx:View** architecture provides rich set of view primitives, for best work with **x:JSX**, _View Injection_,
rendering modes with pools and other advanced features - with simple, boilerplate-less API based on function
composition, closures and higher-order functions. It includes a lot of different view factories, but they are
all based on Components and Directives, known from other frameworks - and that's all needed to start with
**rx:View** - its architecture is progressive and could be learned and adapted partially.

> **rx:View** is the higher-level abstraction on the lower-level **rx:Runtime Renderer**, combined with **rx:WP Reactivity** and its _**Reactive Graph**_.
>
> Graph is the single source of truth for just everything in **rx:View** app, but it's the lowest level abstraction - it
> knows only about data and all data updates (it's like the instruction how to react to data changes). **Renderer** is a
> little higher-level and handle all DOM updates, using **rx:WP Reactivity** - DOM nodes are just used as data and are updated by
> their dom-expressions.
>
> **rx:Runtime Renderer** knows only about DOM nodes, DOM updates and only the basic view elements - component and
> directive functions - it has no info about more advanced **rx:View** primitives.
>
> **rx:View** introduces _**Higher-order Factories**_, that are handling all the custom logic of advanced view primitives
> like Modules or Commands. Thanks to it all additional work and checks are handled only in components/directives that
> need it, and framework enable creating any un-opinionated custom architecture on top of opinionated **rx:View**
> primitives, that will work in the same app, with default architecture and any other custom one.
>
> All from those 3 abstraction layers, could be completely independent - i.e. **rx:View Architecture** could be
> implemented with other renderer, like **Solid**.

#### Functional Instance Abstraction
**rx:View** primitives are based on function "instance" abstraction - they are just functions, that are called
only once, when Component is added to DOM (or after connected DOM Element is created in case of directives) -
it's creating a closure scope, the instance of Component/Directive. All the variables and functions inside it
exists until Component/Element is removed from DOM. That provides native encapsulation of Component/Directive
implementation. State updates and change detection is granular - per observable state and connected observer.
_Functional Instance Abstraction_ is the foundation for other **rx:View** concepts like **Cascade Closures**,
_Abstract Dependency Injection_ and **Higher-order Factories**.

#### View Injection design pattern
**rx:View** primitives are divided into:
- _Classic_ - resolved normally, by import
- _Injectable_ - resolved by **View Injection System**, most likely by string keys in **x:JSX** - declared inside special **Module** Components

**View Injection System** is one of the unique **rx:View** features and concepts:
- the concept of dynamic, composition and context based, injection of view layer elements, like components
  or directives - thanks to **x:JSX**, declared like regular elements
- based on Inversion of Control, enables granular, surgical, modification or extension of features. Imagine
  some UI component from library like Material, and a custom case, that require changes in some internal
  components' logic (that cannot be achieved with provided API) - normally, it would require forking library
  or writing a custom solution.  With **rx:View** VI-based components, it could be achieved, just by
  wrapping the component with special provider, that's overriding one of its internal elements
- provides new way of writing generic, reusable and extendable code - with View Injection IoC, the "user"
  component (that's using provided module) is still defining the UI, but as a generic shape - its final look
  and behavior is controlled somewhere on higher level, depending on provided **Module** - special provider
  component, core of **rx:VI**, one of the IoC Containers, that's also injectable

#### Components - the core of rx:View Architecture
Most basic component looks similar to **React** function components and is similar to **Solid** components - all the
state, lifecycle and change detection is handled by **rx:WP Reactivity** primitives (without `use` or `create` prefix):
```tsx
import { observable, observer, memo, computed, effect, renderEffect, mount, cleanup, asynx } from '@rxwp/reactivity'

interface ExampleProps {
  title: string
}

/* asd */

/**
 * asd
 * @param props
 */
const Example = (props: ExampleProps): HTMLElement => {
  // Observable state
  const hello = observable('Hello')
  const world = observable('World')
  // Memoized, computed observable state (eager evaluation)
  const content = memo(() => hello() + ' ' + world())
  // Computed observable state (lazy evaluation)
  const lazyContent = computed(() => hello() + ' ' + world())
  // Lifecycle provided by different kinds of observers
  effect(() => console.log('after render: ', hello(), ' ', world()))
  renderEffect(() => console.log('during render: ', props.title))
  observer(() => console.log('before render: ', content()))
  // Additional lifecycle primitives
  mount(() => console.log('Component mounted - all DOM created & connected'))
  cleanup(() => console.log('Component unmounted - connected DOM removed'))
  // Hook example - get context data
  const theme = useContext(ThemeContext)
  
  const update = () => {
    // no need to wrap in batch(), it's done automatically in even delegation run
    hello('Welcome to')
    world('rx:View !')
  }
  
  const asyncTransactions = () => {
    asynx(() => 'Hello asynx', [v => hello(v), [hello]])
    // asynx operations are pipeable
    asynx('asap', () => world(), [v => world(v), [world]], v => console.log(v))
    hello('This 2 calls will only update observable pending values')
    world('but not cause graph/ui updates, as observables are locked for asynx transactions')
  }
  
  return (
    <section class={theme.section}>
      <header>{props.title}</header>
      <article>
        {content()}
        <button onClick={update}>Click me!</button>
        <button onClick={asyncTransactions}>Async update!</button>
      </article>
    </section>
  )
}

const App = () => <Example title="rx:View Component" />
// Could be also used as x:JSX Component, if added to app or x namespace
const XApp = () => <app:example title="rx:View x:JSX Component" />
```

In **x:TSX**, observables could be replaced with _**reactive variables**_, using special macro types. This fragment:
```tsx
  // Reactive variable
  let state: $let<string> = 'World'
  // Read-only reactive variable
  const message: $const<string> = 'Hello ' + state
  // Read in observers
  observer(() => console.log(state + ' ' + state))
  effect(() => console.log(message))
  // Simple update
  state = 'x:TSX'
  // Update depending on previous value
  state = state === 'x:TSX' ? 'World' : 'x:TSX'
  // From observable
  let num = getNumObservable() as _ as $<number>
  // Const from observable
  const obj = getObjReadable() as _ as $<number>
```
Is the same as:
```tsx
  // Reactive variable - observable
  const state = observable('World')
  // Read-only reactive variable - memo
  const message = memo(() => 'Hello ' + state())
  // Read in observers - function call without args
  observer(() => console.log(state() + ' ' + state()))
  effect(() => console.log(message()))
  // Simple update - function call with arg
  state('x:TSX')
  // Update depending on previous value - function call with update fn as arg
  state(p => p === 'x:TSX' ? 'World' : 'x:TSX')
  // From observable
  const num = getNumObservable()
  // Const from observable
  const obj = getObjReadable()
```

> ##### Base rx:View Component vs React & Solid Components
> - main difference between **React** and **rx:View**/**Solid**, is that state (observable/signal) has to be accessed
>   with getter functions, props cannot be destructured (because they are reactive proxies - they can be destructured
>   in `.x.tsx` with macros), hooks/primitives have no deps arrays and of course that the component is called only once,
>   and all updates are granular
> - difference between **rx:View** and **Solid**/**React** is that **rx:View** primitives aren't using prefixes like
>   `use` in **React** or `create` in **Solid** - it's just to write less code, they are meaningful enough in their current form
>   - in **rx:View** hooks, with `use` prefix, are higher-level concept, for built-in or custom component utils,
>     i.e. `useContext(ContextObject)` hook is based on `context(contextKey)` **rx:WP Reactivity** primitive
> - **rx:WP Reactivity Observable** is also different from **Signal** in **Solid** and state in **React**, as it's a single
>   controller function, instead of `[getter, setter]` tuple - I understand _SoC_ & _CQRS_ compatibility arguments
>   for getter/setter, but I have more arguments for single function option:
>   - **Performance** - for getter/setter tuple it's always creating additional two elements array and creating/binding
>     two functions, instead of one. Additionally, it requires destructuring or array elements access on the component
>     side. It's almost no difference for single case, but conceptually, observable/signal is the smallest and the most
>     granular part of the reactive system - a single reactive state "variable" - most common part of the application.
>     There could be thousands or even millions observables in the app, so it should be smallest and fastest as possible.
>     - The best example is `js-framework-benchmark` - create 1000 rows case needs creating 1000 observables/signals for
>       reactive `label` field. **Solid** has a great, top-rank score, but **rx:View** had TOP1 with almost (algorithms
>       made no difference for that case) same renderer, with noticeable (in milliseconds) difference, just because of
>       using single function
>   - **Memory usage** - as for performance - two functions need memory allocation for two variables/constants. Again,
>     it's no difference for single case, but it's the most common part of application.
>   - **Simplicity** - it's just less code and if we look from more abstract perspective, it's still separating read and
>     write operations - it's a single controller, but used in two possible ways - with or without arguments
>   - **Native _Two-way Binding_** - single controller concept is also compatible with two-way binding by default - for
>     components, it's just passing observable reference as a prop (instead of reading its value) - then component can
>     read or update it. For elements, like _input_, there are `bind:{property}` directives in common modules. With
>     getter/setter tuple it require more boilerplate.

**Component state** is based on **rx:WP Reactivity** observables (with memo and computed _observable observers_) - all other kinds
of component state primitives are based on observables. State updates are granular - update of one state "variable" is
not causing the component update, but is visible only for connected observers. Built-in component state primitives:
- base
    - `observable<T>(initialValue: T, equalFn?: Equals<T>): Observable<T>` - observable state "variable". Returns the
      controller function:
        - use with no args to read observable value
        - use with single argument - value or mapper function (`(prevValue: T) => T`) - to update observable value
        - could be used as reactive variable with `$let<T>` macro type
    - `memo<T>(fn: (prevValue?: T) => T, initialValue?: T, equalFn?: Equals<T>): Readable<T>` - memoized computed state -
      eagerly-evaluated observable (read-only) state derived from other state - its updates run on eager updates queue -
      before renders (with `observer()`)
        - could be used as reactive variable with `$const<T>` macro type
    - `computed<T>(fn: (prevValue?: T) => T, initialValue?: T, equalFn?: Equals<T>): Readable<T>` - computed state -
      lazy-evaluated observable (read-only) state derived from other state - as it's lazy, it's evaluated on first
      read - then it could run on different update queues
        - could be used as reactive variable with `$comp<T>` macro type
- advanced
    - `immutable<T extends object>(fromObject: T): [T, Writable<T>]` - immutable reactive proxy object, created from
      argument's object. Returns tuple with reactive state object and its update function
    - `mutable<T extends object>(fromObject: T): T` - mutable reactive proxy object
    - `reducer<T extends object, A>(fn: (state: T, action: A) => T, initialState?: T): [T, Dispatch<A>]` - redux-like
      reducer based state - return tuple with reactive state proxy and dispatch action function
    - `signal<T>(initialValue: T): [Readable<T>, Writable<T>]` - **Solid-like** observable signal tuple with getter and
      setter functions
- observables are also a base for global and context-based state solutions

> ##### Immutable data structures
> As **rx:View** and **rx:WP Reactivity** are based on functional programming concepts, observables and observers state is using
> immutable data - updating observable value is always setting new value, instead of mutating old one.
>
> Equality checks for observable, memo and computed, are enabled by default and are based on referential equality - so
> something like this will not cause the observable update:
> ```tsx
> someObservable(prev => {
>   prev.field = 'updated'
>   return prev
> })
> ```
> This update require `someObservable(prev => ({ ...prev, field: 'updated' }))`
>
> Generally, in **rx:View** app, mutations should be limited to DOM Element props and attrs (most likely in directives
> and refs) - as DOM nodes are mutable. It can lead to potential problems with concurrency and side effects, when i.e.
> multiple side effects are mutating same element props - that's why it's recommended to use a helper declarative
> abstraction for imperative, concurrent DOM element updates, in directives (more in Directives section).

**Component props** are reactive proxy (read-only) and are lazy for reactive values and children.
- accessing `props.{property}` will call getter function - i.e. for `<Component value={str() + otherStr()} />`, `value`
  prop is transformed to `() => str() + otherStr()` getter function and reading `props.value` will call that function.
  So, if `str` or `otherStr` is observable, it will be subscribed, if called inside the observer function (or in JSX).
- accessing `props.children` will call children getter function and create DOM element(s) in result - remember, that
  every `props.children` read will create new DOM element(s)
    - for same DOM element reference, children should be memoized with `children(() => props.children)` utility
- static values are eagerly evaluated before passing to component

**Component lifecycle** is based on different **rx:WP Reactivity** observers and utilities:
- mounting:
    - call component function
    - call `observer()` and `memo()` functions
    - create component DOM and append it to parent
    - call `renderEffect()` functions
    - append dynamic children of component DOM elements
    - call `mount()` and `effect()` functions
- state/props update:
    - call connected `observer()` and `memo()` functions
    - call connected `renderEffect()` functions
    - update connected props/children of component DOM elements
    - call connected `effect()` functions
- unmounting:
    - call `cleanup()` functions
    - dispose component reactivity
    - remove from DOM
- `cleanup()` functions used inside observers are called just before re-calling observer functions and on unmount

**Hooks** are functions that are providing some execution context based features (similar to **React** hooks) or just
grouping **rx:WP Reactivity** primitives and other hooks usage (like **Vue** composables). Most basic hook is `useContext()`, that's
the equivalent of the same hook in **React** and a lot of built-in features are based on context, that's also the part
of **Reactive Graph**.

Some hooks and primitives are based on execution stacks and their behavior could be different, depending on their usage
execution context - some of them could be used only in specific types of components/directives.

##### "Component as a factory", higher-order factories and advanced components
As creating a component, is just calling its function with props in untracked scope, then it could be a factory for just
anything else. **rx:View** is based on functional programming concepts, so its built-in factories, are higher-order
functions - factories for other functions, but if you want i.e. class components with reactivity based on decorators,
that's no problem to create custom factories.

By default, components are created without dedicated **Reactive Graph** node - so all the observers and utils are called
with some parent reactive scope as an owner. In most cases it's not a problem, but i.e. setting context value with
`context<T>(key: symbol, value: T)` could accidentally overwrite the context for the same key in parent component. Some
built-in features, like **Component Events** are based on `context()` primitive - then, they need components to have
their own dedicated reactive nodes. Advanced kinds of components are often created on reactive roots by **Higher-order
Factories** and their combinations.

The simplest **Higher-order Factory** is `provider()` - it just creates wrapped component on dedicated reactive root.
Example is showing some hooks, that have to be used on dedicated root:
```tsx
const initialState = { name: 'Example', updated: false }

const Example = provider((props: ExampleProps) => {
  const [state, nextState] = immutable(initialState)
  const handleEvent = event => nextState(prev => ({ ...prev, name: event.value, updated: true }))
  const resetState = () => {
    nextState(() => initialState)
    return true
  }
  // Add Component Event listener
  useListener('example', handleEvent)
  // Add Error Boundary - using error() inside provider, is the same as componentDidCatch() in React
  error(e => {
    // Handle error catched inside component's children or nested observers
    console.error(e)
  })
  // Add Component Public Ref - could be accessed by ComponentQuery from parent components or as normal declarative ref 
  usePublicRef({
    reset: ifUpdated => ifUpdated ? state.updated ? resetState() : false : resetState(),
    isUpdated: () => state.updated,
    update: handleEvent
  })
  return (
    <section>
      {state.updated ? 'Update example: ' + state.name : state.name}
    </section>
  )
})
```

Another common example is `shared()` **Higher-order Factory**, that creates component with _Service closure scope_,
shared for all component instances (with app root as reactive context):
```tsx
const Example = shared(
  () => {
    // Service - same closure scope will be injected to all component instances
    const prefix = observable('Hello')
    // Services running on same reactive context - in this case root - can communicate using "services scope"
    // Scope for given key is observable - it's returned from useServiceScope.
    const scope = useServicesScope('prefix')
    // Service could also provide inner component
    const Span = props => <span class:initial={prefix() === 'Hello'}>{props.children}</span>
    // Return component instance
    return (props: ExampleProps) => {
      // Component - component instance closure scope, with access to shared service
      const content = memo(() => prefix() + ' ' + props.name)
      return <Span>{content()}</Span>
    }
  }
)

// Could be combined with other HoF(s)
const ProviderExample = provider(Example)

// All Example "instances" have same `prefix` reference
const App = () => (
  <>
    <Example name="World" />
    <Example name="rx:View" />
    <ProviderExample name="Provider component" />
  </>
)
```

That's the example of **Cascade Closures** pattern - functions, that are returning other functions, creating different
levels of closure scopes, invoked on different time and with different execution context.  
That's also the simplest possible showcase of **rx:View _Abstract Dependency Injection_** - "injecting" closure scopes,
instead of object instances - combined with **Reactive Graph** and **View Injection**, enable same features as classic
Service Dependency Injection, but with a lot less code and without a boilerplate.

**rx:View** provides a lot of other built-in factories, like `remountable()` or `background()`, for more advanced use
cases, that will be described in next sections.

> ##### Component Events & View Query
> **Reactive Graph Context** as a part of the **Observers Tree**, is traversable in both directions. **rx:View** is
> using it for event or CQRS based components communication:
> - **Component Events** - event propagation system for components and other **rx:View** primitives, based on browser
>   events concepts, but extended with more advanced features:
>   - _listeners_ - have to be declared in components with dedicated reactive nodes (like `provider()`), with
>     `useListener<E extends ComponentEvent>(name: string, handler: (event: E, res?: Response<E>) => E | false | void,
>     mode?: EventModes)`
>     - as you can see _handlers_ could also take optional (based on event type) response callback, to send something
>       back to _emitter_. Response callback could be also called multiple times, to stream response to _emitter_
>     - listeners could be used in structural directives or modules, as they are technically components, but cannot be
>       used in element directives, as they are separate leaves of **Observers Tree**
>     - could be also declared in **x:JSX** with `$on:{event}` structural command - it will wrap JSX Element with
>       provider component, using listeners
>     - services could also listen to component events, but in read-only mode
>     - component events are **immutable** - if component has to modify event, before it's passed to next handlers,
>       it has to return new event - but event value could be observable. If it's not returning anything or returning
>       undefined, the same event reference is passed to next handlers - to stop event propagation handler has to
>       explicitly return false
>   - _emitters_ - functions used to emit events to connected _listeners_ and optionally react on response
>     - could be used in all components and directives, usage in services is limited
>     - created with `useEmitter` hook - returned emitter depends on hook args - they have the following type
>       `[name?: string, value?: () => Value<E>, response?: Response<E> | null, mode?: EventModes]` - args used on hook,
>       will be bound to result emitter, i.e. `useEmitter('test', () => 'value')`, will result with emitter typed as
>       `(response?: Response<E> | null, mode?: EventModes) => void`. Here is complete hook's type signature -
>       `useEmitter<E extends ComponentEvent, A extends EmitterArgs<E>>(...args: A): Emitter<A>`
>     - passing direct response callback is first from two available response handling methods, based on the simplest,
>       single-channel request-response pattern. Second approach is CQRS-based and is using separated response channels,
>       declared with `useEventResponse` hook - more details below
>     - directives could act as proxy between browser events and component events
>     - only module-level services could emit events, as root-level services has no parents. However, they can emit
>       _"reversed" events_, but as they emit events down the tree, they are generally not recommended, especially in
>       root-level, as it may require traversing whole **Observers Tree**
>   - _response listeners_ - special handlers, that are listening to event responses, instead of events
>     - could only be used in components with dedicated reactive nodes - using separated response channels
>     - are more flexible, but also more advanced concept - they are not limited to emitter components - when _listener_
>       will dispatch response, it will call all the _response listener_ callbacks, from _listener_ that sent response,
>       to component that dispatched event
>   - **ComponentEvent** object has `value` field (for data) and optional fields for meta-data:
>     - `filter` - control which listeners will be called, per single emission:
>       - by owner type: 'component', 'module', 'service', 'structural' or array of types
>       - by predicate - with function that takes listener owner info and returns boolean - depending on owner type,
>         it could have different info provided - i.e. modules could be identified by symbol keys or string names,
>         injectable components by string names, all components by function reference
>     - `responseMode` - control which response handlers will be used
>       - by default all handlers are used - "direct", passed to emitter and "indirect", separated listeners
>       - could be set to 'all' (same as leaving this field `undefined`), 'direct-only', 'direct-if-provided',
>         'indirect-only' and 'indirect-if-provided'
>     - `emitLevel` - control number of traverse levels - in other words, control where the propagation will be stopped,
>       from _emitter_ level - especially useful for 'reversed' modes
>     - as events could be mapped to new events on _listener_ handler level, the meta-data fields could be also modified,
>       i.e. initially `filter` is set to 'module', but one of modules is changing it to 'component'
>   - **Event Modes** - component events could work in different modes - 'bubbling' and 'capture', as browser events,
>     but also additional 'reversed' and 'reversed-capture':
>     - _listeners_ are by default added as 'bubbling' listeners - they run also in 'reversed' mode - it could be
>       changed with third argument to `useListener`:
>       - 'capture' to run in 'capture' and 'reversed-capture' modes
>       - 'bubbling-only' and 'capture-only' to skip reverse modes
>       - 'reversed' and 'reversed-capture' to run only in reversed modes
>     - _emitters_ will by default run 'capture' first and then 'bubbling', but it's optimized to skip 'capture' loop,
>       if there's no any 'capture' listener for given event - it could be modified with last emitter argument, that's
>       a little different, than for _listeners_:
>       - default, 2-step behavior has value with ':' separator - 'capture:bubbling'
>       - so, reversed 2-step is 'reversed-capture:reversed'
>       - to run single step only, just use single mode string
>       - custom, alternative emit mode combinations are also possible, but rather not recommended, because they can
>         lead to strange, uncontrolled behaviors - i.e. 'bubbling:capture'/'capture:reversed:reversed-capture:bubbling'
>     - 'reversed' modes are not recommended - they are made for rare, advanced use cases - if they have to be used,
>       they should be optimized with `emitLevel` event property or with returning false from handlers, otherwise, they
>       could "kill the app performance"
>       - that's because 'reversed' modes traverse is not linear as standard modes (child -> parent) - it has to visit
>         all emitter's owned nodes and all their owned nodes, etc. (parent -> children)
>       - **Component Query** provides similar behavior to 'reversed' modes, but is better optimized and should be
>         preferred option
>   - all the component event delegation process is auto-batched, including _response handlers_ - so if emitted event
>     is causing DOM updates, they will be run after all accumulated state updates from handlers
> - **View Query** - context and ref based components communication API for "queryable" refs
>   - based on public refs - available only in components with dedicated reactive nodes, directives and modules (which
>     themselves are implicit public refs)
>   - DOM elements could be connected to **View Query** system with directives - like built-in `ref:publish`
>   - public refs are created with `usePublicRef` hook or more granular, specialized hooks - `useGetter`, `useSetter`
>     and `useMethod` - however, they are working on standard ref by default, so `usePublicRef` is required anyway,
>     to make ref public, but it may be used without args
>   - by default, public refs are identified by view factory function references, string keys for injectable/namespace
>     elements, symbol and string keys for modules and DOM element name for `ref:publish` directive - alternatively,
>     they could have custom string/symbol key attached
>   - public refs could be used as normal, explicitly attached refs
>   - both refs and public refs could additionally forward ref to any DOM element, using `useForwardRef` hook - it will
>     be available on special '$$dom' ref property - in case of **View Query**, refs with connected DOM (including
>     ones from directives) enable CSS Query Selectors inside View Queries
>   - same as for refs, public refs could be imperative or declarative, but even imperative (component) refs are
>     immutable and read-only - data reads are handled by getters and updates by setters or methods, so it has no
>     classic, mutable properties
>     - imperative refs are standard objects with methods (and proxy-like properties), that could be called imperatively
>     - declarative refs are based on actions - with simplified single-channel request-response model or multichannel
>       CQRS model, with separated response handlers
>     - however, it depends on ref consumer, rather than provider - method/property keys from `usePublicRef` or
>       specialized hooks, will be used as action type in declarative mode - arguments will be action payload and
>       returned value will be passed to response callback - framework will implicitly create ref action handler, if
>       any declarative ref will be connected
>   - published refs are resolved with **View Queries** from parent scope - using `useViewQuery` hook:
>     - view queries can be lazy or eager, depending on `useViewQuery` arguments:
>       - without arguments, it returns lazy query handler - it's used on-demand, at anytime
>       - with argument(s), it returns observable eager query result - empty on init, as there aren't any children
>         rendered yet - query will be evaluated, when first matching result(s) become available
>     - queries are partially based on DOM Query (CSS) Selector syntax, but with tagged templates - it could use
>       string keys or interpolations for symbol keys, function references and filter functions. Available syntax:
>       - parent-children combinators - space for any level children and ' > ' for first level children
>       - child-index - CSS-like modifiers - ':first-child', ':last-child', ':nth-child(i)' and ':nth-last-child(i)'
>       - element-index - ':first-of-type', ':last-of-type', ':nth-of-type(i)' and ':nth-last-of-type(i)'
>       - sibling combinators - ' + ' for next sibling, ' - ' for previous sibling, ' ~ ' for all next siblings,
>         ' ~~ ' for all previous siblings
>       - OR modifier - ' | ' - parts of query could work on multiple selectors, thanks to OR modifier
>       - strict modifier - '&' prefix - by default queries are working on public refs relationships, i.e. ' > '
>         will match first public ref, that is direct child of another public ref - it could be more strict and work
>         on observer level - so in first-level child example, it will match public ref only if it's inside first child
>         observer of other public ref observer. '&' should be used as combinators/pseudo-class prefix, i.e. '&>' or
>         ':&first-child'
>       - ALL modifier - '\*' - by default, query is finished after first match - it could be modified with '*' prefix,
>         to select all matching refs
>       - VQ - DOM/CSS switch - ' >>> ' - switch from **View Query** to **DOM/CSS Query Selector** - only if matched
>         public ref includes '$$dom' property

#### Remountable components
**rx:View** remountable components are the breakthrough in frontend performance. The most expensive part of frontend apps
is creating and rendering DOM elements. Components instances initialization is also additional cost. Remountable components
of the same type are not completely removed, but only their reactivity is deactivated, and they are stored in pool for
re-use. When new component of the same type should be created, it's taken from pool instead of creating new instance, props
proxies are connected to new observables, then state and reactivity is activated with new values. Thanks to it, all the
component DOM tree is not recreated, only dynamic values are modified and re-rendered in DOM. The special requirement
for that components is that all the dynamic view have to be based on reactivity and all the state must be reset on re-mounting.
It's handled in special `remountable()` higher order factory:
```tsx
import { remountable } from '@rxwp/view'
import { observable, effect, memo } from '@rxwp/reactivity'

interface ExampleProps {
  id: string;
  content: string;
  initialTags: string[];
}

declare const tag: string; // required declaration for x:JSX template variable
const Example = remountable(() => {
  // First level closure is called once, when the new remountable instance is created
  // It's for state observables initialization (without props/values)
  const heading = observable<string>('')
  const description = observable<string>('')
  const tags = observable<string[]>([])
  const isUpdated = observable(false)
  
  return [
    (props: ExampleProps) => {
      // First from second level closures is called on every re-mount with props - it's for state re-initialization
      heading(`Header for id: ${props.id}`)
      description(props.content)
      tags(props.initialTags)
      isUpdated(false)
    },
    (props: ExampleProps) => {
      // Second closure is a component itself - it's called only once, when remountable instance is created
      const filteredTags = memo(() => tags().filter(tag => !tag.includes('Restricted')))
      
      const updateContent = () => {
        heading('New updated heading')
        content('New updated content')
        isUpdated(true)
      }
      
      // Example with x:JSX/x:TSX
      return (
        <div class:active={heading().includes(props.id)}>
          <h1>{heading()}</h1>
          <p>{description()}</p>
          <ul>
            <li $:for={(tag as let$) in filteredTags()}>{tag}</li>
          </ul>
          <button $:if={!isUpdated()} onClick={updateContent()}></button>
        </div>
      )
    }
  ]
})
```

#### Directives - readable flow control and reusable/shared common behaviors
**rx:View** and **x:JSX** has 2 kinds of directives, with more advanced subtypes, both are runtime based and could be
custom - in fact, "built-in" directives from _Common Modules_, like `$:for`, `$:if/$:elseif/$:else`, are created
like any other custom directive:
- Element Directives - standard directives, connected to single DOM Element - could modify its props and attributes
- Structural Directives - flow-control directives, connected rather to JSX Element, than DOM Element - could modify
  DOM structure
    - Structural Directive Sequences - sequences of some specific structural directive groups or same directives,
      attached to sibling JSX elements. Most common example is `$:if/$:elseif/$:else` from _Common Modules_. Sequences
      are recognized by compiler by special pattern. More details in Structural Directive Sequences section

> ##### rx:View Element Directives vs `dom-expressions` Directives
> `babel-plugin-jsx-dom-expressions` and **rx:View** `dom-expressions`-like runtime already have directives, used
> with `use:{directiveFunction}` syntax in JSX, but they are limited and unoptimized:
> - all directives are separated and not connected with props - `dom-expressions` compiler is optimizing props/attrs
>   updates, by running them on single effect, but every directive is updating DOM props/attrs separately, on dedicated
>   (render) effect and has no connection with other directives attached to the same element
> - then, `dom-expressions` directives could potentially add a lot of additional reactive nodes
> - second problem is that directives could update same props/attrs, as other directives or regular props,
>   and the only way to detect that some prop was changed is by using _MutationObserver_ - IMO bad idea in the
>   reactive framework
> - third potential problem is with events - directives could add multiple native event listeners for the same
>   event and handle all updates from handlers in separate batches
> - directive functions are 100% impure, with unsafe side effects - unlike safe side effects, that are updating
>   observables, unsafe side effects in `dom-expressions` directives are mutating DOM elements
> **rx:View/x:JSX Element Directives** are far more advanced, solve all those issues, are extremely optimized and even
> have full declarative API:
> - they are compiled to single low-level `use:directives` injector, that creates shared scope for all directives
> - compiler is also removing props/attrs from JSX element and passing them to `use:directives` injector
> - instead of mutating DOM element in dedicated effects, directives have to return declarative element update
>   expressions - functions that are listening to observables and returning atomic DOM property/attribute update
>   callbacks
> - all props/attributes updates - from regular props and directives - are handled in single render effect, with micro
>   diff, to use only callbacks connected with update
> - DOM element mutations are calculated with advanced transaction algorithm and committed once, after all update
>   handlers completed - handlers have access to frozen (previous) prop value, actual next prop value to set and
>   cached (last) prop value per directive and returned result is set as next prop value and new cached value
> - directive could use invalidators to react on connected props/attributes changes from other directives
> - updates order could be controlled with DOM update priority - the highest priority update callback is called last,
>   regular (no-directive) prop updates have the lowest priority - `0`
> - event listeners could be shared by directives and handlers from props - they also run on single batch and use
>   event delegation for compatible events
> - **rx:View Directives Composition** provides advanced communication between same-element directives, based on
>   directives scope concept
> - unlike `dom-expressions` directives, **rx:View** ones can be used on components, but it's the component decision
>   if it will do anything with it - it could modify and/or forward directives, as well as access their scope

Example with both directive kinds declaration and usage (**x:JSX**) - with `$:if/$:elseif/$:else` sequence:
```tsx
const classPrefix = directive((element: Element, value: () => string) => {
  const prefix = observable('x-view')
  
  useDirectivesScope('prefix', 'updatePrefix', p => prefix(p))

  return {
    className: [() => prefix() + '.' + value(), updated => (prev, next, cached) => updated]
  }
})

const repeat = structural((children: (item: number) => JSX.Element, value: () => number) => {
  return memo(() => Array.from({ length: value() }, (_, i) => children(i)))
})

const namespaces = initNamespaces({
  app: {
    repeat,
    class: classPrefix
  }
})

// Connect TS Types for x:JSX
type AppNamespaces = typeof namespaces

declare namespace xJSX {
    interface Namespaces extends AppNamespaces {}
}


declare const index: number
export const App = () => {
  const header = observable('Hello world')
  return (
    <main app:class="main">
      <h1 $:if={header() === 'Hello world'} app:class="h1">App Header: {header()}</h1>
      <h2 $:elseif={header() === 'rx:View'} app:class="h2">Welcome to: {header()}</h2>
      <h3 $:else app:class="h3">Goodbye: {header()}</h3>
      <ul app:class="list">
        <li $app:repeat={10} let$:item={index} app:class="list-item">
          {index + 1}. List item
        </li>
      </ul>
    </main>
  )
}
```

As you can see on example, **Structural Directives** are used with `$` prefix in **x:JSX** - that's the only unique
symbol to distinguish between Element and Structural directives. In fact, **Structural Directive** is a special kind
of component, that always have function as a children. Special `let$:` command is used to get access to arguments of
that function (`let:` command, without `$` suffix, is used for the same purpose in **Component Slots**):
- `let$:item` for the first argument of function
- `let$:index` for the second argument of function (index is often a second arg for loop directives)
- `let$:args=[arg1, arg2, arg3, ...args]` to use all arguments at once and any number of arguments
- `let$:{key}` - to get access to field of first argument object
    - i.e. for `(item: { a: string, b: string, c: number }) => JSX.Element` children function it will be `let$:a={a}`,
      `let$:b={b}` and `let$:c={c}`
- all kinds of syntax accept any destructuring

As **Structural Directives** are compiled to components, with their connected element as a result of a children
function (check example below), the rule is that only one **Structural Directive** can be attached to JSX element.
However, special **Command Directives** can break that rule - more in **Commands** section.

**Element Directives** are used just like element attributes, but they are not the same as `use:{directive}` directives
from `dom-expressions` - they have additional features like directives scope and are resolved with **View Injection**,
by their string keys.

Both directive types can have props as optional, third argument to their functions (as getter function) - passed using
`($){module}:{directive}Props={{ ...propsObject }}` syntax

**Structural Directives** are working on JSX element level (before DOM element is created), so it's no difference if
they are attached to elements or components. **Element Directives** are working on DOM elements, so they have to be
attached to native DOM elements - it's possible to attach **Element Directive** to component, but that component has
to explicitly forward attached directives to some element, with `useDirectives()` hook and `use:directives` low-level
injector directive.

> According to above description, this fragment of **x:JSX** code:
> ```tsx
>  <li $app:repeat={10} let$:item={index} app:class="list-item">
>    {index + 1}. List item
>  </li>
> ```
> is compiled to following JSX:
> ```tsx
> <$$structural module="app" name="repeat" value={() => 10}>
>   {(index) => (
>     <li use:directives={[{ module: 'app', name: 'class', value: () => 'list-item' }]}>
>      {index + 1}. List item
>     </li>
>   )}
> </$$structural>
> ```
> - `$$structural` is a low-level injector component for structural directives
> - `use:directives` is a low-level injector `dom-expressions` directive for element directives

As you can see, using **x:JSX** and **Directives** can simplify template JSX code a lot, especially **Structural
Directives** and **Structural Directive Sequences** could greatly reduce the number of nested JS in JSX expressions.

> ##### Directives lifecycle
> Both kind of directives are created same way as components - their function is called just once, on untracked reactive
> scope (by default, without dedicated **Reactive Graph** node) - creating closure scope "instance" in result. It means
> that directives have also the same lifecycle as components, based on **rx:WP Reactivity System**, the only difference
> is when they are created:
> - **Structural Directives** (and sequences) are called before connected JSX element is initialized and then deciding
>   how and when that element is created/rendered (they have lazy access to connected JSX element, as it's passed as
>   function)
> - **Element Directives** are called after connected DOM element is created (they have eager access to DOM element)
> - other lifecycle is the same:
>   - `effect()` is running on connected state updates, after the render phase
>   - `mount()` is called once, after first render phase (all DOM is created and connected)
>   - `renderEffect()`  is running on connected state updates, during the render phase
>   - `observer()`  is running on connected state updates, before the render phase
>   - `cleanup()` is called once, on unmount
>
> Same as **Components**, **Directives** could be also combined with **Higher-order Factories**, like `shared()` or
> `provider()` - however, `provider()` is less usable for **Element Directives**, as they don't have children

Ok, that are the basics - **rx:WP Reactivity primitives, Components, Directives, some x:JSX basics and Higher-order Factories**.
Now it's time for more advanced concepts - starting from deeper dive into **View Injection System**!

#### Modules - the heart of the View Injection System
Modules are most advanced view layer primitives - they are special kind of **Components** and **View Controllers**.
Like it's suggested by the name, modules are containers for other view elements and are grouping some connected
features. But unlike in _"Inner Components"_ pattern, where inner components are available only inside owner component
scope, module inner members are provided with context and resolved with view-injectors, by module key and member name.

Module components has no own UI - that's because they are often resolved dynamically, as other module dependencies,
without explicit usage in JSX. They are just forwarding children - with module members provided - so, module
components or directives could be used only inside module component children.

However, while Modules are IoC Containers for view elements, they are also injectable and resolved dynamically by
module-injectors - because of that, the **View Injection System** has 2 levels:
- Module Injection - on first level, system is injecting/resolving modules from app root or override containers, based
  on _string names to symbol keys_ mapping
- Module Members Injection - on second level, system is injecting/resolving components/directives/other elements from
  provided module or override container

> ##### Static, nominal & runtime-based typing, inheritance and polymorphism implementation
> While in **x:JSX** it looks like Modules are resolved by string names, in fact they are resolved by symbol keys and
> mapping from string names to symbol keys. Module functions has own type symbol keys - connected with TypeScript type
> of module provided elements. Modules can also extend one or more other modules - they have saved inheritance chains,
> made from symbol keys.
>
> The one and only single source of truth for mapping string module names to module keys is the app root container -
> for TypeScript types to be inferred once for all the app and because app root container has O(1) access. Then, when
> module for given string name is requested by module-injector or module member is requested by view-injector, injector
> is getting the symbol key for that module name and is resolving module/element for that key.
>
> If some module has module for given key in its inheritance chain, then it could be provided as extended module. By
> default module factories are provided in app root container, but also the abstract modules - only the symbol key and
> corresponding TypeScript type - could be declared in modules map and then implemented by dynamic modules. Modules
> could be also provided in special Override IoC Containers.
>
> Modules could extend other module(s) statically (inheritance-like) and dynamically (composition-like), or could
> implement other module(s) instead:
> - static inheritance-like extension - extended modules are provided, created and resolved by extending module, before
>   creating module "instance" - then, it's known during development, which concrete module will be extended
> - dynamic composition-like extension - extended modules are resolved dynamically from **View Injection Containers** -
>   so first higher-level parent module, that has declared module key in its inheritance chain, is used as a base - so
>   it isn't known which module will be extended - only its type is known in development
> - module(s) implementation - implementing module has no access to implemented modules, only adds key to self
>   inheritance chain and has to provide type-compatible factories
>   - abstract modules can only be implemented, as they don't have implementation/factory
>   - implementing non-abstract modules is the full override and all members have to be implemented (could be
>     implemented "implicitly", with **Proxy-module/Module Commands**)
>
> Following that advanced "instance" abstraction, **rx:View** provides special, module-scope commands:
> - `this:{name}` to quickly resolve module's own view factories (i.e. `<this:main $this:repeat={10} />`)
> - `super:{name}` in extending modules, to quickly resolve parent/extended modules members (i.e.
>   `<super:main super:directive={value()} />`)
>   - combined with `as:parent={ParentModule}` could resolve elements of any concrete module from inheritance chain
> - all members could be also accessed with `const { $this, $super } = useModuleScope()` hook
>
> Additionally, modules can specify its dependencies and auto-resolve them - and if it's using different string names,
> i.e. if module is from external library, it could provide mapping between application module names and library names

Example with different kinds of module extensions (using only basic components and directives):
```tsx
// Base module - no extensions
const base = rxModule(() => {
  const title = observable('rx:View')
  const message = observable('Hello world')

  const header = component(() => {
    const subtitle = observable('Module example')
    return (
      <header>
        <img this:logo />
        <h1>{title()}</h1>
        <h2>{subtitle()}</h2>
      </header>
    )
  })

  const logo = directive((el: HTMLImageElement, v: () => boolean) => {
    renderEffect(() => (el.src = v() ? 'logo.png' : ''))
  })

  const main = component(props => {
    const content = memo(() => `Welcome to ${title()}! ${message()}`)
    return (
      <main>
        <section>{content()}</section>
        <section>{props.children}</section>
      </main>
    )
  })

  return { header, logo, main }
})

// Module copy - static extend, without any overrides
const copy = rxModule(undefined, { extend: base })

// Dynamic extension - `base` module has to be in scope + one additional member and `super:` usage
const page = rxModule(() => {
  const author = useContext(AuthorContext)
  return {
    footer: component(() => {
      return (
        <footer>
          <img super:logo />
          {author()}
        </footer>
      )
    })
  }
}, { extend: { module: base, dynamic: true } })

// Module with dependencies and dependency key mapping
const main = rxModule(() => {
  const home = component(() => {
    return (
      <main class:home>
        <app-page:header />
        <base:main>
          <article>Example App</article>
        </base:main>
      </main>
    )
  })
  return { home }
}, { use: { 'app-page': page, base } })

// Proxy module - returns commands handler function instead of members map
const prx = proxyModule<ExampleProxy>(
  () => is => cmds => {
    switch (is) {
      case 'component':
        return cmds.home ? () => (
          <div>Home</div>
        ) : () => (
          <div>Proxy Module!</div>
        )
      default:
        throw Error('Not implemented!')
    }
  },
  { implement: main }
)

// Abstract module - only symbol key and TypeScript type
const dyn = abstractModule<ExampleAbstract>()
// Multi-extended abstract module - has additionally symbol inheritance chain
const dynExt = abstractModule<ExampleExtendedAbstract>({ extend: [dyn, main] })

// Abstract module implementation with extension
const impl = rxModule((props: { values: any[] }) => {
  return {
    repeat: structural((children: (v: any, i: number) => JSX.Element, value: () => number) => {
      return memo(() => Array.from({ length: value() }, (_, i) => children(props.values[i], i)))
    })
  }
}, { implement: dyn, extend: copy })

// Multi-extended abstract module implementation
const extImpl = rxModule(shared(() => {
  const defaultValue = 'DEFAULT VALUE'
  const homeContent = observable('Implemented Home Content')
  return (props: { values: any[] }) => {
    const updateContent = i => homeContent('Update from: ' + i)
    return {
      repeat: structural((children: (v: any, i: number) => JSX.Element, value: () => number) => {
        return memo(() => Array.from({ length: value() }, (_, i) => (
          <div>
            <button onClick={updateContent} onClick:bind={i}>
              {children(props.values[i] || defaultValue, i)}
            </button>
          </div>
        )))
      }),
      home: component(() => <div>{homeContent}</div>)
    }
  }
}), { implement: dynExt })

// App modules declaration - the single source of true for modules string key-symbol mapping
const modules = initModules({
  base,
  copy,
  page,
  main,
  prx,
  dyn,
  ext: dynExt
})

type AppModules = typeof modules

declare namespace xJSX {
    interface Modules extends AppModules {}
}

const showPrx = observable(true)

const App = () => (
  <modules:copy as:base> // copy injected and provided as base - page needs it as dynamic dependency
    <modules:page>
      <modules:main>
        <main:home /> // module component usage
      </modules:main>
      <modules:prx as:main $:if={showPrx()}> // proxy conditionally injected as main
        <main:home />
        <modules:use as:dyn={impl} as:ext={extImpl} values={['a', 'b', 'c']}> // dynamic injection - use is reserved keyword
          <ext:home $dyn:repeat={3} /> // module structural directive usage
          <page:main $ext:repeat={5} />
        </modules:use>
      </modules:prx>
      <modules:use as:main={extImpl} $:else> // dynamic injection as non-abstract module
        <main:home />
        <modules:use // override single view factories 
          as:use={{
            'page:logo': current => directive((el: HTMLImageElement) => current(el, () => false)),
            'base:logo': current => directive((el: HTMLImageElement) => current(el, () => true))
          }}
        >
          <img page:logo base:logo={false} /> // 
        </modules:use>
      </modules:use>
      <page:footer />
    </modules:page>
  </modules:copy>
)
```

While modules are components, they are also shared execution context for its members, so they also act as service
scopes. Modules could also have shared service scope for all instances, created with `shared()` factory, as for other
view primitives. However, shared services of module members are created with module root as reactive context, instead
of app root - it enables different combinations of provided service scopes and makes "Abstract Dependency Injection".

#### Commands - super-power ones
**rx:View Commands** are special view primitives, that could be used as any other primitives, without any limits. In
fact, **x:JSX** is a _"dynamic"_ template language and is all made from just 4 types of **x:JSX Commands**, that all
have the same, JSX Namespaces-based, dynamic syntax - `{commandName}:{argumentName}` or
`{commandName}:{argumentName}={argumentValue}`:
- Component commands - `<command:component {...props} />`
- Directive commands - `<div command:directive={value()}` />
- Structural commands - `<div $command:structural={value()} />`
- Compiler commands - special compiler commands `slot:{slotName}`, `let:{variableName}` and `let$:{variableName}`

**rx:View Commands** are 100% dynamic - same command could be used as a component and as a directive. They allow also
breaking one structural directive per element rule - same structural command could be used many times on the same
element, but with different arguments - it allow emulating multiple structural directives.

Normally, commands are resolved from app root container, but they could be also provided as modules - using special
**Proxy-module Commands**, and **Modules** can also provide own **Module Commands** - they have same name as module.

There are different types of commands, based on the use case:
- **Component/Directive/Structural Commands** - standard commands used as components, directives or structural
  directives
- **Modifier Commands** - special directive/structural commands, that have no access to connected element, but are
  used to modify behavior of other directives:
    - **Pre-connect Commands** - called before any other directives, with access to all directives attached to element,
      and their props - could modify directives declarations/props before they are used and provide scope data
    - **After-connect Commands** - called after all other directives, with access to directives scope
    - **Static Commands** - commands without a function, only providing data, that other directives can use
    - if modifier commands are attached to element that has element directives and structural directive, they are passed
      to both `use:directives` and `$$structural` injectors and are available in both structural and element directives
- **Module Command** - command provided by the module - has the same name as the module
- **Proxy-module Command** - command provided as the module - could, i.e. act as some module - command handler will
  be called everytime some module member is requested
- **Multi Commands** - commands that are combinations of other command types, with single, generic handler

#### View Transfer Protocol, **rx:Backend** live server components and **rx:Thread** off-thread components
The _View Transfer Protocol_ defines compilation & serialization format for **rx:View** primitives and corresponding data,
and how to transfer it between non-DOM environments, like live server or Worker threads, as well as common safety and
performance restrictions:
- Compilation:
    - regular, client-side **rx:View** component's templates are compiled to DOM templates and JS expressions, responsible
      for creating DOM elements from those templates and connecting it with **rx:WP Reactivity** system, by **rx:View** DOM
      runtime - called `dom-expressions`
    - but server-side and off-thread components have no access to DOM API - instead, they are compiled to serialized format:
        - DOM templates are just strings, so they are same strings as for client-side components
        - `dom-expressions` are compiled to string 'hydrate expressions', that will be executed as functions, with observable
          data to connect, as arguments
        - dynamic data connected with templates/expressions, is passed to server/off-thread side functions, that are
          serializing them and their updates
        - AoT client-side code compilation is also creating pre-compiled HTML, 'hydrate expressions' are closer to 'component
          expressions' and are statically connected by compiler, to DOM rendered from pre-compiled HTML
        - optionally (on-demand), server and off-thread component's templates are compiled also to JSDOM object format, to
          allow emulated DOM operations (that could be then committed to client, but it's not recommended)
- Serialization:
    - first and most important step of serialization, is also performed by compiler - all the app code is analyzed and all
      common string templates (all server/off-thread + not-unique client templates) and expressions, are saved in template
      pools, with keys based on their encoded content - then, all the pools have to be delivered some way to client, using
      different strategies, for different use cases - and templates and expressions are then transferred just as a keys
        - in case of safety, it ensures that only components created by compiler, will be accepted by client-side code - it's
          especially important, as it's based on executable expressions transfer - however, we still need to ensure, that
          initial pools transfer is as safe as possible
        - in case of performance, it leads to transferring smaller string keys, instead of full templates and expressions,
          and client has immediate access to it - it's also reusing same templates for non-client components, that have
          same/similar UI
        - as templates/expressions are just strings - that are most-likely changed, during compilation, so they should be
          the same for the same app versions - template/expression pools could be cached on the client-side, using i.e.
          IndexedDB and loaded just once per app version
    - connected dynamic data variables, are serialized in runtime and transferred in initial 'create' call. Then, on
      updates, only granular, single data updates are transferred to client
    - event handlers are serialized to their callback endpoint
    - other server/off-thread components are initialized on their environment, and their result is transferred with
      parent server component on 'create' - then, their updates/events are handled on separate channel
    - client components/resources (explicitly shared by client) are serialized to corresponding client-side keys
- Transfer:
    - as mentioned before, first step is to transfer pre-created template/expression pools from server to client - it's
      potentially the most dangerous _VTP_ part, as it contain serialized code, that will be evaluated by JS engine, so
      it should be the most secured part of client-server communication.
        - fortunately, this part won't be regularly invoked - those pools will be cached on client-side and consequently
          transferred only once per components compile version - that is, when app is re-compiled and deployed, it has
          exactly the same keys for templates/expression, that wasn't changed during compilation - so it has to transfer
          only updated parts of pools
    - first, initial request for server/off-thread component is the 'create' call:
        - client is sending request, either by Https or Worker `postMessage` interface (hidden under **rx:Thread**
          abstraction), with serialized props in request query params (GET) or body (POST)
        - server/worker thread is sending a response, with all its templates and expressions keys, connected, serialized
          data and the address and protocol (like WebSockets or Https), to listen to 2-way updates
        - client is creating observables for serialized data, pass them to expressions to connect them with templates and
          DOM
    - after server/off-thread component is created, it's connected with client - send updates and listen for requests:
        - client can request server/off-thread component update, by changing props or reacting to DOM events - serialized
          data is sent and is causing update of graph on server/off-thread side
        - server/off-thread component can send serialized granular updates - **only the changed fields** - it's causing
          only granular UI updates, same like regular client side components
    - _VTP_ isn't defining connection type (like Http, WebSockets, Worker `postMessage`, etc.) - it depends on environment


##### rx:Backend Live Server Components and Reactive AI Ecosystem integration
Generally **rx:Backend** Live Server Components are looking and working the same as regular components - that's completely
different from server components in React. They are stateful and persistent - they are creating new reactive graph on the
server side and has dynamic reactive updates there. They enable a lot of new patterns, especially backend components shared
between multiple users/sessions. It could in example enable live server based multi-user chat - server component is responsible
for the UI and state - different users are making requests and updating single component state, that is then reflected same
way on each user's UI.

> #### Reactive AI Ecosystem Integration
> Live Server Components are one of the main reasons that I'm re-thinking rx:Web Platform again, 3 years after it's vision
> development. Currently, I'm working on new next-gen Event-Driven AI architectures, that are introducing real-time processing
> and memory systems to language models. Reactive Language Models are always processing only single interactions - query and
> answer, instead reprocessing full chat history everytime like LLM. They are moving all the context to specialized Short-Term
> and Long-Term Memory layers, updated between interactions (not between tokens, like in Recurrent Neural Networks). That
> type of stateful processing is resulting in N times faster and cheaper inference than for LLMs, when N is the number of
> messages in conversation. However, it has new challenges for stateful processing in cloud/server environment - loading
> and using different memory states for user's requests.
>
> That's the ideal use case for the **rx:Backend Live Server Components**:
> - server component will be initialized for some number of active users, based on model batch size
> - it will load the Reactive Language Model and set batch size for connected active users
> - when users will join, it will load Short-Term Memory states from some persistent database and save them in its reactive state
> - when users are sending requests, server component is loading STM state for given users (for some windowed/batched requests) and calling models with updated memory
> - live server component could then return separate UI for each user, updated with new conversation values
>
> Generally, that concept requires a lot of work, but I think that it's one of the best ways to handle stateful reactive
> models in real-time in cloud/server environment

Example Reactive Model Live Server Component (simplified)
```tsx
declare const message: Observable<[type: 'query' | 'answer', message: string]>
const ReactiveChatServer = backend(shared(() => {
    const rxlm = rxCloud.loadReactiveModel('model-id', { batchSize: 16 } )
    const windowMs = 1000
    const userInputs = observable<[id: string, query: string, memory: UserStm][]>([])
    const lastEmittedTokens = observable<[id: string, token: string][]>([])

    let lastCallTime = 0

    observer(() => {
        if (userInputs().length >= 16 || performance.now() - lastCallTime >= windowMs) {
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

That's of course the most basic example but is showing most important concepts of Live Server Components and integration with Reactive Language Models. Some important details:
- combination of `bind:server` and `onClick:server-bind`, is used to limit server communication for UI only calls - input will be two-way bound only on client side, so typing in input will result in immediate, client side only updates. It's the connected with server-bind event modifier, that will not only call the initInteraction event with last value of client side inputData observable, but will also reset it's value to it's initial state, for next interactions - so after the event, it has the same initial value as on the server. On the other hand, while the two-way binding is client-only, the server side modification to `inputData` observable will be propagated to UI as new value. So, the server could modify client bound observable, but it cannot send back data to server. Then, it should be used carefully - it's made mainly for the cases like this, when keeping input state on the server is a non-sense, and if possible, that observable should not be modified on server
- we have to develop Reactive Cloud library, that will integrate the models with rx:Web runtime - but it looks like nice, simple integration now
- example doesn't handle the cases, when some user inputs are incoming when model is generating answers - but it shouldn't be hard to add - now it's just an example
- it's not used in this example, but Live Server Component could resolve by import only other server components. When they have to resolve client side component, they should use x:JSX and View Injection expressions

Example is also showing how all the rx:Web features are connected to provide the best possible Developer Experience:
- almost exactly the same syntax on the client and on the server
- Abstract Dependency Injection with `shared()` cascade closure provides the ideal solution for global inter-component state - it's so powerful, while it's only the simple function/closure and it's implementation could be very simple
- x:JSX directives are simplifying view a lot - all the ugly nested JS expressions are just removed and view is clear and readable

### Rendering Modes & Strategies
**rx:View** and its **DOM Runtime** are introducing rich set of rendering modes, strategies, optimizations and concepts,
to provide the best possible performance, control and productivity, for every possible use case. The most important
concepts are:
- Algorithms - base, ultra efficient **STWS DOM Reconcile Algorithm**, combined with dedicated algorithms for different
  rendering modes (combined with different strategies) - all modes have some performance/dx differences
    - non-tracked - strict re-create/static mode - using just regular `array.map()` - if list is dynamic, all elements
      are re-created on every iteration, as they are not memoized anyway - should be rather used for static arrays
        - `$for:static={list}` directive run always in untracked context
    - basic keyed and non-keyed algorithms are commonly known, however, **rx:View** has two different keyed modes:
        - implicit - elements tracked by their data item reference, same as in i.e. **Solid**
        - explicit - elements tracked by explicit key, useful for immutable data - i.e. from API. Similar to VirtualDOM
          keyed mode, but working completely different - keyed element fields are mapped to observables and reconciled on
          observable data level - it has O(P) complexity, where P is the number of keyed element props (could be limited),
          compared to O(NP) in VirtualDOM, where N is the number of VDOM element children and P is the number of their props
          > It's only about diffing, **rx:WP Reactivity** still has to run its O(D) update algorithm (D is the distance - number of
          > graph nodes traversed to calculate and apply the shortest update path)
    - **rx:View** has also more advanced hybrid keyed and hybrid non-keyed modes, that are made to eliminate weak points
      of both kinds of algorithms:
        - hybrid keyed mode is optimizing keyed elements create/remove/replace time, by re-using elements, that will be
          garbage collected otherwise - for elements, that are included in the list between re-renders, it's using standard
          keyed algorithm. As normal keyed mode it could be implicit or explicit. Hybrid keyed mode, combined with _shared
          pooling strategy_ is the fastest rendering mode (even faster with _two-way binding_ strategy)
        - hybrid non-keyed mode is optimizing non-keyed elements removes and optionally also inserts - in standard non-keyed
          mode, if element is removed, algorithm is not removing exactly that element, but the last element instead, updating
          all elements from removed index to the end of list - that's a lot slower, than in keyed mode, when only single
          element is being affected in operation. In hybrid mode, elements are removed like in keyed mode and only indexes
          are updated. Inserts are similar, but are optional, because it's behavior may be strange - more info below
    - all modes could be modified with different strategies (that could be combined) - it results in even more performance
      and developer experience differences - strategies are based on:
        - pooling strategy - more info below in _**Pooling**_ description
        - update strategy - default _reconcile_ or optional _two-way binding_ - alternative way, to skip algorithms and
          perform granular, low complexity updates - the best performance for simple operations - for multiple, complex
          updates, default _reconcile_ algorithm should be better option - however as _two-way binding_ is two-way, it
          includes standard algorithm based update method
        - data item strategy - for hybrid and non-keyed modes, default is _full_ data item strategy, which means that item
          is passed as a single observable (readable), so its update is causing all connected observers/ui updates. It could
          be modified to _granular_ strategy (for object data items) - all object fields are mapped to observables and then,
          on update, changes are detected and propagated per field, thanks to observable referential equality check - custom
          data map/reconcile function could be also provided. Both, _full_ and _granular_ strategies, could be also modified
          with `:proxy` suffix, to use object getters, instead of readable functions
        - shape optimization strategy - list children could be combination of nested arrays, functions (potentially
          reactive) and DOM elements - detecting it in runtime, on algorithm side, has no bigger sense - potential earnings,
          are smaller, than risks. But if we are sure about list children shape, we could provide special optimization flags,
          to improve algorithms efficiency - i.e. when all children are always only DOM nodes, the normalization step could
          be completely skipped, as list is already normalized (skipped linear list loop and N `instanceof` checks) or if
          all children are always the same length static arrays (i.e. fragments), their length could be explicitly provided,
          to always identify them as the same sequences. There are other optimization flags, that will be described in
          strategies API docs.
          > In some simple cases, compiler could detect and auto-flag statically known shapes
    - built-in (common modules) conditionals (structural directives or components), have also keyed and non-keyed modes,
      and _pooling_ support, but their algorithms are a lot simpler and will be described in next sections
- _**Pooling**_ - **rx:Web Platform** has different kinds of pools, that are mainly used to optimize create/remove time of
  "heavy" parts of the system (like DOM elements) and are also a memory management solution.
    - in case of rendering modes, pooling is the concept of re-using Components/DOM Elements, that would be garbage
      collected otherwise, instead of creating new ones - it could increase performance a lot, especially shared pools in
      hybrid modes, but it will also increase memory usage (but pools will provide solutions to manage their memory)
    -
##### List/array rendering
All the list rendering modes, available in **rx:View**, are based on 3 steps:
1. Map & Memoize - different algorithm for every mode - run inside flow-control components/directives
2. Normalize
3. Reconcile - diff & update DOM nodes with **Sequential Three-Way Splice Algorithm**

Basic List Rendering Modes:
- Keyed (Implicit) Mode - elements are tracked (keyed) by their references
- Explicitly Keyed Mode
- Non-Keyed Mode - elements are tracked by index
- Static/Strict-recreate mode - elements aren't tracked - all nodes are re-created on every iteration

Advanced Modes:
- Hybrid (Implicit) Mode
- Hybrid Explicitly Keyed Mode
- Hybrid Non-keyed Mode

#### Re-mounting concept
- re-activate reactivity inside cached (removed from DOM and disposed) component - re-target its props
  with proxy before - then, re-hydrate (just by reactivity re-connect) and use its cached DOM
- re-mounts same "instances" in keyed pool mode - same key, means same "instance"
- re-mounts same type of component in shared pool mode - any removed component of given type, could be then
  re-used, by any inserted, same-type component - that kind of component has to be 100% based on reactive
  bindings and has to reset all of its state on dispose
- re-mounting concept emulates creating new component's "instance" - works like new component "instance", but
  connected with existing, cached DOM structure, that would be garbage collected otherwise

## Other libraries/frameworks comparisons and inspirations
- **Solid** & `dom-expressions` - renderer core, reactivity, compiler
- **Mikado** - it's less popular, probably because it's imperative and has no components, but it's
  still about TOP1 in both keyed and non-keyed `js-framework-benchmark` rankings. It's definitely the
  next-gen library, with revolutionary performance improvements, algorithms and features - in more
  complex cases, it leaves the competition far behind. Core & low-level **rx:View** features, like
  list reconciliation algorithm, advanced rendering modes and pools, are inspired by **Mikado** features
  and concepts, but implementation is completely different, because of radically different architectures:
    - **Mikado** is based on the object-oriented and imperative view containers, with deep, direct binding,
      between state/data, Virtual DOM (unique implementation) and DOM - then, any update of view container
      data is causing bound vDOM and DOM update - in single step, without any mapping, etc. - similarly,
      when DOM is updated (by special API), vDOM and data are updated too. It also enables special update
      methods, to skip algorithms and perform the fastest O(1) (or close to O(1)) DOM updates.
    - **rx:View** is functional, declarative and component-based. Instead of Virtual DOM, it's connecting
      component's state and DOM, with **Reactive Graph**, but both sides are separated. Connected observers,
      that are listening to changes of data sources, aren't bound with DOM nodes, but with their update
      micro-expressions. That's one-way, reactive binding - when data is updated, first it has to be mapped
      to update expression, to cause corresponding DOM updates.
    - while imperative, deep binding approach has a little better performance (that's probably the fastest
      possible approach), **rx:View** is reducing the difference with more advanced algorithms' optimization,
      providing same level of performance, with a lot better developer experience, thanks to declarative API
- **Svelte** - x:JSX and x:TS
- **S.js** (reactive algorithm)
- **Vue** (x:JSX)
- **React** (like all JSX frameworks),



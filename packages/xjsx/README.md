# x:JSX Babel Plugin Documentation

## Overview

The x:JSX Babel Plugin is a powerful transformer that converts x:JSX syntax into standard JSX that can be processed by any JSX-compatible framework. It enables advanced templating features like namespace components, directives, structural directives, and slots while maintaining compatibility with existing JSX toolchains.

## Installation

```bash
npm install --save-dev @babel/core babel-plugin-xjsx
```

## Configuration

### Basic Configuration

Create a `.babelrc` or `babel.config.js` file:

```javascript
// babel.config.js
module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-typescript",
    [
      "@babel/preset-react",
      {
        runtime: "automatic"
      }
    ]
  ],
  plugins: [
    [
      "babel-plugin-xjsx",
      {
        // Configuration options (see below)
      }
    ]
  ]
};
```

### Configuration Options

```javascript
{
  // Array of namespace prefixes to recognize
  namespaces: ["x", "app", "layout"],
  
  // Array of structural directive sequences
  structuralSequences: [
    ["if", "elseif", "else"],
    ["try", "catch", "finally"]
  ],
  
  // Prop name for element directives injection
  directiveProp: "use:directives",
  
  // Injector component names
  componentInjector: "$$component",
  structuralInjector: "$$structural", 
  sequenceInjector: "$$sequence"
}
```

## Integration with JSX Frameworks

### React Integration

```javascript
// babel.config.js
module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-react"
  ],
  plugins: [
    [
      "babel-plugin-xjsx",
      {
        directiveProp: "data-directives"
      }
    ]
  ]
};

// Runtime implementation (React example)
import React from 'react';

// Component injector
export const $$component = ({ module, name, children, ...props }) => {
  // Resolve component from module registry
  const Component = resolveComponent(module, name);
  return <Component {...props}>{children}</Component>;
};

// Structural directive injector
export const $$structural = ({ module, name, value, children, ...props }) => {
  // Resolve directive implementation
  const Directive = resolveDirective(module, name);
  return (
    <Directive value={value} {...props}>
      {children}
    </Directive>
  );
};

// Sequence injector
export const $$sequence = ({ module, children }) => {
  // Process directive sequence
  const Sequence = resolveSequence(module);
  return <Sequence items={children} />;
};
```

### Preact Integration

```javascript
// babel.config.js
module.exports = {
  presets: [
    "@babel/preset-env",
    ["@babel/preset-react", {
      pragma: "h",
      pragmaFrag: "Fragment"
    }]
  ],
  plugins: [
    "babel-plugin-xjsx"
  ]
};

// Runtime with Preact
import { h, Fragment } from 'preact';

// Same injector components as React example
```

### Solid Integration

```javascript
// babel.config.js
module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-typescript"
  ],
  plugins: [
    "babel-plugin-xjsx",
    "babel-plugin-jsx-dom-expressions"
  ]
};
```

## x:View/x:RX Integration

### Basic Setup

```javascript
// babel.config.js
module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-typescript"
  ],
  plugins: [
    [
      "babel-plugin-xjsx",
      {
        namespaces: ["x", "app", "layout"],
        structuralSequences: [
          ["if", "elseif", "else"],
          ["for", "of"],
          ["switch", "case", "default"]
        ]
      }
    ],
    "babel-plugin-jsx-dom-expressions"
  ]
};
```

### Runtime Integration

```typescript
// x-view/runtime.ts
import { observable, memo } from '@x-rx/core';
import { createComponent, createStructural, createSequence } from '@x-view/core';

// Component injector for x:View
export const $$component = createComponent({
  resolve: (module: string, name: string) => {
    // Resolve component from module registry
    return getModuleComponent(module, name);
  }
});

// Structural directive injector
export const $$structural = createStructural({
  resolve: (module: string, name: string) => {
    // Resolve directive implementation
    return getModuleDirective(module, name);
  }
});

// Sequence injector
export const $$sequence = createSequence({
  resolve: (module: string) => {
    // Resolve sequence handler
    return getModuleSequence(module);
  }
});
```

## x:JSX Syntax Guide

### 1. Namespace Components

Namespace components allow you to use components without explicit imports:

```tsx
// x:JSX syntax
<app:button variant="primary">Click me</app:button>
<layout:card title="My Card">
  <div>Card content</div>
</layout:card>

// Transformed to:
<$$component module="app" name="button" variant="primary">
  Click me
</$$component>
<$$component module="layout" name="card" title="My Card">
  <div>Card content</div>
</$$component>
```

### 2. Element Directives

Element directives modify DOM elements and can take props:

```tsx
// x:JSX syntax
<input 
  app:bind={observable('value')} 
  app:validate$required={true}
  app:debounce$delay={300}
/>

// Transformed to:
<input 
  use:directives={[
    { 
      module: "app", 
      name: "bind", 
      value: observable('value') 
    },
    { 
      module: "app", 
      name: "validate", 
      props: { required: true } 
    },
    { 
      module: "app", 
      name: "debounce", 
      props: { delay: 300 } 
    }
  ]}
/>
```

### 3. Structural Directives

Structural directives control rendering flow and can use template variables:

```tsx
// x:JSX syntax
<div $:for={list()} let$:item={item} let$:index={i}>
  {i + 1}. {item.name}
</div>

<div $app:show={isVisible()}>
  Content shown when visible
</div>

// Transformed to:
<$$structural module="app" name="for" value={list()}>
  {(item, i) => <div>{i + 1}. {item.name}</div>}
</$$structural>

<$$structural module="app" name="show" value={isVisible()}>
  {() => <div>Content shown when visible</div>}
</$$structural>
```

### 4. Directive Sequences

Directive sequences handle complex conditional rendering:

```tsx
// x:JSX syntax
<div $:if={condition1()}>First condition</div>
<div $:elseif={condition2()}>Second condition</div>
<div $:else>Default case</div>

// Transformed to:
<$$sequence module="app">
  {[
    { 
      name: "if", 
      value: condition1(), 
      render: () => <div>First condition</div> 
    },
    { 
      name: "elseif", 
      value: condition2(), 
      render: () => <div>Second condition</div> 
    },
    { 
      name: "else", 
      value: undefined, 
      render: () => <div>Default case</div> 
    }
  ]}
</$$sequence>
```

### 5. Component Slots

Slots enable flexible component composition:

```tsx
// x:JSX syntax
<layout:card let:title={title} let:content={content}>
  <header slot:header={[title, className]} class={className()}>
    <h1>{title}</h1>
  </header>
  <main slot:body let:data={content}>
    {content}
  </main>
  <footer slot:footer as:void>
    Footer content
  </footer>
</layout:card>

// Transformed to:
<$$component 
  module="layout" 
  name="card"
  header={(title, className) => (
    <header class={className()}>
      <h1>{title}</h1>
    </header>
  )}
  body={({ data: content }) => (
    <main>{content}</main>
  )}
  footer={() => (
    <footer>Footer content</footer>
  )}
>
  {({ title, content }) => <></>}
</$$component>
```

### 6. TypeScript Shorthand

TypeScript integration with reactive variable shorthand:

```tsx
// x:TSX syntax
declare const item: $const<ListItem>, i: number;

<div $:for={(item, i as let$) in list()}>
  {i + 1}. {item.name}
</div>

// Transformed to:
<div $:for={list()} let$:item={item} let$:index={i}>
  {i + 1}. {item.name}
</div>
```

## Advanced Features

### Custom Module Resolution

```typescript
// Custom module resolver
const moduleRegistry = {
  app: {
    button: AppButton,
    input: AppInput
  },
  layout: {
    card: LayoutCard,
    grid: LayoutGrid
  }
};

// Runtime resolver
const resolveComponent = (module: string, name: string) => {
  return moduleRegistry[module]?.[name];
};
```

### Directive Composition

```tsx
// Multiple directives on same element
<div 
  app:tooltip="Help text"
  app:ripple$color="blue"
  layout:grid$span={2}
>
  Content
</div>
```

### Nested Structural Directives

```tsx
// Nested structures
<ul $:for={categories()} let$:category={category}>
  <li>
    <h3>{category.name}</h3>
    <ul $:for={category.items} let$:item={item}>
      <li>{item.name}</li>
    </ul>
  </li>
</ul>
```

## Performance Considerations

### Compilation Optimization

```javascript
// babel.config.js - Production optimization
module.exports = {
  presets: [
    ["@babel/preset-env", {
      targets: "> 0.25%, not dead"
    }]
  ],
  plugins: [
    [
      "babel-plugin-xjsx",
      {
        // Optimize for production
        optimize: true,
        minify: true
      }
    ]
  ]
};
```

### Runtime Optimization

```typescript
// Memoized component resolution
const componentCache = new Map();

const resolveComponent = (module: string, name: string) => {
  const key = `${module}:${name}`;
  if (!componentCache.has(key)) {
    const component = loadComponent(module, name);
    componentCache.set(key, component);
  }
  return componentCache.get(key);
};
```

## Error Handling

### Common Issues

```typescript
// Error boundary for component resolution
const SafeComponent = (props) => {
  try {
    return <$$component {...props} />;
  } catch (error) {
    console.error('Component resolution error:', error);
    return <div className="error">Component error</div>;
  }
};
```

### Debug Mode

```javascript
// babel.config.js - Debug configuration
module.exports = {
  plugins: [
    [
      "babel-plugin-xjsx",
      {
        debug: true, // Enable debug output
        sourceMaps: true
      }
    ]
  ]
};
```

## Migration Guide

### From Standard JSX

```tsx
// Before (standard JSX)
<MyComponent prop={value}>
  <div className="child">Content</div>
</MyComponent>

// After (x:JSX with namespaces)
<app:my-component prop={value}>
  <div class="child">Content</div>
</app:my-component>
```

### From Template Languages

```vue
<!-- Vue-like template -->
<div v-for="item in list" :key="item.id">
  {{ item.name }}
</div>

<!-- x:JSX equivalent -->
<div $:for={list()} let$:item={item} :key={item.id}>
  {item.name}
</div>
```

## Best Practices

### 1. Module Organization

```typescript
// Recommended module structure
const modules = {
  ui: {
    button: UIButton,
    input: UIInput,
    select: UISelect
  },
  layout: {
    card: LayoutCard,
    grid: LayoutGrid,
    flex: LayoutFlex
  },
  data: {
    table: DataTable,
    list: DataList
  }
};
```

### 2. Directive Design

```typescript
// Well-designed directive with clear API
const tooltipDirective = (element: HTMLElement, value: () => string, props?: { 
  position?: 'top' | 'bottom' | 'left' | 'right',
  delay?: number 
}) => {
  // Implementation
};
```

### 3. Performance Optimization

```tsx
// Use memoization for expensive computations
const expensiveList = memo(() => {
  return complexDataProcessing(rawData());
});

// In template
<div $:for={expensiveList()} let$:item={item}>
  {item.processedValue}
</div>
```

This documentation provides comprehensive guidance for integrating and using the x:JSX Babel plugin with various frameworks and the x:View/x:RX ecosystem. The plugin enables powerful templating capabilities while maintaining compatibility with existing JSX workflows.


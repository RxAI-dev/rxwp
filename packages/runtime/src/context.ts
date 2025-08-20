import { contextId, context, renderEffect, untrack } from '@rxwp/reactivity'

import type { JSX } from './JSX'
import { children } from './component'

export interface ContextValue<T> {
  id: symbol
  Provider: (props: { children: JSX.Element; value: T }) => JSX.Element
  defaultValue: T
}

export interface ContextProviderProps<T> {
  value: T
  children: JSX.Element | JSX.Element[]
}

export function createContext<T>(defaultValue: T): ContextValue<T> {
  const id = contextId()
  return { id, Provider: createProvider(id), defaultValue }
}

export function useContext<T>(ctx: ContextValue<T>) {
  return context(ctx.id) || ctx.defaultValue
}

function createProvider<P extends ContextProviderProps<T>, T>(id: symbol) {
  return function provider(props: P): JSX.Element {
    let rendered: JSX.Element
    renderEffect(() => {
      context(id, props.value)
      rendered = untrack(() => children(props.children))
    })
    return rendered
  }
}

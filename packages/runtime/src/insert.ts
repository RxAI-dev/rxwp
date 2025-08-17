import {sharedConfig} from "./hydration";
import {JSX} from "./JSX";
import { renderEffect } from '@rxwp/reactivity';
import reconcileArrays from '@rxwp/dom-reconcile';

export function insertExpression<T extends JSX.Element>(
    parent: Node,
    value: T,
    current?: JSX.Element | JSX.Element[],
    marker?: Node | null | undefined,
    unwrapArray = false
): JSX.Element | JSX.Element[] {
    // 1. Get current child nodes in hydrate mode
    if (sharedConfig.context && !current) current = [...parent.childNodes]
    // 2. Normalize current value if it's function
    while (typeof current === 'function') current = current()
    // 3. Return current value if it's the same as next value
    if (value === current) return current
    const t = typeof value,
        multi = marker !== undefined
    parent = (multi && (current as Node[])[0] && (current as Node[])[0].parentNode) || parent
    // 4. Modify parent's children, depending on next value type
    if (t === 'string' || t === 'number') {
        // 4.1 Next value is string or number
        // Return current value in hydrate mode
        if (sharedConfig.context) return current
        if (multi) {
            let node = (current as Node[])[0]
            if (node && node.nodeType === 3) {
                ;(node as Text).data = value + ''
            } else node = document.createTextNode(value + '')
            current = cleanChildren(parent, current as Node[], marker, node)
        } else {
            if (current !== '' && typeof current === 'string') {
                current = (parent.firstChild as Text).data = value + ''
            } else current = parent.textContent = value + ''
        }
    } else if (value == null || t === 'boolean') {
        // 4.2 Next value is null, undefined or boolean
        if (sharedConfig.context) return current
        current = cleanChildren(parent, current as Node[], marker)
    } else if (t === 'function') {
        // 4.3 Next value is wrapped in function - unwrap it in effect and insert unwrapped value
        renderEffect(() => {
            let v = (value as Function)()
            while (typeof v === 'function') v = v()
            current = insertExpression(parent, v, current, marker)
        })
        return () => current
    } else if (Array.isArray(value)) {
        // 4.4 Next value is array
        const array: Node[] = []
        if (normalizeIncomingArray(array, value, current as Node[], unwrapArray)) {
            renderEffect(() => (current = insertExpression(parent, array, current, marker, true)))
            return () => current
        }
        if (sharedConfig.context) {
            if (!array.length) return current
            for (let i = 0; i < array.length; i++) {
                if (array[i].parentNode) return (current = array)
            }
        }
        if (array.length === 0) {
            current = cleanChildren(parent, current as Node[], marker)
            if (multi) return current
        } else if (current && Array.isArray(current)) {
            if (current.length === 0) appendNodes(parent, array, marker)
            else reconcileArrays(parent, current as Node[], array)
        } else {
            current && cleanChildren(parent)
            appendNodes(parent, array)
        }
        current = array
    } else if (value instanceof Node) {
        // 4.5 Next value is DOM Node
        if (sharedConfig.context && value.parentNode) return (current = multi ? [value] : value)
        if (Array.isArray(current)) {
            if (multi) return (current = cleanChildren(parent, current as Node[], marker, value))
            cleanChildren(parent, current as Node[], null, value)
        } else if (current == null || current === '' || !parent.firstChild) {
            parent.appendChild(value)
        } else parent.replaceChild(value, parent.firstChild)
        current = value
    }

    return current
}

function normalizeIncomingArray(
    normalized: (Node | JSX.FunctionElement)[],
    next: JSX.Element[],
    current: Node[],
    unwrap = false
): boolean {
    let dynamic = false,
        item: JSX.Element,
        prev: Node
    for (let i = 0, len = next.length; i < len; i++) {
        item = next[i]
        prev = current && current[i]
        if (item instanceof Node) {
            normalized.push(item)
        } else if (item == null || item === true || item === false) {
            // matches null, undefined, true or false
            // skip
        } else if (Array.isArray(item)) {
            dynamic = normalizeIncomingArray(normalized, item, prev as unknown as Node[]) || dynamic
        } else if (typeof item === 'function') {
            if (unwrap) {
                while (typeof item === 'function') item = item()
                dynamic =
                    normalizeIncomingArray(
                        normalized,
                        Array.isArray(item) ? item : [item],
                        Array.isArray(prev) ? prev : [prev]
                    ) || dynamic
            } else {
                normalized.push(item)
                dynamic = true
            }
        } else {
            const value = item + ''
            if (prev && prev.nodeType === 3 && (prev as Text).data === value) {
                normalized.push(prev)
            } else normalized.push(document.createTextNode(value))
        }
    }
    return dynamic
}

function appendNodes(parent: Node, nodes: Node[], marker: Node | null = null): void {
    if (marker == null) {
        for (let i = 0, l = nodes.length; i < l; ++i) parent.appendChild(nodes[i])
    } else {
        for (let i = 0, l = nodes.length; i < l; ++i) parent.insertBefore(nodes[i], marker)
    }
}

function cleanChildren(
    parent: Node,
    current?: Node[],
    marker?: Node | null | undefined,
    replacement?: Node | undefined
) {
    if (marker === undefined) return (parent.textContent = '')
    replacement = replacement || document.createTextNode('')
    if (current!.length) {
        for (let i = current!.length - 1, inserted = false, node: Node; i >= 0; --i) {
            if (replacement !== (node = current![i])) {
                if (!inserted && !i)
                    node.parentNode === parent
                        ? parent.replaceChild(replacement, node)
                        : parent.insertBefore(replacement, marker)
                else node.parentNode === parent && parent.removeChild(node)
            } else inserted = true
        }
    } else parent.insertBefore(replacement, marker)
    return [replacement]
}

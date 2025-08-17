// dom-expressions/runtime.ts
import './rxcore'
import {
    Properties,
    ChildProperties,
    Aliases,
    getPropAlias,
    SVGNamespace,
    DelegatedEvents,
    DOMElements,
    SVGElements
} from "./constants";
import {
    Owner,
    createRoot,
    createEffect,
    createMemo,
    getOwner,
    createComponent as rxCreateComponent,
    sharedConfig as rxSharedConfig,
    untrack,
    mergeProps as rxMergeProps
} from "rxcore";
import {JSX} from "../JSX";

// Type definitions
export type JSXElement = HTMLElement | SVGElement;
export type MountableElement = HTMLElement | SVGElement | Document | ShadowRoot;
export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;
export type Resource<T> = [Accessor<T>, { refetch: () => void }];
export type Context<T> = symbol & { __context__: T };

// Constants
const $$EVENTS = "_$DX_DELEGATE";

// Export constants
export {
    Properties,
    ChildProperties,
    getPropAlias,
    Aliases,
    SVGNamespace,
    DelegatedEvents,
    DOMElements,
    SVGElements
};

// Core re-exports
export {
    createEffect as effect,
    createMemo as memo,
    untrack,
    getOwner,
    rxCreateComponent as createComponent,
    rxMergeProps as mergeProps
};

// Utility functions
export const voidFn = () => undefined;
export const useAssets = voidFn;
export const getAssets = voidFn;
export const Assets = voidFn;
export const generateHydrationScript = voidFn;
export const HydrationScript = voidFn;
export const getRequestEvent = voidFn;

// Render function
export function render(
    code: () => JSX.Element,
    element: MountableElement,
    init?: JSX.Element[],
    options: { owner?: Owner } = {}
): () => void {
    if ((import.meta as any).env.DEV && !element) {
        throw new Error(
            "The `element` passed to `render(..., element)` doesn't exist. Make sure `element` exists in the document."
        );
    }

    let disposer: () => void;

    createRoot((dispose: () => void) => {
        disposer = dispose;
        if (element === document) {
            code();
        } else {
            insert(
                element as HTMLElement,
                code(),
                element.firstChild ? null : undefined,
                init
            );
        }
    }, options.owner);

    return () => {
        disposer();
        (element as HTMLElement).textContent = "";
    };
}

// Template function
export function template(
    html: string,
    isImportNode?: boolean,
    isSVG?: boolean,
    isMathML?: boolean
): () => Node {
    let node: Node | undefined;

    const create = (): Node => {
        if ((import.meta as any).env.DEV && isHydrating()) {
            throw new Error(
                "Failed attempt to create new DOM elements during hydration. Check that the libraries you are using support hydration."
            );
        }

        const t = (isMathML
            ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template")
            : document.createElement("template")) as any ;
        t.innerHTML = html;

        return isSVG
            ? (t.content.firstChild as Element).firstChild as Node
            : isMathML
                ? t.firstChild as Node
                : t.content.firstChild as Node;
    };

    const fn = isImportNode
        ? () => untrack(() => document.importNode(node || (node = create()), true))
        : () => (node || (node = create())).cloneNode(true);

    (fn as any).cloneNode = fn;
    return fn as () => Node;
}

// Event delegation
export function delegateEvents(
    eventNames: string[],
    doc: Document = window.document
): void {
    const e = (doc as any)[$$EVENTS] || ((doc as any)[$$EVENTS] = new Set<string>());

    for (let i = 0, l = eventNames.length; i < l; i++) {
        const name = eventNames[i];
        if (!e.has(name)) {
            e.add(name);
            doc.addEventListener(name, eventHandler);
        }
    }
}

export function clearDelegatedEvents(doc: Document = window.document): void {
    if ((doc as any)[$$EVENTS]) {
        for (const name of (doc as any)[$$EVENTS].keys()) {
            doc.removeEventListener(name, eventHandler);
        }
        delete (doc as any)[$$EVENTS];
    }
}

// Property/Attribute setters
export function setProperty(
    node: Element,
    name: string,
    value: any
): void {
    if (isHydrating(node)) return;
    (node as any)[name] = value;
}

export function setAttribute(
    node: Element,
    name: string,
    value: string | null | undefined
): void {
    if (isHydrating(node)) return;
    if (value == null) node.removeAttribute(name);
    else node.setAttribute(name, value);
}

export function setAttributeNS(
    node: Element,
    namespace: string,
    name: string,
    value: string | null | undefined
): void {
    if (isHydrating(node)) return;
    if (value == null) node.removeAttributeNS(namespace, name);
    else node.setAttributeNS(namespace, name, value);
}

export function setBoolAttribute(
    node: Element,
    name: string,
    value: boolean
): void {
    if (isHydrating(node)) return;
    value ? node.setAttribute(name, "") : node.removeAttribute(name);
}

export function className(
    node: Element,
    value: string | null | undefined
): void {
    if (isHydrating(node)) return;
    if (value == null) node.removeAttribute("class");
    else (node as HTMLElement).className = value;
}

// Event listener
export function addEventListener(
    node: Element,
    name: string,
    handler: any,
    delegate?: boolean
): void {
    if (delegate) {
        if (Array.isArray(handler)) {
            (node as any)[`$$${name}`] = handler[0];
            (node as any)[`$$${name}Data`] = handler[1];
        } else {
            (node as any)[`$$${name}`] = handler;
        }
    } else if (Array.isArray(handler)) {
        const handlerFn = handler[0];
        node.addEventListener(
            name,
            (handler[0] = (e: Event) => handlerFn.call(node, handler[1], e))
        );
    } else {
        node.addEventListener(name, handler, typeof handler !== "function" && handler);
    }
}

// Class list
export function classList(
    node: Element,
    value: Record<string, boolean> | null | undefined,
    prev: Record<string, boolean> = {}
): Record<string, boolean> {
    const classKeys = Object.keys(value || {});
    const prevKeys = Object.keys(prev);
    let i: number, len: number;

    for (i = 0, len = prevKeys.length; i < len; i++) {
        const key = prevKeys[i];
        if (!key || key === "undefined" || (value && value[key])) continue;
        toggleClassKey(node, key, false);
        delete prev[key];
    }

    for (i = 0, len = classKeys.length; i < len; i++) {
        const key = classKeys[i];
        const classValue = !!(value && value[key]);
        if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
        toggleClassKey(node, key, true);
        prev[key] = classValue;
    }

    return prev;
}

// Style handling
export function style(
    node: HTMLElement,
    value: string | Record<string, string> | null | undefined,
    prev?: string | Record<string, string>
): string | Record<string, string> | undefined {
    if (!value) return prev ? setAttribute(node, "style", undefined) as any : value as string | Record<string, string> | undefined;

    const nodeStyle = node.style;
    if (typeof value === "string") return (nodeStyle.cssText = value);

    if (typeof prev === "string") {
        nodeStyle.cssText = prev = undefined as any;
    }

    prev = prev || {};
    value = value || {};

    let v: string, s: string;

    for (s in prev as Record<string, string>) {
        if (!(value as Record<string, string>)[s]) {
            nodeStyle.removeProperty(s);
        }
        delete (prev as Record<string, string>)[s];
    }

    for (s in value as Record<string, string>) {
        v = (value as Record<string, string>)[s];
        if (v !== (prev as Record<string, string>)[s]) {
            nodeStyle.setProperty(s, v);
            (prev as Record<string, string>)[s] = v;
        }
    }

    return prev;
}

export function setStyleProperty(
    node: HTMLElement,
    name: string,
    value: string | null | undefined
): void {
    if (value != null) {
        node.style.setProperty(name, value);
    } else {
        node.style.removeProperty(name);
    }
}

// Spread props
export function spread(
    node: Element,
    props: any = {},
    isSVG?: boolean,
    skipChildren?: boolean
): any {
    const prevProps: any = {};

    if (!skipChildren) {
        createEffect(() =>
            prevProps.children = insertExpression(
                node,
                props.children,
                prevProps.children
            )
        );
    }

    createEffect(() => typeof props.ref === "function" && use(props.ref, node));
    createEffect(() => assign(node, props, isSVG, true, prevProps, true));

    return prevProps;
}

// Dynamic property
export function dynamicProperty(props: any, key: string): any {
    const src = props[key];
    Object.defineProperty(props, key, {
        get() {
            return src();
        },
        enumerable: true
    });
    return props;
}

// Use function
export function use<T>(fn: (el: Element, arg?: T) => void, element: Element, arg?: T): void {
    untrack(() => fn(element, arg));
}

// Insert function
export function insert(
    parent: Element,
    accessor: any,
    marker?: Node | null,
    initial?: any[]
): any {
    if (marker !== undefined && !initial) initial = [];
    if (typeof accessor !== "function") {
        return insertExpression(parent, accessor, initial, marker);
    }

    createEffect(
        (current: any) => insertExpression(parent, accessor(), current, marker),
        initial
    );
}

// Assign props
export function assign(
    node: Element,
    props: any,
    isSVG?: boolean,
    skipChildren?: boolean,
    prevProps: any = {},
    skipRef = false
): void {
    props = props || {};

    for (const prop in prevProps) {
        if (!(prop in props)) {
            if (prop === "children") continue;
            prevProps[prop] = assignProp(
                node,
                prop,
                null,
                prevProps[prop],
                isSVG,
                skipRef,
                props
            );
        }
    }

    for (const prop in props) {
        if (prop === "children") {
            if (!skipChildren) insertExpression(node, props.children, undefined);
            continue;
        }

        const value = props[prop];
        prevProps[prop] = assignProp(
            node,
            prop,
            value,
            prevProps[prop],
            isSVG,
            skipRef,
            props
        );
    }
}

// Hydration functions
export function hydrate(
    code: () => JSX.Element,
    element: HTMLElement,
    options: { renderId?: string; owner?: Owner } = {}
): () => void {
    if ((globalThis as any)._$HY && (globalThis as any)._$HY.done) {
        return render(code, element, [...element.childNodes], options);
    }

    rxSharedConfig.completed = (globalThis as any)._$HY?.completed;
    rxSharedConfig.events = (globalThis as any)._$HY?.events;
    rxSharedConfig.load = (id: string) => (globalThis as any)._$HY?.r[id];
    rxSharedConfig.has = (id: string) => !!(globalThis as any)._$HY?.r[id];
    rxSharedConfig.gather = (root: string) => gatherHydratable(element, root);
    rxSharedConfig.registry = new Map<string, Element>();
    rxSharedConfig.context = {
        id: options.renderId || "",
        count: 0
    };

    try {
        gatherHydratable(element, options.renderId);
        return render(code, element, [...element.childNodes], options);
    } finally {
        rxSharedConfig.context = null;
    }
}

export function getNextElement(template: () => Element): Element {
    let node: Element | undefined;
    let key: string | undefined;
    const hydrating = isHydrating();

    if (!hydrating || !(node = rxSharedConfig.registry!.get((key = getHydrationKey())))) {
        if ((import.meta as any).env.DEV && hydrating) {
            rxSharedConfig.done = true;
            throw new Error(
                `Hydration Mismatch. Unable to find DOM nodes for hydration key: ${key}\n${template ? template().outerHTML : ""}`
            );
        }
        return template();
    }

    if (rxSharedConfig.completed) rxSharedConfig.completed.add(node);
    rxSharedConfig.registry!.delete(key);
    return node;
}

export function getNextMatch(el: Node | null, nodeName: string): Element | null {
    while (el && (el as Element).localName !== nodeName) {
        el = el.nextSibling;
    }
    return el as Element | null;
}

export function getNextMarker(start: Node): [Node | null, Node[]] {
    let end: Node | null = start;
    let count = 0;
    let current: Node[] = [];

    if (isHydrating(start)) {
        while (end) {
            if (end.nodeType === 8) {
                const v = (end as Comment).nodeValue;
                if (v === "$") count++;
                else if (v === "/") {
                    if (count === 0) return [end, current];
                    count--;
                }
            }
            current.push(end);
            end = end.nextSibling;
        }
    }

    return [end, current];
}

export function runHydrationEvents(): void {
    if (rxSharedConfig.events && !(rxSharedConfig.events as any).queued) {
        queueMicrotask(() => {
            const { completed, events } = rxSharedConfig;
            if (!events) return;
            (events as any).queued = false;

            while (events.length) {
                const [el, e] = events[0];
                if (!completed.has(el)) return;
                events.shift();
                eventHandler(e);
            }

            if (rxSharedConfig.done) {
                rxSharedConfig.events = (globalThis as any)._$HY.events = null;
                rxSharedConfig.completed = (globalThis as any)._$HY.completed = null;
            }
        });
        (rxSharedConfig.events as any).queued = true;
    }
}

// Internal functions
function isHydrating(node?: Node): boolean {
    return !!rxSharedConfig.context &&
        !rxSharedConfig.done &&
        (!node || node.isConnected);
}

function toPropertyName(name: string): string {
    return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}

function toggleClassKey(node: Element, key: string, value: boolean): void {
    const classNames = key.trim().split(/\s+/);
    for (let i = 0, nameLen = classNames.length; i < nameLen; i++) {
        (node as HTMLElement).classList.toggle(classNames[i], value);
    }
}

function assignProp(
    node: Element,
    prop: string,
    value: any,
    prev: any,
    isSVG: boolean | undefined,
    skipRef: boolean,
    props: any
): any {
    let isCE: boolean | undefined = undefined,
        isProp: boolean | undefined = undefined,
        isChildProp: boolean | undefined = undefined,
        propAlias: string | undefined,
        forceProp: boolean;

    if (prop === "style") return style(node as HTMLElement, value, prev);
    if (prop === "classList") return classList(node, value, prev);
    if (value === prev) return prev;

    if (prop === "ref") {
        if (!skipRef) value(node);
    } else if (prop.slice(0, 3) === "on:") {
        const e = prop.slice(3);
        if (prev) node.removeEventListener(e, prev, typeof prev !== "function" && prev);
        if (value) node.addEventListener(e, value, typeof value !== "function" && value);
    } else if (prop.slice(0, 10) === "oncapture:") {
        const e = prop.slice(10);
        if (prev) node.removeEventListener(e, prev, true);
        if (value) node.addEventListener(e, value, true);
    } else if (prop.slice(0, 2) === "on") {
        const name = prop.slice(2).toLowerCase();
        const delegate = DelegatedEvents.has(name);

        if (!delegate && prev) {
            const h = Array.isArray(prev) ? prev[0] : prev;
            node.removeEventListener(name, h);
        }

        if (delegate || value) {
            addEventListener(node, name, value, delegate);
            delegate && delegateEvents([name]);
        }
    } else if (prop.slice(0, 5) === "attr:") {
        setAttribute(node, prop.slice(5), value);
    } else if (prop.slice(0, 5) === "bool:") {
        setBoolAttribute(node, prop.slice(5), value);
    } else if (
        (forceProp = prop.slice(0, 5) === "prop:") ||
        (isChildProp = ChildProperties.has(prop)) ||
        (!isSVG &&
            ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop)))) ||
        (isCE = node.nodeName.includes("-") || "is" in props)
    ) {
        if (forceProp) {
            prop = prop.slice(5);
            isProp = true;
        } else if (isHydrating(node)) return value;

        if (prop === "class" || prop === "className") {
            className(node, value);
        } else if (isCE && !isProp && !isChildProp) {
            (node as any)[toPropertyName(prop)] = value;
        } else {
            (node as any)[propAlias || prop] = value;
        }
    } else {
        const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
        if (ns) {
            setAttributeNS(node, ns, prop, value);
        } else {
            setAttribute(node, Aliases[prop as keyof typeof Aliases] || prop, value);
        }
    }

    return value;
}

function eventHandler(e: Event): void {
    if (rxSharedConfig.registry && rxSharedConfig.events) {
        if (rxSharedConfig.events.find(([el, ev]: [any, any]) => ev === e)) return;
    }

    let node: any = e.target;
    const key = `$$${e.type}`;
    const oriTarget = e.target;
    const oriCurrentTarget = e.currentTarget;

    const retarget = (value: EventTarget) =>
        Object.defineProperty(e, "target", {
            configurable: true,
            value
        });

    const handleNode = (): boolean => {
        const handler = node[key];
        if (handler && !node.disabled) {
            const data = node[`${key}Data`];
            if (data !== undefined) {
                handler.call(node, data, e);
            } else {
                handler.call(node, e);
            }
            if ((e as any).cancelBubble) return false;
        }

        if (node.host &&
            typeof node.host !== "string" &&
            !node.host._$host &&
            node.contains(e.target)) {
            retarget(node.host);
        }

        return true;
    };

    const walkUpTree = (): void => {
        while (handleNode() && (node = node._$host || node.parentNode || node.host));
    };

    // simulate currentTarget
    Object.defineProperty(e, "currentTarget", {
        configurable: true,
        get() {
            return node || document;
        }
    });

    // cancel hydration
    if (rxSharedConfig.registry && !rxSharedConfig.done) {
        rxSharedConfig.done = (globalThis as any)._$HY.done = true;
    }

    if ((e as any).composedPath) {
        const path = (e as any).composedPath();
        retarget(path[0]);

        for (let i = 0; i < path.length - 2; i++) {
            node = path[i];
            if (!handleNode()) break;

            if (node._$host) {
                node = node._$host;
                // bubble up from portal mount instead of composedPath
                walkUpTree();
                break;
            }

            if (node.parentNode === oriCurrentTarget) {
                break; // don't bubble above root of event delegation
            }
        }
    } else {
        walkUpTree();
    }

    // Mixing portals and shadow dom can lead to a nonstandard target, so reset here.
    retarget(oriTarget as EventTarget);
}

function insertExpression(
    parent: Element,
    value: any,
    current: any,
    marker?: Node | null,
    unwrapArray?: boolean
): any {
    const hydrating = isHydrating(parent);

    if (hydrating) {
        if (!current) current = [...parent.childNodes];
        let cleaned: Node[] = [];

        for (let i = 0; i < current.length; i++) {
            const node = current[i];
            if (node.nodeType === 8 && (node as Comment).data.slice(0, 2) === "!$") {
                node.remove();
            } else {
                cleaned.push(node);
            }
        }
        current = cleaned;
    }

    while (typeof current === "function") current = current();
    if (value === current) return current;

    const t = typeof value;
    const multi = marker !== undefined;
    parent = (multi && current[0] && current[0].parentNode) || parent;

    if (t === "string" || t === "number") {
        if (hydrating) return current;

        if (t === "number") {
            value = value.toString();
            if (value === current) return current;
        }

        if (multi) {
            let node = current[0];
            if (node && node.nodeType === 3) {
                if ((node as Text).data !== value) (node as Text).data = value;
            } else {
                node = document.createTextNode(value);
            }
            current = cleanChildren(parent, current, marker, node);
        } else {
            if (current !== "" && typeof current === "string") {
                current = (parent.firstChild as Text).data = value;
            } else {
                current = parent.textContent = value;
            }
        }
    } else if (value == null || t === "boolean") {
        if (hydrating) return current;
        current = cleanChildren(parent, current, marker);
    } else if (t === "function") {
        createEffect(() => {
            let v = value();
            while (typeof v === "function") v = v();
            current = insertExpression(parent, v, current, marker);
        });
        return () => current;
    } else if (Array.isArray(value)) {
        const array: Node[] = [];
        const currentArray = current && Array.isArray(current);

        if (normalizeIncomingArray(array, value, current, unwrapArray)) {
            createEffect(() =>
                current = insertExpression(parent, array, current, marker, true)
            );
            return () => current;
        }

        if (hydrating) {
            if (!array.length) return current;
            if (marker === undefined) return (current = [...parent.childNodes]);

            let node = array[0];
            if (node.parentNode !== parent) return current;

            const nodes: Node[] = [node];
            while ((node = node.nextSibling as Node) !== marker) nodes.push(node);
            return (current = nodes);
        }

        if (array.length === 0) {
            current = cleanChildren(parent, current, marker);
            if (multi) return current;
        } else if (currentArray) {
            if (current.length === 0) {
                appendNodes(parent, array, marker);
            } else {
                // Assuming reconcileArrays is imported or implemented
                // reconcileArrays(parent, current, array);
            }
        } else {
            if (current) cleanChildren(parent, undefined);
            appendNodes(parent, array);
        }
        current = array;
    } else if (value.nodeType) {
        if (hydrating && value.parentNode) return (current = multi ? [value] : value);

        if (Array.isArray(current)) {
            if (multi) {
                return (current = cleanChildren(parent, current, marker, value));
            }
            cleanChildren(parent, current, null, value);
        } else if (current == null || current === "" || !parent.firstChild) {
            parent.appendChild(value);
        } else {
            parent.replaceChild(value, parent.firstChild);
        }
        current = value;
    } else if ((import.meta as any).env.DEV) {
        console.warn(`Unrecognized value. Skipped inserting`, value);
    }

    return current;
}

function normalizeIncomingArray(
    normalized: Node[],
    array: any[],
    current: any,
    unwrap?: boolean
): boolean {
    let dynamic = false;

    for (let i = 0, len = array.length; i < len; i++) {
        let item = array[i];
        let prev = current && current[normalized.length];
        let t: string;

        if (item == null || item === true || item === false) {
            // skip
        } else if ((t = typeof item) === "object" && item.nodeType) {
            normalized.push(item);
        } else if (Array.isArray(item)) {
            dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
        } else if (t === "function") {
            if (unwrap) {
                while (typeof item === "function") item = item();
                dynamic = normalizeIncomingArray(
                    normalized,
                    Array.isArray(item) ? item : [item],
                    Array.isArray(prev) ? prev : [prev]
                ) || dynamic;
            } else {
                normalized.push(item);
                dynamic = true;
            }
        } else {
            const value = String(item);
            if (prev && prev.nodeType === 3 && (prev as Text).data === value) {
                normalized.push(prev);
            } else {
                normalized.push(document.createTextNode(value));
            }
        }
    }

    return dynamic;
}

function appendNodes(
    parent: Element,
    array: Node[],
    marker: Node | null = null
): void {
    for (let i = 0, len = array.length; i < len; i++) {
        parent.insertBefore(array[i], marker);
    }
}

function cleanChildren(
    parent: Element,
    current: any,
    marker?: Node | null,
    replacement?: Node
): Node[] {
    if (marker === undefined) {
        parent.textContent = "";
        return [];
    }

    const node = replacement || document.createTextNode("");

    if (current && current.length) {
        let inserted = false;
        for (let i = current.length - 1; i >= 0; i--) {
            const el = current[i];
            if (node !== el) {
                const isParent = el.parentNode === parent;
                if (!inserted && !i) {
                    isParent
                        ? parent.replaceChild(node, el)
                        : parent.insertBefore(node, marker);
                } else {
                    isParent && el.remove();
                }
            } else {
                inserted = true;
            }
        }
    } else {
        parent.insertBefore(node, marker);
    }

    return [node];
}

function gatherHydratable(element: HTMLElement, root: string | undefined): void {
    const templates = element.querySelectorAll(`*[data-hk]`);

    for (let i = 0; i < templates.length; i++) {
        const node = templates[i];
        const key = node.getAttribute("data-hk")!;

        if ((!root || key.startsWith(root)) && !rxSharedConfig.registry!.has(key)) {
            rxSharedConfig.registry!.set(key, node);
        }
    }
}

export function getHydrationKey(): string {
    return rxSharedConfig.getNextContextId();
}

export function NoHydration(props: { children: any }): any {
    return rxSharedConfig.context ? undefined : props.children;
}

export function Hydration(props: { children: any }): any {
    return props.children;
}

// Experimental
export const RequestContext = Symbol();

// Deprecated
export function innerHTML(parent: Element, content: string): void {
    if (!rxSharedConfig.context) (parent as HTMLElement).innerHTML = content;
}

// babel-plugin-xjsx.js
const { declare } = require("@babel/helper-plugin-utils");
const { types: t } = require("@babel/core");

module.exports = declare((api, options) => {
    api.assertVersion(7);

    const {
        namespaces = ["x", "app"],
        structuralSequences = [["if", "elseif", "else"]],
        directiveProp = "use:directives",
        componentInjector = "$$component",
        structuralInjector = "$$structural",
        sequenceInjector = "$$sequence",
        moduleInjector = "$$module"
    } = options;

    // Helper to check if element is a namespace component
    const isNamespaceComponent = (node) => {
        return t.isJSXMemberExpression(node.name) &&
            namespaces.includes(node.name.object.name);
    };

    // Helper to check if element is a module provider
    const isModuleElement = (node) => {
        return t.isJSXMemberExpression(node.name) &&
            node.name.object.name === "module";
    };

    // Helper to check if element is a structural directive
    const isStructuralDirective = (node) => {
        return t.isJSXNamespacedName(node.name) &&
            node.name.namespace.name.startsWith("$");
    };

    // Helper to get directive info
    const getDirectiveInfo = (nameNode) => {
        const namespace = nameNode.namespace.name;
        const name = nameNode.name.name;

        if (namespace.startsWith("$")) {
            // Structural directive - module is after the $
            const module = namespace.substring(1) || "app";
            return {
                module: module,
                name: name
            };
        } else {
            // Element directive - namespace is module
            return {
                module: namespace,
                name: name
            };
        }
    };

    // Transform namespace components to injector components
    const transformNamespaceComponent = (path) => {
        const { node } = path;
        if (!isNamespaceComponent(node)) return;

        const moduleName = node.name.object.name;
        const componentName = node.name.property.name;

        const newAttributes = [
            t.jsxAttribute(
                t.jsxIdentifier("module"),
                t.stringLiteral(moduleName)
            ),
            t.jsxAttribute(
                t.jsxIdentifier("name"),
                t.stringLiteral(componentName)
            ),
            ...node.attributes
        ];

        const newNode = t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(componentInjector),
                newAttributes
            ),
            t.jsxClosingElement(t.jsxIdentifier(componentInjector)),
            node.children,
            false
        );

        path.replaceWith(newNode);
    };

    // Transform module providers
    const transformModule = (path) => {
        const { node } = path;
        if (!isModuleElement(node)) return;

        const moduleName = node.name.property.name;

        const newAttributes = [
            t.jsxAttribute(
                t.jsxIdentifier("name"),
                t.stringLiteral(moduleName)
            ),
            ...node.attributes
        ];

        const newNode = t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(moduleInjector),
                newAttributes
            ),
            t.jsxClosingElement(t.jsxIdentifier(moduleInjector)),
            node.children,
            false
        );

        path.replaceWith(newNode);
    };

    // Transform element directives to use:directives prop
    const transformElementDirectives = (path) => {
        const { node } = path;
        if (!t.isJSXElement(node)) return;

        const directiveAttributes = [];
        const regularAttributes = [];

        node.attributes.forEach(attr => {
            if (t.isJSXNamespacedName(attr.name)) {
                const { module, name } = getDirectiveInfo(attr.name);

                // Check for directive props (ending with $prop)
                const propMatch = name.match(/^(.+)\$(.+)$/);
                if (propMatch) {
                    const baseName = propMatch[1];
                    const propName = propMatch[2];

                    // Find or create directive entry
                    let directiveEntry = directiveAttributes.find(d =>
                        d.module === module && d.name === baseName
                    );

                    if (!directiveEntry) {
                        directiveEntry = {
                            module,
                            name: baseName,
                            props: {}
                        };
                        directiveAttributes.push(directiveEntry);
                    }

                    directiveEntry.props[propName] = attr.value;
                } else {
                    // Regular directive
                    directiveAttributes.push({
                        module,
                        name,
                        value: attr.value
                    });
                }
            } else {
                regularAttributes.push(attr);
            }
        });

        if (directiveAttributes.length > 0) {
            // Convert directive attributes to use:directives array
            const directiveArray = t.arrayExpression(
                directiveAttributes.map(directive => {
                    const props = directive.props && Object.keys(directive.props).length > 0 ?
                        t.objectExpression(
                            Object.entries(directive.props).map(([key, value]) =>
                                t.objectProperty(
                                    t.identifier(key),
                                    t.isJSXExpressionContainer(value) ? value.expression : value
                                )
                            )
                        ) : null;

                    const properties = [
                        t.objectProperty(t.identifier("module"), t.stringLiteral(directive.module)),
                        t.objectProperty(t.identifier("name"), t.stringLiteral(directive.name)),
                        ...(directive.value ? [
                            t.objectProperty(
                                t.identifier("value"),
                                t.isJSXExpressionContainer(directive.value) ?
                                    directive.value.expression :
                                    directive.value
                            )
                        ] : []),
                        ...(props ? [
                            t.objectProperty(t.identifier("props"), props)
                        ] : [])
                    ];

                    return t.objectExpression(properties);
                })
            );

            regularAttributes.push(
                t.jsxAttribute(
                    t.jsxIdentifier(directiveProp.replace(":", "$")),
                    t.jsxExpressionContainer(directiveArray)
                )
            );

            node.attributes = regularAttributes;
        }
    };

    // Transform structural directives
    const transformStructuralDirective = (path) => {
        const { node } = path;
        if (!isStructuralDirective(node)) return;

        // Structural directives have namespace starting with $
        const { module, name } = getDirectiveInfo(node.name);

        // Extract value and props
        let value = null;
        let props = {};

        if (t.isJSXExpressionContainer(node.value)) {
            const expr = node.value.expression;
            if (t.isArrayExpression(expr)) {
                // [value, props]
                value = expr.elements[0];
                if (t.isObjectExpression(expr.elements[1])) {
                    expr.elements[1].properties.forEach(prop => {
                        if (t.isObjectProperty(prop)) {
                            props[prop.key.name] = prop.value;
                        }
                    });
                }
            } else {
                value = expr;
            }
        }

        // Collect let$ variables from the same element (CORRECTED)
        const letVariables = [];
        const newAttributes = [];

        node.attributes.forEach(attr => {
            if (t.isJSXNamespacedName(attr.name) &&
                attr.name.namespace.name === "let$" &&
                t.isJSXExpressionContainer(attr.value)) {
                letVariables.push({
                    name: attr.name.name.name,
                    value: attr.value.expression
                });
            } else if (!t.isJSXNamespacedName(attr.name) ||
                !attr.name.namespace.name.startsWith('$')) {
                newAttributes.push(attr);
            }
        });

        node.attributes = newAttributes;

        // Create injector component
        const attributes = [
            t.jsxAttribute(
                t.jsxIdentifier("module"),
                t.stringLiteral(module)
            ),
            t.jsxAttribute(
                t.jsxIdentifier("name"),
                t.stringLiteral(name)
            ),
            ...(value ? [
                t.jsxAttribute(
                    t.jsxIdentifier("value"),
                    t.jsxExpressionContainer(value)
                )
            ] : []),
            ...Object.entries(props).map(([key, val]) =>
                t.jsxAttribute(
                    t.jsxIdentifier(key),
                    t.jsxExpressionContainer(val)
                )
            )
        ];

        // Create render function (CORRECTED)
        const renderParam = letVariables.length > 0
            ? (letVariables.length === 1
                ? t.identifier(letVariables[0].name)
                : t.objectPattern(
                    letVariables.map(v =>
                        t.objectProperty(
                            t.identifier(v.name),
                            t.identifier(v.name),
                            false,
                            true
                        )
                    )
                ))
            : t.identifier("_");

        const renderFunction = t.arrowFunctionExpression(
            [renderParam],
            node.children.length === 1
                ? node.children[0]
                : t.jsxFragment(
                    t.jsxOpeningFragment(),
                    t.jsxClosingFragment(),
                    node.children
                )
        );

        const newNode = t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(structuralInjector),
                attributes
            ),
            t.jsxClosingElement(t.jsxIdentifier(structuralInjector)),
            [t.jsxExpressionContainer(renderFunction)],
            false
        );

        path.replaceWith(newNode);
    };

    // Transform structural directive sequences
    const transformDirectiveSequences = (paths) => {
        if (paths.length === 0) return;

        const parent = paths[0].parentPath.node;
        if (!t.isJSXElement(parent)) return;

        const sequenceElements = [];
        const elementPaths = [];

        // Collect consecutive sequence elements
        for (const path of paths) {
            const node = path.node;
            if (!isStructuralDirective(node)) continue;

            const { module, name } = getDirectiveInfo(node.name);

            // Check if this directive is part of any configured sequence
            const isInSequence = structuralSequences.some(seq =>
                seq.includes(name)
            );

            if (isInSequence) {
                sequenceElements.push({ node, module, name });
                elementPaths.push(path);
            } else {
                break;
            }
        }

        // Only transform if we have multiple elements in a known sequence
        if (sequenceElements.length <= 1) return;

        // Verify it's a complete sequence
        const firstDirectiveName = sequenceElements[0].name;
        const matchingSequence = structuralSequences.find(seq =>
            seq[0] === firstDirectiveName
        );

        if (!matchingSequence) return;

        // Check if sequence is complete
        const sequenceNames = sequenceElements.map(el => el.name);

        let isComplete = true;
        for (let i = 0; i < Math.min(sequenceNames.length, matchingSequence.length); i++) {
            if (sequenceNames[i] !== matchingSequence[i]) {
                isComplete = false;
                break;
            }
        }

        if (!isComplete) return;

        // Verify all elements come from the same module
        const sequenceModule = sequenceElements[0].module;
        for (const element of sequenceElements) {
            if (element.module !== sequenceModule) {
                return; // Sequence elements must come from the same module
            }
        }

        // Transform sequence
        const sequenceItems = sequenceElements.map((element, index) => {
            const { name, node } = element;

            let value = null;
            if (t.isJSXExpressionContainer(node.value)) {
                value = node.value.expression;
            }

            // Collect let$ variables (CORRECTED)
            const letVariables = [];
            node.attributes.forEach(attr => {
                if (t.isJSXNamespacedName(attr.name) &&
                    attr.name.namespace.name === "let$" &&
                    t.isJSXExpressionContainer(attr.value)) {
                    letVariables.push({
                        name: attr.name.name.name,
                        value: attr.value.expression
                    });
                }
            });

            // Create render function (CORRECTED)
            const renderParam = letVariables.length > 0
                ? (letVariables.length === 1
                    ? t.identifier(letVariables[0].name)
                    : t.objectPattern(
                        letVariables.map(v =>
                            t.objectProperty(
                                t.identifier(v.name),
                                t.identifier(v.name),
                                false,
                                true
                            )
                        )
                    ))
                : t.identifier("_");

            const renderFunction = t.arrowFunctionExpression(
                [renderParam],
                node.children.length === 1
                    ? node.children[0]
                    : t.jsxFragment(
                        t.jsxOpeningFragment(),
                        t.jsxClosingFragment(),
                        node.children
                    )
            );

            return t.objectExpression([
                t.objectProperty(
                    t.jsxIdentifier("name"),
                    t.stringLiteral(name)
                ),
                ...(value ? [
                    t.objectProperty(
                        t.jsxIdentifier("value"),
                        value
                    )
                ] : []),
                t.objectProperty(
                    t.jsxIdentifier("render"),
                    renderFunction
                )
            ]);
        });

        const sequenceNode = t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(sequenceInjector),
                [
                    t.jsxAttribute(
                        t.jsxIdentifier("module"),
                        t.stringLiteral(sequenceModule)
                    ),
                    t.jsxAttribute(
                        t.jsxIdentifier("sequence"),
                        t.stringLiteral(matchingSequence.join(","))
                    )
                ]
            ),
            t.jsxClosingElement(t.jsxIdentifier(sequenceInjector)),
            [
                t.jsxExpressionContainer(
                    t.arrayExpression(sequenceItems)
                )
            ],
            false
        );

        // Replace first element and remove others
        elementPaths[0].replaceWith(sequenceNode);
        for (let i = 1; i < elementPaths.length; i++) {
            elementPaths[i].remove();
        }
    };

    // Transform component slots
    const transformComponentSlots = (path) => {
        const { node } = path;
        if (!t.isJSXElement(node)) return;

        const slotChildren = {};
        const defaultChildren = [];
        const slotProps = {};

        // Process children
        node.children.forEach(child => {
            if (t.isJSXElement(child)) {
                const slotAttr = child.attributes.find(attr =>
                    t.isJSXNamespacedName(attr.name) &&
                    attr.name.namespace.name === "slot"
                );

                if (slotAttr) {
                    const slotName = slotAttr.name.name.name;
                    const slotKey = slotName === "default" || slotName === "children"
                        ? "children"
                        : slotName;

                    // Check for let: variables
                    const letVariables = {};
                    const newAttributes = [];

                    child.attributes.forEach(attr => {
                        if (t.isJSXNamespacedName(attr.name) &&
                            attr.name.namespace.name === "let") {
                            letVariables[attr.name.name.name] = attr.value.expression;
                        } else if (!(t.isJSXNamespacedName(attr.name) &&
                            attr.name.namespace.name === "slot")) {
                            newAttributes.push(attr);
                        }
                    });

                    child.attributes = newAttributes;

                    if (Object.keys(letVariables).length > 0) {
                        // Create function slot
                        const paramNames = Object.keys(letVariables);
                        const params = paramNames.map(name => t.identifier(name));

                        const slotFunction = t.arrowFunctionExpression(
                            params.length > 1
                                ? [t.objectPattern(
                                    paramNames.map(name =>
                                        t.objectProperty(
                                            t.identifier(name),
                                            t.identifier(name),
                                            false,
                                            true
                                        )
                                    )
                                )]
                                : params,
                            t.jsxElement(
                                child.openingElement,
                                child.closingElement,
                                child.children,
                                child.selfClosing
                            )
                        );

                        slotProps[slotKey] = slotFunction;
                    } else {
                        // Create static slot
                        slotProps[slotKey] = t.jsxElement(
                            child.openingElement,
                            child.closingElement,
                            child.children,
                            child.selfClosing
                        );
                    }
                } else {
                    defaultChildren.push(child);
                }
            } else {
                defaultChildren.push(child);
            }
        });

        // Add slot props to component
        if (Object.keys(slotProps).length > 0) {
            Object.entries(slotProps).forEach(([key, value]) => {
                node.attributes.push(
                    t.jsxAttribute(
                        t.jsxIdentifier(key),
                        t.jsxExpressionContainer(value)
                    )
                );
            });
        }

        // Handle default children
        if (defaultChildren.length > 0) {
            // Check for let: variables on parent component
            const letVariables = {};
            const newAttributes = [];

            node.attributes.forEach(attr => {
                if (t.isJSXNamespacedName(attr.name) &&
                    attr.name.namespace.name === "let") {
                    letVariables[attr.name.name.name] = attr.value.expression;
                } else {
                    newAttributes.push(attr);
                }
            });

            node.attributes = newAttributes;

            if (Object.keys(letVariables).length > 0) {
                const paramNames = Object.keys(letVariables);
                const params = paramNames.map(name => t.identifier(name));

                const childrenFunction = t.arrowFunctionExpression(
                    params.length > 1
                        ? [t.objectPattern(
                            paramNames.map(name =>
                                t.objectProperty(
                                    t.identifier(name),
                                    t.identifier(name),
                                    false,
                                    true
                                )
                            )
                        )]
                        : params,
                    t.jsxFragment(
                        t.jsxOpeningFragment(),
                        t.jsxClosingFragment(),
                        defaultChildren
                    )
                );

                node.children = [t.jsxExpressionContainer(childrenFunction)];
            } else {
                node.children = defaultChildren;
            }
        } else {
            node.children = [];
        }
    };

    // Transform TypeScript list shorthand
    const transformTSListShorthand = (path) => {
        const { node } = path;
        if (!t.isJSXElement(node)) return;

        // Look for $:for with "let$ in" pattern
        const forDirective = node.attributes.find(attr =>
            t.isJSXNamespacedName(attr.name) &&
            attr.name.namespace.name.startsWith('$') &&
            attr.name.name.name === "for" &&
            t.isJSXExpressionContainer(attr.value) &&
            t.isBinaryExpression(attr.value.expression) &&
            attr.value.expression.operator === "in"
        );

        if (!forDirective) return;

        const binaryExpr = forDirective.value.expression;
        const left = binaryExpr.left;

        // Check for (item, i as let$) pattern
        if (t.isSequenceExpression(left)) {
            const expressions = left.expressions;
            if (expressions.length >= 2) {
                const itemVar = expressions[0];
                const indexVar = expressions[1];

                // Remove "as let$" type assertion
                let cleanItemVar = itemVar;
                let cleanIndexVar = indexVar;

                if (t.isTSAsExpression(itemVar) &&
                    t.isTSTypeReference(itemVar.typeAnnotation) &&
                    itemVar.typeAnnotation.typeName.name === "let$") {
                    cleanItemVar = itemVar.expression;
                }

                if (t.isTSAsExpression(indexVar) &&
                    t.isTSTypeReference(indexVar.typeAnnotation) &&
                    indexVar.typeAnnotation.typeName.name === "let$") {
                    cleanIndexVar = indexVar.expression;
                }

                // Transform to separate let$: directives
                const newItemAttr = t.jsxAttribute(
                    t.jsxNamespacedName(
                        t.jsxIdentifier("let$"),
                        t.jsxIdentifier("item")
                    ),
                    t.jsxExpressionContainer(cleanItemVar)
                );

                const newIndexAttr = t.jsxAttribute(
                    t.jsxNamespacedName(
                        t.jsxIdentifier("let$"),
                        t.jsxIdentifier("index")
                    ),
                    t.jsxExpressionContainer(cleanIndexVar)
                );

                // Update for directive value
                forDirective.value = t.jsxExpressionContainer(binaryExpr.right);

                // Add new attributes
                node.attributes.push(newItemAttr);
                node.attributes.push(newIndexAttr);
            }
        }
    };

    return {
        name: "xjsx-transform",
        visitor: {
            Program: {
                enter(path) {
                    // Pre-process TypeScript list shorthand
                    path.traverse({
                        JSXElement(innerPath) {
                            transformTSListShorthand(innerPath);
                        }
                    });
                }
            },
            JSXOpeningElement: {
                exit(path) {
                    // Transform structural directives
                    transformStructuralDirective(path);
                }
            },
            JSXElement: {
                enter(path) {
                    // Transform namespace components
                    transformNamespaceComponent(path);

                    // Transform module providers
                    transformModule(path);

                    // Transform element directives
                    transformElementDirectives(path);

                    // Transform component slots
                    transformComponentSlots(path);
                },
                exit(path) {
                    // Handle directive sequences after other transforms
                    if (!t.isJSXElement(path.node)) return;

                    const structuralChildren = [];
                    const structuralPaths = [];

                    path.node.children.forEach((child, index) => {
                        if (t.isJSXElement(child) &&
                            t.isJSXNamespacedName(child.openingElement.name) &&
                            child.openingElement.name.namespace.name.startsWith("$")) {
                            structuralChildren.push(child);
                            structuralPaths.push(path.get(`children.${index}`));
                        }
                    });

                    if (structuralPaths.length > 0) {
                        transformDirectiveSequences(structuralPaths);
                    }
                }
            }
        }
    };
});

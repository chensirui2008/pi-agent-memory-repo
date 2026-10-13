/**
 * Lightweight, zero-dependency TypeBox-compatible JSON Schema builder.
 * Produces standard JSON Schema objects compatible with Pi tool registration.
 */
const Kind = Symbol.for("TypeBox.Kind");
const OptionalModifier = Symbol.for("TypeBox.Optional");
export const Type = {
    Object(properties, options) {
        const required = [];
        for (const [key, prop] of Object.entries(properties)) {
            if (!prop[OptionalModifier]) {
                required.push(key);
            }
        }
        return {
            [Kind]: "Object",
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
            additionalProperties: false,
            ...options,
        };
    },
    String(options) {
        return {
            [Kind]: "String",
            type: "string",
            ...options,
        };
    },
    Number(options) {
        return {
            [Kind]: "Number",
            type: "number",
            ...options,
        };
    },
    Boolean(options) {
        return {
            [Kind]: "Boolean",
            type: "boolean",
            ...options,
        };
    },
    Optional(schema) {
        return {
            ...schema,
            [OptionalModifier]: "Optional",
        };
    },
    Array(itemSchema, options) {
        return {
            [Kind]: "Array",
            type: "array",
            items: itemSchema,
            ...options,
        };
    },
    Union(schemas, options) {
        return {
            [Kind]: "Union",
            anyOf: schemas,
            ...options,
        };
    },
    Literal(value, options) {
        return {
            [Kind]: "Literal",
            const: value,
            type: typeof value,
            ...options,
        };
    },
};
//# sourceMappingURL=schema.js.map
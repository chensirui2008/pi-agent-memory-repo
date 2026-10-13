/**
 * Lightweight, zero-dependency TypeBox-compatible JSON Schema builder.
 * Produces standard JSON Schema objects compatible with Pi tool registration.
 */

const Kind = Symbol.for("TypeBox.Kind");
const OptionalModifier = Symbol.for("TypeBox.Optional");

export interface SchemaOptions {
  description?: string;
  default?: any;
  [key: string]: any;
}

export interface TSchema {
  [Kind]?: string;
  [OptionalModifier]?: string;
  type?: string;
  [key: string]: any;
}

export const Type = {
  Object<T extends Record<string, TSchema>>(properties: T, options?: SchemaOptions): TSchema {
    const required: string[] = [];
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

  String(options?: SchemaOptions): TSchema {
    return {
      [Kind]: "String",
      type: "string",
      ...options,
    };
  },

  Number(options?: SchemaOptions): TSchema {
    return {
      [Kind]: "Number",
      type: "number",
      ...options,
    };
  },

  Boolean(options?: SchemaOptions): TSchema {
    return {
      [Kind]: "Boolean",
      type: "boolean",
      ...options,
    };
  },

  Optional<T extends TSchema>(schema: T): T {
    return {
      ...schema,
      [OptionalModifier]: "Optional",
    };
  },

  Array<T extends TSchema>(itemSchema: T, options?: SchemaOptions): TSchema {
    return {
      [Kind]: "Array",
      type: "array",
      items: itemSchema,
      ...options,
    };
  },

  Union(schemas: TSchema[], options?: SchemaOptions): TSchema {
    return {
      [Kind]: "Union",
      anyOf: schemas,
      ...options,
    };
  },

  Literal(value: string | number | boolean, options?: SchemaOptions): TSchema {
    return {
      [Kind]: "Literal",
      const: value,
      type: typeof value,
      ...options,
    };
  },
};

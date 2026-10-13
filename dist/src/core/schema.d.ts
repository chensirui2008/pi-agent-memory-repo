/**
 * Lightweight, zero-dependency TypeBox-compatible JSON Schema builder.
 * Produces standard JSON Schema objects compatible with Pi tool registration.
 */
declare const Kind: unique symbol;
declare const OptionalModifier: unique symbol;
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
export declare const Type: {
    Object<T extends Record<string, TSchema>>(properties: T, options?: SchemaOptions): TSchema;
    String(options?: SchemaOptions): TSchema;
    Number(options?: SchemaOptions): TSchema;
    Boolean(options?: SchemaOptions): TSchema;
    Optional<T extends TSchema>(schema: T): T;
    Array<T extends TSchema>(itemSchema: T, options?: SchemaOptions): TSchema;
    Union(schemas: TSchema[], options?: SchemaOptions): TSchema;
    Literal(value: string | number | boolean, options?: SchemaOptions): TSchema;
};
export {};
//# sourceMappingURL=schema.d.ts.map
import type { Lifecycle } from './constants';

type SymbolKeyof<T> = Extract<keyof T, symbol>;

type MapKeys<TSchema, TDepKeys extends readonly (keyof TSchema)[]> = {
    [K in keyof TDepKeys]: TDepKeys[K] extends keyof TSchema
        ? TSchema[TDepKeys[K]]
        : never;
}

export type AddService<
    TServiceSchema extends {[K in symbol]: unknown},
    TKey extends symbol,
    TService,
> = TServiceSchema & {[K in TKey]: TService};

type ServiceFactories<TServiceSchema extends {[K in symbol]: unknown}> = {
    [K in SymbolKeyof<TServiceSchema>]: {
        lifecycle: Lifecycle,
        deps: readonly SymbolKeyof<TServiceSchema>[];
        factory(...args: TServiceSchema[SymbolKeyof<TServiceSchema>][]): TServiceSchema[K];
    };
};

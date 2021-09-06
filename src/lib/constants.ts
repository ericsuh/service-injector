export const kServiceLifecycle = Symbol.for('kServiceLifecycle');
export const kServiceKey = Symbol.for('kServiceKey');
export const kServiceDeps = Symbol.for('kServiceDeps');

export enum Lifecycle {
    GlobalSingleton,
    LocalSingleton,
    Ephemeral,
}

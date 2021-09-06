import { ServiceRegistry, Lifecycle } from '../';

const a: unique symbol = Symbol('a');
const b: unique symbol = Symbol('b');
const c: unique symbol = Symbol('c');

type Sch = {
    [a]: {val: 'foo'};
    [b]: {tal: string};
    [c]: {val: boolean};
}

const registry: ServiceRegistry<Sch> = ServiceRegistry.getRoot()
    .registerFactory({key: a, deps: [], factory: () => { return {val: 'foo' as 'foo'}; }})
    .registerFactory({lifecycle: Lifecycle.LocalSingleton, key: b, deps: [a] as const, factory: (x: {val: string}) => {
        return {tal: x.val + 'bar'};
    }})
    .registerFactory({lifecycle: Lifecycle.LocalSingleton, key: c, deps: [b, a] as const, factory: (x: {tal: string}, y: {val: string}) => {
        return {val: Boolean(x.tal + y.val)};
    }});

const d: {val: boolean} = registry.get(c);

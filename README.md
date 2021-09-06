# Fully-typed service object injector

This is a very lightweight framework that can be used for dependency injection. It has a couple of features:

- No metaprogramming or reflection
- No runtime dependencies
- Uses unique symbols to register particular service objects, to prevent collisions
- Handles both singletons and non-singletons ("ephemeral" objects)

## Examples

```typescript
import {
    kServiceDeps,
    kServiceKey,
    kServiceLifecycle,
    Lifecycle,
    ServiceInjector,
} from 'service-injector';

class A {
    static readonly [kServiceKey] = Symbol('A');
    static readonly [kServiceDeps] = [] as const;
    static readonly [kServiceLifecycle] = Lifecycle.GlobalSingleton;
    
    public readonly foo: string;

    constructor() {
        this.foo = 'A';
    }
}

class B {
    static readonly [kServiceKey] = Symbol('B');
    static readonly [kServiceDeps] = [A[kServiceKey]] as const;
    static readonly [kServiceLifecycle] = Lifecycle.Ephemeral;
    
    constructor(public readonly a: A) { }
    
    public appendToA(s: string): string {
        return a.foo + s;
    }
}

class C {
    static readonly [kServiceKey] = Symbol('C');
    static readonly [kServiceDeps] = [B[kServiceKey], A[kServiceKey]] as const;
    static readonly [kServiceLifecycle] = Lifecycle.GlobalSingleton;
    
    public readonly a: A;
    public readonly b: B;
    
    constructor(b: B, a: A) {
        this.b = b;
        this.a = a;
    }
    
    public buzz(): string {
        return this.b(this.a.foo);
    }
}

const injector = ServiceInjector.getRoot()
    .registerClass(A)
    .registerClass(B)
    .registerClass(C);

const c = injector.get(C[kServiceKey]);

console.log(c.buzz()); // 'AA';

// These are the same object, because A is a singleton
assert(c.a === injector.get(A[kServiceKey]));
```
import { MissingDependencyError } from './errors';

/*
 * Configure the various parts of a service object
 *
 * The order of elements in `deps` must match the corresponding
 * order of arguments for `factory()`.
 */
type ServiceFactoryOpts<
    TServiceSchema,
    TDeps extends readonly (keyof TServiceSchema)[],
    TKey extends symbol,
    TService,
> = {
    /**
     * Unique symbol representing this service
     *
     * We use unique symbols instead of string keys in order to prevent
     * key collisions
     */
    key: TKey;
    /** _Readonly tuple_ of keys of dependencies */
    deps: TDeps;
    /** Function that will instantiate the service object, given dependencies */
    factory: (...args: MapKeys<TServiceSchema, TDeps>) => TService;
    /**
     * How this service object should be instantiated and shared.
     *
     * Default: Lifecycle.GlobalSingleton
     */
    lifecycle?: Lifecycle,
}

/**
 * A class-based alternative to ServiceFactoryOpts
 *
 * Instead of a configuration object, define a class with static fields using
 * the symbols `kServiceKey`, `kServiceDeps`, and (optionally) `kServiceLifecycle`.
 * The use of symbols ensures that the fields will never collide with other
 * possible properties/methods.
 */
type ServiceConstructor<
    TServiceSchema,
    TDeps extends readonly (keyof TServiceSchema)[],
    TKey extends symbol,
    TService,
> = {
    readonly [kServiceLifecycle]?: Lifecycle;
    readonly [kServiceKey]: TKey;
    readonly [kServiceDeps]: TDeps,
    new(...deps: MapKeys<TServiceSchema, TDeps>): TService;
}

/**
 * Registers and injects service objects, following a dependency graph
 */
export class ServiceInjector<TServiceSchema extends {[K in symbol]: unknown}> {
    /**
     * Return a root registry. This has no service objects registered.
     */
    public static getRoot(): ServiceInjector<Record<never, never>> {
        if (!this.instance) {
            this.instance = new ServiceInjector({}, {});
        }
        return this.instance;
    }

    /**
     * Create a copy of this registry
     * 
     * This is mostly useful when you are using `LocalSingleton` services and want
     * to have two different "scopes" that return different instances of those
     * `LocalSingletons`, since they are cached in `ServiceInjector` instance variables.
     */
    public fork(): ServiceInjector<TServiceSchema> {
        return new ServiceInjector(
            {...this.factories},
            {...this.cache},
        )
    }

    /**
     * Register a service object constructed by a factory function
     *
     * Note, this is NOT a mutating method, so the injector on which you call this
     * method will NOT have this service object registered. Instead, the injector
     * _returned_ from this method is what has the new service object registered.
     * This allows us to do more rigorous typechecking that prevents some (but not all)
     * circular dependencies.
     *  
     * @param lifecycle How this service object should be instantiated.
     * @param key The unique key by which this object should be fetched. This should be
     *      a unique symbol object (e.g. gotten as `Symbol.for('my-class')`)
     * @param deps A tuple of the keys corresponding to the dependencies present in
     *      the factory function. The order of the keys and the arguments must match.
     * @param factory A factory function that instantiates the service object given
     *      its dependencies. This is not called until `.get(key)` is called.
     * 
     * @returns A new instance of ServiceRegistry that can use this factory.
     *
     */
    public registerFactory<
        TKey extends symbol,
        TDeps extends readonly SymbolKeyof<TServiceSchema>[],
        TService,
    >(
        {
            key,
            deps,
            factory,
            lifecycle = Lifecycle.GlobalSingleton,
        }: ServiceFactoryOpts<TServiceSchema, TKey, TDeps, TService>
    ): ServiceInjector<AddService<TServiceSchema, TKey, TService>> {
        for (const dep of deps) {
            if (this.factories[dep] === undefined) {
                throw new MissingDependencyError(
                    `Missing dependency: ${dep}`
                );
            }
        }
        return new ServiceInjector<AddService<TServiceSchema, TKey, TService>>(
            {
                ...this.factories,
                [key]: {
                    lifecycle,
                    deps,
                    factory,
                },
            } as unknown as ServiceFactories<AddService<TServiceSchema, TKey, TService>>,
            { ...this.cache } as Partial<AddService<TServiceSchema, TKey, TService>>,
        );
    }

    /**
     * A class-based service object
     * 
     * This constructs a class-based object. The class must implement the following fields:
     * 
     * - [kServiceType]: How this object should be instantiated.
     * - [kServiceKey]: The unique key by which this object should be fetched. This should be
     *      a unique symbol object (e.g. gotten as `Symbol.for('my-class')`)
     * - [kServiceDeps]: A tuple of the keys corresponding to the dependencies present in
     *      the constructor. The order of the keys and the arguments must match.
     * ```
     */
    public registerClass<
        TKey extends symbol,
        TDeps extends readonly SymbolKeyof<TServiceSchema>[],
        TService,
    >(
        classConstructor: {
            readonly [kServiceLifecycle]: Lifecycle;
            readonly [kServiceKey]: TKey;
            readonly [kServiceDeps]: TDeps,
            new(...deps: MapKeys<TServiceSchema, TDeps>): TService;
        },
    ): ServiceInjector<AddService<TServiceSchema, TKey, TService>> {
        return this.registerFactory({
            lifecycle: classConstructor[kServiceLifecycle],
            key: classConstructor[kServiceKey],
            deps: classConstructor[kServiceDeps],
            factory: (...args: MapKeys<TServiceSchema, TDeps>) => new classConstructor(...args),
        });
    }
    
    /**
     * Get an instance of a particular registered service
     * 
     * @param key The key by which the desired service object was registered. If the service
     *   object is a singleton, it will be returned from the cache.
     */
    public get<TKey extends SymbolKeyof<TServiceSchema>>(key: TKey): TServiceSchema[TKey] {
        const { lifecycle, deps: depKeys, factory } = this.factories[key];
        if (lifecycle === Lifecycle.GlobalSingleton) {
            const maybeGlobal = ServiceInjector.globalCache[key];
            if (maybeGlobal) {
                return maybeGlobal as TServiceSchema[TKey];
            }
        } else if (lifecycle === Lifecycle.LocalSingleton) {
            const maybeLocal = this.cache[key];
            if (maybeLocal) {
                return maybeLocal as TServiceSchema[TKey];
            }
        }
        const deps = depKeys.map((key) => this.get(key));
        const instance = factory(...deps);
        if (lifecycle === Lifecycle.GlobalSingleton) {
            ServiceInjector.globalCache[key] = instance;
        } else if (lifecycle === Lifecycle.LocalSingleton) {
            this.cache[key] = instance as TServiceSchema[TKey];
        }
        return instance as unknown as TServiceSchema[TKey];
    }

    /**
     * Make an ephemeral instance of something without registering
     * 
     * Usually this is for ephemeral functions or other end-use systems that don't need
     * registering, as they won't be used as dependencies of any other system.
     */
    public make<T, TDeps extends readonly SymbolKeyof<TServiceSchema>[]>(
        depKeys: TDeps,
        factory: (...args: MapKeys<TServiceSchema, TDeps>) => T,
    ): T {
        const deps = depKeys.map((key) => this.get(key)) as unknown as MapKeys<TServiceSchema, TDeps>;
        return factory(...deps);
    }
    
    private static instance: ServiceInjector<Record<never, never>>;
    private static globalCache: {[K in symbol]: unknown};
    private constructor(
        private readonly factories: ServiceFactories<TServiceSchema>,
        private readonly cache: Partial<TServiceSchema>,
    ) { }
}

/* eslint-disable @typescript-eslint/ban-ts-comment */
// This rule bans @ts-expect-error comments without explanation. In this file, we use it to test our types, and
// explanation is provided in header comments before each test.

import { safeProvider } from "./safe-provider";

class FooFactory {
  create() {
    return "thing";
  }
}

abstract class FooService {
  abstract createFoo(str: string): string;
}

class DefaultFooService implements FooService {
  constructor(private factory: FooFactory) {}

  createFoo(str: string) {
    return str ?? this.factory.create();
  }
}

class BarFactory {
  create() {
    return 5;
  }
}

abstract class BarService {
  abstract createBar(num: number): number;
}

class DefaultBarService implements BarService {
  constructor(private factory: BarFactory) {}

  createBar(num: number) {
    return num ?? this.factory.create();
  }
}

abstract class FooBarService {}

class DefaultFooBarService {
  constructor(
    private fooFactory: FooFactory,
    private barFactory: BarFactory,
  ) {}
}

// useClass happy path with deps
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
  deps: [FooFactory],
});

// useClass happy path with useAngularDecorators
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
  useAngularDecorators: true,
});

// useClass: expect error if implementation does not match abstraction
safeProvider({
  provide: FooService,
  // @ts-expect-error
  useClass: DefaultBarService,
  deps: [BarFactory],
});

// useClass: expect error if deps type does not match
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
  // @ts-expect-error
  deps: [BarFactory],
});

// useClass: expect error if not enough deps specified
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
  // @ts-expect-error
  deps: [],
});

// useClass: expect error if too many deps specified
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
  // @ts-expect-error
  deps: [FooFactory, BarFactory],
});

// useClass: expect error if deps are in the wrong order
safeProvider({
  provide: FooBarService,
  useClass: DefaultFooBarService,
  // @ts-expect-error
  deps: [BarFactory, FooFactory],
});

// useClass: expect error if no deps specified and not using Angular decorators
// @ts-expect-error
safeProvider({
  provide: FooService,
  useClass: DefaultFooService,
});

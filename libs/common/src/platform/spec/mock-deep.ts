// This is a modification of the code found in https://github.com/marchaos/jest-mock-extended
// to better support deep mocking of objects.

// MIT License

// Copyright (c) 2019 Marc McIntyre

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { jest } from "@jest/globals";
import { FunctionLike } from "jest-mock";
import { calledWithFn, MatchersOrLiterals } from "jest-mock-extended";
import { PartialDeep } from "type-fest";

type ProxiedProperty = string | number | symbol;

export interface GlobalConfig {
  // ignoreProps is required when we don't want to return anything for a mock (for example, when mocking a promise).
  ignoreProps?: ProxiedProperty[];
}

const DEFAULT_CONFIG: GlobalConfig = {
  ignoreProps: ["then"],
};

let GLOBAL_CONFIG = DEFAULT_CONFIG;

export const JestMockExtended = {
  DEFAULT_CONFIG,
  configure: (config: GlobalConfig) => {
    // Shallow merge so they can override anything they want.
    GLOBAL_CONFIG = { ...DEFAULT_CONFIG, ...config };
  },
  resetConfig: () => {
    GLOBAL_CONFIG = DEFAULT_CONFIG;
  },
};

export interface CalledWithMock<T extends FunctionLike> extends jest.Mock<T> {
  calledWith: (...args: [...MatchersOrLiterals<Parameters<T>>]) => jest.Mock<T>;
}

export interface MockDeepMock<R> {
  mockDeep: () => DeepMockProxy<R>;
}

export interface ReplaceProperty<T> {
  /**
   * mockDeep will by default return a jest.fn() for all properties,
   * but this allows you to replace the property with a value.
   * @param value The value to replace the property with.
   */
  replaceProperty(value: T): void;
}

export type _MockProxy<T> = {
  [K in keyof T]: T[K] extends FunctionLike ? T[K] & CalledWithMock<T[K]> : T[K];
};

export type MockProxy<T> = _MockProxy<T> & T;

export type _DeepMockProxy<T> = {
  // This supports deep mocks in the else branch
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? T[K] & CalledWithMock<T[K]> & MockDeepMock<R>
    : T[K] & ReplaceProperty<T[K]> & _DeepMockProxy<T[K]>;
};

// we intersect with T here instead of on the mapped type above to
// prevent immediate type resolution on a recursive type, this will
// help to improve performance for deeply nested recursive mocking
// at the same time, this intersection preserves private properties
export type DeepMockProxy<T> = _DeepMockProxy<T> & T;

export type _DeepMockProxyWithFuncPropSupport<T> = {
  // This supports deep mocks in the else branch
  [K in keyof T]: T[K] extends FunctionLike
    ? CalledWithMock<T[K]> & DeepMockProxy<T[K]>
    : DeepMockProxy<T[K]>;
};

export type DeepMockProxyWithFuncPropSupport<T> = _DeepMockProxyWithFuncPropSupport<T> & T;

export interface MockOpts {
  deep?: boolean;
  fallbackMockImplementation?: (...args: any[]) => any;
}

export const mockClear = (mock: MockProxy<any>) => {
  for (const key of Object.keys(mock)) {
    if (mock[key] === null || mock[key] === undefined) {
      continue;
    }

    if (mock[key]._isMockObject) {
      mockClear(mock[key]);
    }

    if (mock[key]._isMockFunction) {
      mock[key].mockClear();
    }
  }

  // This is a catch for if they pass in a jest.fn()
  if (!mock._isMockObject) {
    return mock.mockClear();
  }
};

export const mockReset = (mock: MockProxy<any>) => {
  for (const key of Object.keys(mock)) {
    if (mock[key] === null || mock[key] === undefined) {
      continue;
    }

    if (mock[key]._isMockObject) {
      mockReset(mock[key]);
    }
    if (mock[key]._isMockFunction) {
      mock[key].mockReset();
    }
  }

  // This is a catch for if they pass in a jest.fn()
  // Worst case, we will create a jest.fn() (since this is a proxy)
  // below in the get and call mockReset on it
  if (!mock._isMockObject) {
    return mock.mockReset();
  }
};

export function mockDeep<T>(
  opts: {
    funcPropSupport?: true;
    fallbackMockImplementation?: MockOpts["fallbackMockImplementation"];
  },
  mockImplementation?: PartialDeep<T>,
): DeepMockProxyWithFuncPropSupport<T>;
export function mockDeep<T>(mockImplementation?: PartialDeep<T>): DeepMockProxy<T>;
export function mockDeep(arg1: any, arg2?: any) {
  const [opts, mockImplementation] =
    typeof arg1 === "object" &&
    (typeof arg1.fallbackMockImplementation === "function" || arg1.funcPropSupport === true)
      ? [arg1, arg2]
      : [{}, arg1];
  return mock(mockImplementation, {
    deep: true,
    fallbackMockImplementation: opts.fallbackMockImplementation,
  });
}

const overrideMockImp = (obj: PartialDeep<any>, opts?: MockOpts) => {
  const proxy = new Proxy<MockProxy<any>>(obj, handler(opts));
  for (const name of Object.keys(obj)) {
    if (typeof obj[name] === "object" && obj[name] !== null) {
      proxy[name] = overrideMockImp(obj[name], opts);
    } else {
      proxy[name] = obj[name];
    }
  }

  return proxy;
};

const handler = (opts?: MockOpts): ProxyHandler<any> => ({
  ownKeys(target: MockProxy<any>) {
    return Reflect.ownKeys(target);
  },

  set: (obj: MockProxy<any>, property: ProxiedProperty, value: any) => {
    obj[property] = value;
    return true;
  },

  get: (obj: MockProxy<any>, property: ProxiedProperty) => {
    const fn = calledWithFn({ fallbackMockImplementation: opts?.fallbackMockImplementation });

    if (!(property in obj)) {
      if (GLOBAL_CONFIG.ignoreProps?.includes(property)) {
        return undefined;
      }
      // Jest's internal equality checking does some wierd stuff to check for iterable equality
      if (property === Symbol.iterator) {
        return obj[property];
      }

      if (property === "_deepMock") {
        return obj[property];
      }
      // So this calls check here is totally not ideal - jest internally does a
      // check to see if this is a spy - which we want to say no to, but blindly returning
      // an proxy for calls results in the spy check returning true. This is another reason
      // why deep is opt in.
      if (opts?.deep && property !== "calls") {
        obj[property] = new Proxy<MockProxy<any>>(fn, handler(opts));
        obj[property].replaceProperty = <T extends typeof obj, K extends keyof T>(value: T[K]) => {
          obj[property] = value;
        };
        obj[property].mockDeep = () => {
          if (obj[property]._deepMock) {
            return obj[property]._deepMock;
          }

          const mock = mockDeep({
            fallbackMockImplementation: opts?.fallbackMockImplementation,
          });
          (obj[property] as CalledWithMock<any>).mockReturnValue(mock);
          obj[property]._deepMock = mock;
          return mock;
        };
        obj[property]._isMockObject = true;
      } else {
        obj[property] = calledWithFn({
          fallbackMockImplementation: opts?.fallbackMockImplementation,
        });
      }
    }

    // @ts-expect-error Hack by author of jest-mock-extended
    if (obj instanceof Date && typeof obj[property] === "function") {
      // @ts-expect-error Hack by author of jest-mock-extended
      return obj[property].bind(obj);
    }

    return obj[property];
  },
});

const mock = <T, MockedReturn extends MockProxy<T> & T = MockProxy<T> & T>(
  mockImplementation: PartialDeep<T> = {} as PartialDeep<T>,
  opts?: MockOpts,
): MockedReturn => {
  // @ts-expect-error private
  mockImplementation!._isMockObject = true;
  return overrideMockImp(mockImplementation, opts);
};

export const mockFn = <T extends FunctionLike>(): CalledWithMock<T> & T => {
  // @ts-expect-error Hack by author of jest-mock-extended
  return calledWithFn();
};

export const stub = <T extends object>(): T => {
  return new Proxy<T>({} as T, {
    get: (obj, property: ProxiedProperty) => {
      if (property in obj) {
        // @ts-expect-error Hack by author of jest-mock-extended
        return obj[property];
      }
      return jest.fn();
    },
  });
};

export default mock;

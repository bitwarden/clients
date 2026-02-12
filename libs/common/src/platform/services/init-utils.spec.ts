import { topologicalSort } from "./init-utils";

// Mock types for testing (avoiding the strict Dependency type)
type MockToken = any;
type MockService = {
  dependencies?: MockToken[];
  value?: string;
  constructor?: { name?: string };
};

describe("topologicalSort", () => {
  it("should sort services with linear dependencies", () => {
    class A {}
    class B {}
    class C {}

    const a: MockService = { dependencies: [], value: "a" };
    const b: MockService = { dependencies: [A], value: "b" };
    const c: MockService = { dependencies: [B], value: "c" };

    const sorted = topologicalSort([c, b, a], [C, B, A]);

    expect(sorted.map((s) => s.value)).toEqual(["a", "b", "c"]);
  });

  it("should handle complex dependency graph", () => {
    // Graph: A <- B <- D
    //        A <- C <- D
    class A {}
    class B {}
    class C {}
    class D {}

    const a: MockService = { dependencies: [], value: "a" };
    const b: MockService = { dependencies: [A], value: "b" };
    const c: MockService = { dependencies: [A], value: "c" };
    const d: MockService = { dependencies: [B, C], value: "d" };

    const sorted = topologicalSort([d, c, b, a], [D, C, B, A]);
    const values = sorted.map((s) => s.value);

    // A must come first, D must come last, B and C can be in any order
    expect(values[0]).toBe("a");
    expect(values[3]).toBe("d");
    expect(new Set(values.slice(1, 3))).toEqual(new Set(["b", "c"]));
  });

  it("should handle services with no dependencies", () => {
    class A {}
    class B {}

    const a: MockService = { value: "a" };
    const b: MockService = { value: "b" };

    const sorted = topologicalSort([b, a], [B, A]);

    // Without dependencies, order should be preserved (registration order)
    expect(sorted.map((s) => s.value)).toEqual(["b", "a"]);
  });

  it("should detect circular dependencies", () => {
    class A {}
    class B {}

    const a: MockService = {
      dependencies: [B],
      constructor: { name: "ServiceA" },
    };
    const b: MockService = {
      dependencies: [A],
      constructor: { name: "ServiceB" },
    };

    expect(() => topologicalSort([a, b], [A, B])).toThrow(/Circular dependency detected/);
  });

  it("should detect circular dependencies in longer chains", () => {
    class A {}
    class B {}
    class C {}

    const a: MockService = {
      dependencies: [C],
      constructor: { name: "ServiceA" },
    };
    const b: MockService = {
      dependencies: [A],
      constructor: { name: "ServiceB" },
    };
    const c: MockService = {
      dependencies: [B],
      constructor: { name: "ServiceC" },
    };

    expect(() => topologicalSort([a, b, c], [A, B, C])).toThrow(/Circular dependency detected/);
  });

  it("should throw error for missing dependency", () => {
    class A {}
    class B {}

    const a: MockService = {
      dependencies: [B],
      constructor: { name: "ServiceA" },
    };

    expect(() => topologicalSort([a], [A])).toThrow(/depends on.*but.*is not registered/);
  });

  it("should use 'Unknown' as service name if constructor.name is unavailable", () => {
    class A {}
    class B {}

    const a = Object.create(null);
    a.dependencies = [B];

    expect(() => topologicalSort([a], [A])).toThrow(/Unknown depends on/);
  });

  it("should handle empty services array", () => {
    const sorted = topologicalSort([], []);

    expect(sorted).toEqual([]);
  });

  it("should handle single service with no dependencies", () => {
    class A {}

    const a: MockService = { value: "a" };

    const sorted = topologicalSort([a], [A]);

    expect(sorted).toEqual([a]);
  });

  it("should handle multiple independent services", () => {
    class A {}
    class B {}
    class C {}

    const a: MockService = { dependencies: [], value: "a" };
    const b: MockService = { dependencies: [], value: "b" };
    const c: MockService = { dependencies: [], value: "c" };

    const sorted = topologicalSort([c, b, a], [C, B, A]);

    // Independent services maintain registration order
    expect(sorted.map((s) => s.value)).toEqual(["c", "b", "a"]);
  });

  it("should handle diamond dependency pattern", () => {
    // Graph:     D
    //           / \
    //          B   C
    //           \ /
    //            A
    class A {}
    class B {}
    class C {}
    class D {}

    const a: MockService = { dependencies: [], value: "a" };
    const b: MockService = { dependencies: [A], value: "b" };
    const c: MockService = { dependencies: [A], value: "c" };
    const d: MockService = { dependencies: [B, C], value: "d" };

    const sorted = topologicalSort([d, c, b, a], [D, C, B, A]);
    const values = sorted.map((s) => s.value);

    // A must come first, D must come last
    expect(values[0]).toBe("a");
    expect(values[3]).toBe("d");
    // B and C must come after A but before D
    expect(new Set(values.slice(1, 3))).toEqual(new Set(["b", "c"]));
  });
});

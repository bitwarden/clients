import { Matrix } from "./matrix";

class TestObject {
  value: number = 0;

  constructor() {}

  increment() {
    this.value++;
  }
}

describe("matrix", () => {
  it("caches entries in a matrix properly with a single argument", () => {
    const mockFunction = jest.fn<TestObject, [arg1: string]>();
    const getter = Matrix.autoMockMethod(mockFunction, () => new TestObject());

    const obj = getter("test1");
    expect(obj.value).toBe(0);

    // Change the state of the object
    obj.increment();

    // Should return the same instance the second time this is called
    expect(getter("test1").value).toBe(1);

    // Using the getter should not call the mock function
    expect(mockFunction).not.toHaveBeenCalled();

    const mockedFunctionReturn1 = mockFunction("test1");
    expect(mockedFunctionReturn1.value).toBe(1);

    // Totally new value
    const mockedFunctionReturn2 = mockFunction("test2");
    expect(mockedFunctionReturn2.value).toBe(0);

    expect(mockFunction).toHaveBeenCalledTimes(2);
  });

  it("caches entries in matrix properly with multiple arguments", () => {
    const mockFunction = jest.fn<TestObject, [arg1: string, arg2: number]>();

    const getter = Matrix.autoMockMethod(mockFunction, () => {
      return new TestObject();
    });

    const obj = getter("test1", 4);
    expect(obj.value).toBe(0);

    obj.increment();

    expect(getter("test1", 4).value).toBe(1);

    expect(mockFunction("test1", 3).value).toBe(0);
  });

  it("should give original args in creator even if it has multiple key layers", () => {
    const mockFunction = jest.fn<TestObject, [arg1: string, arg2: number, arg3: boolean]>();

    let invoked = false;

    const getter = Matrix.autoMockMethod(mockFunction, (args) => {
      expect(args).toHaveLength(3);
      expect(args[0]).toBe("test");
      expect(args[1]).toBe(42);
      expect(args[2]).toBe(true);

      invoked = true;

      return new TestObject();
    });

    getter("test", 42, true);
    expect(invoked).toBe(true);
  });
});

import { RpcError } from "./error";
import { executeBatchCommands } from "./executor";
import { BatchCommand, serializeSymbol } from "./protocol";
import { ReferenceStore } from "./reference-store";

describe("Batch executor", () => {
  let target: TestTarget;
  let referenceStore: ReferenceStore;

  beforeEach(() => {
    target = new TestTarget();
    referenceStore = new ReferenceStore();
  });

  it("returns error when command list is empty", async () => {
    const commands: BatchCommand[] = [];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({ status: "error", error: expect.any(RpcError) });
  });

  it.each([
    ["propString", "test"],
    ["propNumber", 42],
    ["propBoolean", true],
    ["propNull", null],
    ["propUndefined", undefined],
  ])("returns value of property when value is a primitive", async (propertyName, expectedValue) => {
    const commands: BatchCommand[] = [{ method: "get", propertyName }];

    const response = await executeBatchCommands(target, commands, referenceStore);

    expect(response).toEqual({
      status: "success",
      result: {
        type: "value",
        value: expectedValue,
      },
    });
    expect(referenceStore.size).toBe(0);
  });

  it("returns reference of property when value is an object", async () => {
    const commands: BatchCommand[] = [{ method: "get", propertyName: "propObject" }];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "reference",
        referenceId: 1,
        objectType: "TestObject",
      },
    });
    expect(referenceStore.size).toBe(1);
    expect(referenceStore.get<object>(1)).toEqual(new TestObject("example"));
  });

  it("returns value of property when transfer is explicitly requested", async () => {
    const commands: BatchCommand[] = [
      { method: "get", propertyName: "propObject" },
      { method: "transfer" },
    ];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "value",
        value: new TestObject("example"),
      },
    });
    expect(referenceStore.size).toBe(0);
  });

  it("returns function result when calling a method", async () => {
    const commands: BatchCommand[] = [
      { method: "get", propertyName: "getTestObject" },
      { method: "apply", args: ["arg"] },
    ];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "reference",
        referenceId: 1,
        objectType: "TestObject",
      },
    });
    expect(referenceStore.size).toBe(1);
    expect(referenceStore.get<object>(1)).toEqual(new TestObject("arg"));
  });

  it("returns function result when fetch and call is separate", async () => {
    const fetchCommands: BatchCommand[] = [{ method: "get", propertyName: "getPropString" }];
    const callCommands: BatchCommand[] = [{ method: "apply", args: [] }];

    const response = await executeBatchCommands(target, fetchCommands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "reference",
        referenceId: 1,
        objectType: "Function",
      },
    });
    expect(referenceStore.size).toBe(1);

    if (response.status === "error" || response.result.type !== "reference") {
      throw new Error("Unexpected response");
    }

    const functionRefId = response.result.referenceId;
    const fun = referenceStore.get<TestTarget["getTestObject"]>(functionRefId);
    const callResponse = await executeBatchCommands(fun!, callCommands, referenceStore);

    expect(callResponse).toEqual({
      status: "success",
      result: {
        type: "value",
        value: "test",
      },
    });
  });

  it("calls method fetched using symbol property", async () => {
    const commands: BatchCommand[] = [
      { method: "get", propertySymbol: serializeSymbol(Symbol.asyncDispose) },
      { method: "apply", args: [] },
    ];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "value",
        value: undefined,
      },
    });
    expect(target.dispose).toHaveBeenCalled();
  });

  it("is compatible with complex command sequences", async () => {
    const commands: BatchCommand[] = [
      { method: "get", propertyName: "child" },
      { method: "get", propertyName: "getTestObject" },
      { method: "apply", args: ["complex"] },
      { method: "get", propertyName: "name" },
    ];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response).toEqual({
      status: "success",
      result: {
        type: "value",
        value: "complex",
      },
    });
  });

  it("returns error when a command fails", async () => {
    const commands: BatchCommand[] = [
      { method: "get", propertyName: "nonExistentProperty" }, // This returns undefined
      { method: "get", propertyName: "nonExistentProperty" }, // Trying to get property of undefined
    ];

    const response = await executeBatchCommands(target, commands, referenceStore);
    expect(response.status).toBe("error");
    expect((response as any).error).toBeInstanceOf(Error);
  });
});

class TestTarget {
  dispose = jest.fn();

  propString: string = "test";
  propNumber: number = 42;
  propBoolean: boolean = true;
  propNull: null = null;
  propUndefined: undefined = undefined;
  propObject = new TestObject("example");

  [Symbol.dispose] = this.dispose;

  get child() {
    return new TestTarget();
  }

  getTestObject(name: string) {
    return new TestObject(name);
  }

  getPropString() {
    return this.propString;
  }
}

class TestObject {
  constructor(public name: string) {}

  getName() {
    return this.name;
  }
}

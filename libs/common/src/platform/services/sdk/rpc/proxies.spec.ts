import { Observable } from "rxjs";

import { ProxyInfo, RpcObjectReference } from "./proxies";
import { RpcRequestChannel } from "./client";
import { Command, Response } from "./protocol";

describe("Batching proxies", () => {
  let channel: RpcChannel;
  beforeEach(() => {
    channel = new RpcChannel();
  });

  it("creates an object reference proxy", () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference);
    expect(proxy[ProxyInfo]).toEqual({
      referenceId: 1,
      objectType: "TestObject",
      proxyType: "RpcObjectReference",
    });
  });

  it("awaiting the proxy returns the proxy itself", async () => {
    const reference = {
      referenceId: 1,
      objectType: "TestObject",
    };
    const proxy = RpcObjectReference(channel, reference);

    const awaited = await proxy;

    expect(awaited).toBe(proxy);
  });

  it("returns a pending object reference proxy when accesing a property", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const result = proxy.someProperty;

    expect(result[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(result[ProxyInfo].commands).toEqual([{ method: "get", propertyName: "someProperty" }]);
  });

  // it("accumulates commands when accessing multiple properties", async () => {
  //   const reference = { referenceId: 1, objectType: "TestObject" };
  //   const proxy = RpcObjectReference(channel, reference) as any;

  //   const pending = proxy.firstProperty.secondProperty.thirdProperty;

  //   expect(pending[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
  //   expect(pending[ProxyInfo].commands).toEqual([
  //     { method: "get", propertyName: "firstProperty" },
  //     { method: "get", propertyName: "secondProperty" },
  //     { method: "get", propertyName: "thirdProperty" },
  //   ]);
  // });

  it("returns a pending object reference proxy when calling a function", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;
    const args = [1, 2, 3];

    const result = proxy.someMethod(...args);

    expect(result[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(result[ProxyInfo].commands).toEqual([
      { method: "get", propertyName: "someMethod" },
      { method: "apply", args },
    ]);
  });

  it("returns a pending object reference proxy when awaiting", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const result = proxy.await;

    expect(result[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(result[ProxyInfo].commands).toEqual([{ method: "await" }]);
  });

  it("returns a pending object reference proxy when requesting value", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const result = proxy.transfer;

    expect(result[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(result[ProxyInfo].commands).toEqual([{ method: "transfer" }]);
  });

  it("returns all commands when accessing multiple props and functions", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const result = proxy.propOne.await.functionOne(9001).await.propTwo.await.transfer;

    expect(result[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(result[ProxyInfo].commands).toEqual([
      { method: "get", propertyName: "propOne" },
      { method: "await" },
      { method: "get", propertyName: "functionOne" },
      { method: "apply", args: [9001] },
      { method: "await" },
      { method: "get", propertyName: "propTwo" },
      { method: "await" },
      { method: "transfer" },
    ]);
  });

  it("sends batched commands when awaited", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    channel.responses.push({ status: "success", result: { type: "value", value: undefined } });
    expect(channel.outgoing).toHaveLength(0);

    await proxy.propOne.await.functionOne(9001).await.propTwo.await.transfer;

    expect(channel.outgoing).toHaveLength(1);
    expect(channel.outgoing[0]).toEqual({
      method: "batch",
      referenceId: 1,
      commands: [
        { method: "get", propertyName: "propOne" },
        { method: "await" },
        { method: "get", propertyName: "functionOne" },
        { method: "apply", args: [9001] },
        { method: "await" },
        { method: "get", propertyName: "propTwo" },
        { method: "await" },
        { method: "transfer" },
      ],
    } satisfies Command);
  });

  it("returns value when receiving a value response", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    channel.responses.push({ status: "success", result: { type: "value", value: 42 } });

    const result = await proxy.prop;

    expect(result).toBe(42);
  });

  it("returns reference when receiving a reference response", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    channel.responses.push({ status: "success", result: { type: "reference", referenceId: 2 } });

    const result = await proxy.prop;

    expect(result[ProxyInfo].referenceId).toBe(2);
  });

  it("throws error when receiving an error response", async () => {
    class TestError extends Error {
      constructor(
        message: string,
        public someProperty: string,
      ) {
        super(message);
      }
    }

    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;
    const error = new TestError("Something went wrong", "someValue");

    channel.responses.push({ status: "error", error });

    // Note: We are getting the actual error instance here because our
    // channel is a local mock. In a real RPC scenario, the error would be
    // serialized and deserialized, losing its prototype and properties.
    await expect(proxy.prop).rejects.toThrow(error);
  });
});

class RpcChannel implements RpcRequestChannel {
  outgoing: Command[] = [];
  responses: Response[] = [];

  sendCommand(command: Command): Promise<Response> {
    this.outgoing.push(command);
    return Promise.resolve(
      this.responses.shift() ?? { status: "error", error: "No response queued" },
    );
  }

  subscribeToRoot(): Observable<Response> {
    throw new Error("Method not implemented.");
  }
}

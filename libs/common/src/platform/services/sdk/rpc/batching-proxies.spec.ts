import { Observable } from "rxjs";

import { ProxyInfo, RpcObjectReference } from "./batching-proxies";
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

  // Not sure what await itself should do yet
  // it("should allow awaiting the proxy itself", async () => {
  //   const reference = {
  //     referenceId: 2,
  //     objectType: "AwaitableObject",
  //   };
  //   const proxy = RpcObjectReference(channel, reference);
  //   const awaited = await proxy;
  //   expect(awaited).toBe(proxy);
  // });

  it("returns a pending object reference proxy when accesing a property", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const someProperty = proxy.someProperty;

    expect(someProperty[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(someProperty[ProxyInfo].commands).toEqual([
      { method: "get", propertyName: "someProperty" },
    ]);
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

    const someMethod = proxy.someMethod(...args);

    expect(someMethod[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(someMethod[ProxyInfo].commands).toEqual([
      { method: "get", propertyName: "someMethod" },
      { method: "apply", args },
    ]);
  });

  it("returns a pending object reference proxy when awaiting", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const someMethod = proxy.await;

    expect(someMethod[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(someMethod[ProxyInfo].commands).toEqual([{ method: "await" }]);
  });

  it("returns a pending object reference proxy when requesting value", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const someMethod = proxy.transfer;

    expect(someMethod[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(someMethod[ProxyInfo].commands).toEqual([{ method: "transfer" }]);
  });

  it("returns all commands when accessing multiple props and functions", async () => {
    const reference = { referenceId: 1, objectType: "TestObject" };
    const proxy = RpcObjectReference(channel, reference) as any;

    const someMethod = proxy.propOne.await.functionOne(9001).await.propTwo.await.transfer;

    expect(someMethod[ProxyInfo].proxyType).toBe("RpcPendingObjectReference");
    expect(someMethod[ProxyInfo].commands).toEqual([
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
});

class RpcChannel implements RpcRequestChannel {
  outgoing: Command[] = [];
  waitingResponses: Array<(response: Response) => void> = [];

  sendCommand(command: Command): Promise<Response> {
    return new Promise((resolve) => {
      this.waitingResponses.push(resolve);
      this.outgoing.push(command);
    });
  }

  subscribeToRoot(): Observable<Response> {
    throw new Error("Method not implemented.");
  }

  respond(response: Response) {
    const resolver = this.waitingResponses.shift();
    if (resolver) {
      resolver(response);
    }
  }
}

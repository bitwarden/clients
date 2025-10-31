import { firstValueFrom, map, Observable } from "rxjs";

import { Rc } from "../../../misc/reference-counting/rc";

import { RpcClient, RpcRequestChannel } from "./client";
import { Command, Response } from "./protocol";
import { RpcObjectReference } from "./proxies";
import { RpcServer } from "./server";

describe("RpcServer", () => {
  let server!: RpcServer<TestClass>;
  let client!: RpcClient<TestClass>;

  beforeEach(() => {
    server = new RpcServer<TestClass>();
    client = new RpcClient<TestClass>(new InMemoryChannel(server));

    server.setValue(new TestClass());
  });

  it("fetches property value", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const value = await remoteInstance.value;

    expect(value).toBe(42);
  });

  it("calls sync function and returns value", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const result = await remoteInstance.greet("World");

    expect(result).toBe("Hello, World!");
  });

  it("calls async function and returns value", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const result = await remoteInstance.greetAsync("Async World");

    expect(result).toBe("Hello, Async World!");
  });

  it("references Wasm-like object with pointer and free method", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const wasmObj = await remoteInstance.getWasmGreeting("Wasm World");
    const greeting = await wasmObj.greet();

    expect(wasmObj).toBeInstanceOf(RpcObjectReference);
    expect(greeting).toBe("Hello, Wasm World!");
  });

  it("returns plain objects by value", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const result = await remoteInstance.echo({
      message: "Hello, World!",
      array: [1, "2", null],
    });

    expect(result).not.toBeInstanceOf(RpcObjectReference);
    expect(result).toEqual({ message: "Hello, World!", array: [1, "2", null] });
  });

  it("handles RC objects correctly", async () => {
    const wasmObj = new WasmLikeObject("RC");
    const rcValue = new Rc(wasmObj);
    const server = new RpcServer<Rc<WasmLikeObject>>();
    const client = new RpcClient<Rc<WasmLikeObject>>(new InMemoryChannel(server));
    server.setValue(rcValue);

    const remoteRc = await firstValueFrom(client.getRoot());

    {
      using ref = await remoteRc.take();
      const remoteWasmObj = ref.value;
      const greeting = await remoteWasmObj.testClass().await.greet("RC");
      expect(greeting).toBe("Hello, RC!");
      expect(wasmObj.freed).toBe(false);
    }

    await remoteRc.markForDisposal();
    expect(wasmObj.freed).toBe(true);
  });
});

class TestClass {
  value: number = 42;

  greet(name: string): string {
    return `Hello, ${name}!`;
  }

  async greetAsync(name: string): Promise<string> {
    return `Hello, ${name}!`;
  }

  getWasmGreeting(name: string): WasmLikeObject {
    return new WasmLikeObject(name);
  }

  echo<T>(obj: T): T {
    return obj;
  }
}

class WasmLikeObject {
  ptr: number;
  freed = false;

  constructor(private name: string) {
    this.ptr = 0; // Simulated pointer
  }

  free() {
    this.freed = true;
  }

  async greet(): Promise<string> {
    return `Hello, ${this.name}!`;
  }

  async testClass(): Promise<TestClass> {
    return new TestClass();
  }
}

class InMemoryChannel<T> implements RpcRequestChannel {
  constructor(private server: RpcServer<T>) {}

  async sendCommand(command: Command): Promise<Response> {
    // Simulate serialization/deserialization
    command = JSON.parse(JSON.stringify(command));
    let response = await this.server.handle(command);
    // Simulate serialization/deserialization
    response = JSON.parse(JSON.stringify(response));
    return response;
  }

  subscribeToRoot(): Observable<Response> {
    return this.server.value$.pipe(map((result) => ({ status: "success", result })));
  }
}

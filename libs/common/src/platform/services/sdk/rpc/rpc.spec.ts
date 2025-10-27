import { firstValueFrom, map, Observable } from "rxjs";

import { RpcClient, RpcRequestChannel } from "./client";
import { Command, Response } from "./protocol";
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

    expect(greeting).toBe("Hello, Wasm World!");
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
}

class WasmLikeObject {
  ptr: number;

  constructor(private name: string) {
    this.ptr = 0; // Simulated pointer
  }

  free() {
    // Simulated free method
  }

  async greet(): Promise<string> {
    return `Hello, ${this.name}!`;
  }
}

class InMemoryChannel implements RpcRequestChannel {
  constructor(private server: RpcServer<TestClass>) {}

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

import { firstValueFrom, map, Observable } from "rxjs";

import { RpcClient, RpcRequestChannel } from "./client";
import { Response } from "./protocol";
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

  it.skip("calls sync function and returns value", async () => {
    const remoteInstance = await firstValueFrom(client.getRoot());

    const result = await remoteInstance.greet("World");

    expect(result).toBe("Hello, World!");
  });
});

class TestClass {
  value: number = 42;

  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

class InMemoryChannel implements RpcRequestChannel {
  constructor(private server: RpcServer<TestClass>) {}

  async sendCommand(command: any): Promise<any> {
    return this.server.handle(command);
  }

  subscribeToRoot(): Observable<Response> {
    return this.server.value$.pipe(map((result) => ({ status: "success", result })));
  }
}

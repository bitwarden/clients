import { EventEmitter } from "node:events";

import { untilStopped } from "./serve.command";

describe("untilStopped", () => {
  it("stays pending while the server runs", async () => {
    const source = new EventEmitter();
    const settled = jest.fn();

    void untilStopped(source, "localhost:8087").then(settled);
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
  });

  it("succeeds when the server closes", async () => {
    const source = new EventEmitter();
    const result = untilStopped(source, "localhost:8087");

    source.emit("close");

    expect((await result).success).toBe(true);
  });

  it("fails when the server errors", async () => {
    const source = new EventEmitter();
    const result = untilStopped(source, "localhost:8087");

    source.emit("error", new Error("EADDRINUSE"));

    const response = await result;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Cannot serve on localhost:8087: EADDRINUSE");
  });
});

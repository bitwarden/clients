import { IpcMessage, isIpcMessage, reconstructIpcMessage } from "./ipc-message";

describe("isIpcMessage", () => {
  it("returns true for an object tagged with the IPC message type", () => {
    expect(isIpcMessage({ type: "bitwarden-ipc-message" })).toBe(true);
  });

  it("returns false for other objects and nullish values", () => {
    expect(isIpcMessage({ type: "something-else" })).toBe(false);
    expect(isIpcMessage(null)).toBe(false);
    expect(isIpcMessage(undefined)).toBe(false);
  });
});

describe("reconstructIpcMessage", () => {
  const destination = {
    BrowserBackground: undefined,
  } as unknown as IpcMessage["message"]["destination"];

  it("copies the destination, payload, and topic of the inner message", () => {
    const result = reconstructIpcMessage({
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1, 2, 3], topic: "topic" },
    });

    expect(result).toEqual({
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1, 2, 3], topic: "topic" },
    });
  });

  it("drops extra top-level properties a page may have attached", () => {
    const result = reconstructIpcMessage({
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1], topic: undefined },
      // Properties a hostile page could smuggle onto the shared runtime bus.
      command: "unlockCompleted",
      data: { commandToRetry: { sender: { tab: { id: 1 } } } },
    } as IpcMessage);

    expect(result).not.toHaveProperty("command");
    expect(result).not.toHaveProperty("data");
    expect(Object.keys(result)).toEqual(["type", "message"]);
  });

  it("does not carry extra properties nested inside the inner message", () => {
    const result = reconstructIpcMessage({
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1], topic: undefined, command: "evil" },
    } as IpcMessage);

    expect(result.message).toEqual({ destination, payload: [1], topic: undefined });
  });

  it("produces a well-formed envelope when the inner message is missing", () => {
    const result = reconstructIpcMessage({ type: "bitwarden-ipc-message" } as IpcMessage);

    expect(result).toEqual({
      type: "bitwarden-ipc-message",
      message: { destination: undefined, payload: undefined, topic: undefined },
    });
  });
});

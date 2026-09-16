import { Message } from "@bitwarden/common/platform/messaging";

import { fromIpcMessaging } from "./from-ipc-messaging";

describe("fromIpcMessaging", () => {
  const originalIpcDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ipc");

  afterEach(() => {
    if (originalIpcDescriptor) {
      Object.defineProperty(globalThis, "ipc", originalIpcDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "ipc");
    }
  });

  it("runs the cleanup returned by addListener when unsubscribed", () => {
    const cleanup = jest.fn();
    const addListener = jest.fn().mockReturnValue(cleanup);
    Object.defineProperty(globalThis, "ipc", {
      configurable: true,
      value: {
        platform: {
          onMessage: {
            addListener,
          },
        },
      },
    });

    const subscription = fromIpcMessaging().subscribe();
    subscription.unsubscribe();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("forwards messages delivered by the registered callback", () => {
    let listener: ((message: Message<Record<string, unknown>>) => void) | undefined;
    Object.defineProperty(globalThis, "ipc", {
      configurable: true,
      value: {
        platform: {
          onMessage: {
            addListener: jest.fn((callback) => {
              listener = callback;
              return jest.fn();
            }),
          },
        },
      },
    });
    const received: Message<Record<string, unknown>>[] = [];
    const subscription = fromIpcMessaging().subscribe((message) => received.push(message));

    listener?.({ command: "sync", value: 1 });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ command: "sync", value: 1 });
    subscription.unsubscribe();
  });
});

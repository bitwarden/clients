import { Utils } from "@bitwarden/common/platform/misc/utils";

import { Message } from "./message";
import { Channel, MessageWithMetadata, Messenger } from "./messenger";

describe("Messenger", () => {
  let messengerA: Messenger;
  let messengerB: Messenger;
  let handlerA: TestMessageHandler;
  let handlerB: TestMessageHandler;

  beforeEach(() => {
    // jest does not support MessageChannel
    window.MessageChannel = MockMessageChannel as any;
    Object.defineProperty(window, "location", {
      value: {
        origin: "https://bitwarden.com",
      },
      writable: true,
    });

    const channelPair = new TestChannelPair();
    messengerA = new Messenger(channelPair.channelA);
    messengerB = new Messenger(channelPair.channelB);

    handlerA = new TestMessageHandler();
    handlerB = new TestMessageHandler();
    messengerA.handler = handlerA.handler;
    messengerB.handler = handlerB.handler;
  });

  it("should deliver message to B when sending request from A", () => {
    const request = createRequest();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    messengerA.request(request);

    const received = handlerB.receive();

    expect(received.length).toBe(1);
    expect(received[0].message).toMatchObject(request);
  });

  it("should return response from B when sending request from A", async () => {
    const request = createRequest();
    const response = createResponse();
    const requestPromise = messengerA.request(request);
    const received = handlerB.receive();
    received[0].respond(response);

    const returned = await requestPromise;

    expect(returned).toMatchObject(response);
  });

  it("should throw error from B when sending request from A that fails", async () => {
    const request = createRequest();
    const error = new Error("Test error");
    const requestPromise = messengerA.request(request);
    const received = handlerB.receive();

    received[0].reject(error);

    await expect(requestPromise).rejects.toThrow();
  });

  it("should deliver abort signal to B when requesting abort", () => {
    const abortController = new AbortController();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    messengerA.request(createRequest(), abortController.signal);
    abortController.abort();

    const received = handlerB.receive();

    expect(received[0].abortController.signal.aborted).toBe(true);
  });

  describe("destroy", () => {
    beforeEach(() => {
      /**
       * In Jest's jsdom environment, there is an issue where event listeners are not
       * triggered upon dispatching an event. This is a workaround to mock the EventTarget
       */
      window.EventTarget = MockEventTarget as any;
    });

    it("should remove the message event listener", async () => {
      const channelPair = new TestChannelPair();
      const addEventListenerSpy = jest.spyOn(channelPair.channelA, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(channelPair.channelA, "removeEventListener");
      messengerA = new Messenger(channelPair.channelA);
      jest
        .spyOn(messengerA as any, "sendDisconnectCommand")
        .mockImplementation(() => Promise.resolve());

      expect(addEventListenerSpy).toHaveBeenCalled();

      await messengerA.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it("should dispatch the destroy event on messenger destruction", async () => {
      const request = createRequest();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      messengerA.request(request);

      const dispatchEventSpy = jest.spyOn((messengerA as any).onDestroy, "dispatchEvent");
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      messengerA.destroy();

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
    });

    it("should trigger onDestroyListener when the destroy event is dispatched", async () => {
      const request = createRequest();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      messengerA.request(request);

      const onDestroyListener = jest.fn();
      (messengerA as any).onDestroy.addEventListener("destroy", onDestroyListener);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      messengerA.destroy();

      expect(onDestroyListener).toHaveBeenCalled();
      const eventArg = onDestroyListener.mock.calls[0][0];
      expect(eventArg).toBeInstanceOf(Event);
      expect(eventArg.type).toBe("destroy");
    });
  });
});

type TestMessage = MessageWithMetadata & { testId: string };

function createRequest(): TestMessage {
  return { testId: Utils.newGuid(), type: "TestRequest" } as any;
}

function createResponse(): TestMessage {
  return { testId: Utils.newGuid(), type: "TestResponse" } as any;
}

class TestChannelPair {
  readonly channelA: Channel;
  readonly channelB: Channel;

  constructor() {
    const broadcastChannel = new MockMessageChannel<MessageWithMetadata>();

    this.channelA = {
      addEventListener: (listener) => (broadcastChannel.port1.onmessage = listener),
      removeEventListener: () => (broadcastChannel.port1.onmessage = null),
      postMessage: (message, port) => broadcastChannel.port1.postMessage(message, port),
    };

    this.channelB = {
      addEventListener: (listener) => (broadcastChannel.port2.onmessage = listener),
      removeEventListener: () => (broadcastChannel.port1.onmessage = null),
      postMessage: (message, port) => broadcastChannel.port2.postMessage(message, port),
    };
  }
}

class TestMessageHandler {
  readonly handler: (
    message: TestMessage,
    abortController?: AbortController,
  ) => Promise<Message | undefined>;

  private receivedMessages: {
    message: TestMessage;
    respond: (response: TestMessage) => void;
    reject: (error: Error) => void;
    abortController?: AbortController;
  }[] = [];

  constructor() {
    this.handler = (message, abortController) =>
      new Promise((resolve, reject) => {
        this.receivedMessages.push({
          message,
          abortController,
          respond: (response) => resolve(response),
          reject: (error) => reject(error),
        });
      });
  }

  receive() {
    const received = this.receivedMessages;
    this.receivedMessages = [];
    return received;
  }
}

class MockMessageChannel<T> {
  port1 = new MockMessagePort<T>();
  port2 = new MockMessagePort<T>();

  constructor() {
    this.port1.remotePort = this.port2;
    this.port2.remotePort = this.port1;
  }
}

class MockMessagePort<T> {
  onmessage: ((ev: MessageEvent<T>) => any) | null;
  remotePort: MockMessagePort<T>;

  postMessage(message: T, port?: MessagePort) {
    this.remotePort.onmessage(
      new MessageEvent("message", {
        data: message,
        ports: port ? [port] : [],
        origin: "https://bitwarden.com",
      }),
    );
  }

  close() {
    // Do nothing
  }
}

class MockEventTarget {
  listeners: Record<string, EventListener[]> = {};

  addEventListener(type: string, callback: EventListener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(callback);
  }

  dispatchEvent(event: Event) {
    (this.listeners[event.type] || []).forEach((callback) => callback(event));
  }

  removeEventListener(type: string, callback: EventListener) {
    this.listeners[type] = (this.listeners[type] || []).filter((listener) => listener !== callback);
  }
}

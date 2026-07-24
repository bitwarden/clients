/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { RendererUiRequestService } from "./renderer-ui-request.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

const REQUEST_COMMAND = "test.request";
const RESPONSE_CHANNEL = "test.response";

describe("RendererUiRequestService", () => {
  let messagingService: jest.Mocked<MessagingService>;
  let service: RendererUiRequestService;
  let responseHandlers: Map<string, Function>;

  const reply = (requestId: number, response: unknown) =>
    responseHandlers.get(RESPONSE_CHANNEL)!({}, { requestId, response });

  const lastRequestId = () =>
    (messagingService.send.mock.calls.at(-1)![1] as { requestId: number }).requestId;

  beforeEach(() => {
    responseHandlers = new Map();
    (ipcMain.handle as jest.Mock).mockReset();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      responseHandlers.set(channel, handler);
    });
    messagingService = { send: jest.fn() } as any;
    service = new RendererUiRequestService(messagingService);
  });

  it("sends the request command with a requestId and payload", () => {
    void service.request(REQUEST_COMMAND, RESPONSE_CHANNEL, { cipherId: "abc" });

    expect(messagingService.send).toHaveBeenCalledWith(REQUEST_COMMAND, {
      requestId: expect.any(Number),
      cipherId: "abc",
    });
  });

  it("registers the response channel handler only once across requests", () => {
    void service.request(REQUEST_COMMAND, RESPONSE_CHANNEL);
    void service.request(REQUEST_COMMAND, RESPONSE_CHANNEL);

    expect(
      (ipcMain.handle as jest.Mock).mock.calls.filter((c) => c[0] === RESPONSE_CHANNEL),
    ).toHaveLength(1);
  });

  it("resolves with the renderer's response for the matching requestId", async () => {
    const promise = service.request<boolean>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    reply(lastRequestId(), true);

    await expect(promise).resolves.toBe(true);
  });

  it("correlates concurrent requests independently", async () => {
    const first = service.request<string>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    const firstId = lastRequestId();
    const second = service.request<string>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    const secondId = lastRequestId();

    expect(firstId).not.toBe(secondId);

    reply(secondId, "second");
    reply(firstId, "first");

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("ignores replies for unknown request ids", async () => {
    const promise = service.request<boolean>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    const id = lastRequestId();

    expect(() => reply(9999, true)).not.toThrow();

    reply(id, false);
    await expect(promise).resolves.toBe(false);
  });

  it("ignores a duplicate reply for an already-settled request", async () => {
    const promise = service.request<number>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    const id = lastRequestId();

    reply(id, 1);
    expect(() => reply(id, 2)).not.toThrow();

    await expect(promise).resolves.toBe(1);
  });

  describe("timeout", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("resolves with the default response after the timeout", async () => {
      const promise = service.request<boolean>(
        REQUEST_COMMAND,
        RESPONSE_CHANNEL,
        {},
        {
          timeoutMs: 1000,
          defaultResponse: false,
        },
      );

      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBe(false);
    });

    it("does not time out once the renderer has replied", async () => {
      const promise = service.request<boolean>(
        REQUEST_COMMAND,
        RESPONSE_CHANNEL,
        {},
        {
          timeoutMs: 1000,
          defaultResponse: false,
        },
      );

      reply(lastRequestId(), true);
      jest.advanceTimersByTime(5000);

      await expect(promise).resolves.toBe(true);
    });
  });

  it("cancelAll resolves in-flight requests with the default response", async () => {
    const first = service.request<string>(REQUEST_COMMAND, RESPONSE_CHANNEL);
    const second = service.request<string>(REQUEST_COMMAND, RESPONSE_CHANNEL);

    service.cancelAll("cancelled");

    await expect(first).resolves.toBe("cancelled");
    await expect(second).resolves.toBe("cancelled");
  });
});

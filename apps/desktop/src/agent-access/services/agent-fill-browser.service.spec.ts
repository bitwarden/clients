import { TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";

import {
  AGENT_FILL_IPC_TOPIC,
  AgentFillIpcMessage,
  AgentFillResult,
  AgentFillTargetDescription,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-messages";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IncomingMessage } from "@bitwarden/sdk-internal";

import {
  AgentFillBrowserService,
  AgentFillTimeoutError,
  AGENT_FILL_RESPONSE_TIMEOUT_MS,
  ExtensionUnavailableError,
  MultipleBrowsersError,
  NoDescribableTargetError,
} from "./agent-fill-browser.service";

// The SDK is a wasm module that can't be loaded in jest; `OutgoingMessage.new_json_payload` is
// the only runtime symbol this service touches, so mirror just enough of it to capture what
// would have been sent. `LogLevel` rides along because `@bitwarden/common/platform/ipc`'s
// barrel transitively evaluates `SdkLoadService`, which reads `LogLevel.Info` at module scope.
jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: {
    new_json_payload: jest.fn((payload: unknown, destination: unknown, topic: unknown) => ({
      payload,
      destination,
      topic,
    })),
  },
  LogLevel: { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 },
}));

/** Builds a fake IncomingMessage the way the service consumes it (topic + source +
 *  parse_payload_as_json), without touching the real wasm class. */
function incoming(
  payload: AgentFillIpcMessage | Record<string, unknown>,
  sourceId: number | "Own" = 1,
  topic: string = AGENT_FILL_IPC_TOPIC,
): IncomingMessage {
  return {
    topic,
    source: { BrowserBackground: { id: sourceId === "Own" ? "Own" : { Id: sourceId } } },
    parse_payload_as_json: () => payload,
  } as unknown as IncomingMessage;
}

function makeDescription(
  overrides: Partial<AgentFillTargetDescription> = {},
): AgentFillTargetDescription {
  return {
    origin: "https://example.com",
    formClass: "login",
    candidates: [
      { role: "username", target: "input#email (login form)", visible: true, frame: "top" },
      { role: "password", target: "input[type=password]#pw", visible: true, frame: "top" },
    ],
    refusals: [],
    targetToken: "ft_1",
    expiresInMs: 30_000,
    ...overrides,
  };
}

describe("AgentFillBrowserService", () => {
  // jsdom's `crypto` lacks `randomUUID`, which the service uses for requestId generation.
  beforeAll(() => {
    const globalCrypto = ((globalThis as { crypto?: Crypto }).crypto ??= {} as Crypto);
    if (typeof globalCrypto.randomUUID !== "function") {
      Object.defineProperty(globalCrypto, "randomUUID", {
        configurable: true,
        value: () => `uuid-${Math.random().toString(36).slice(2)}`,
      });
    }
  });

  let service: AgentFillBrowserService;
  let messagesSubject: Subject<IncomingMessage>;
  let mockSend: jest.Mock;
  let mockLogService: { info: jest.Mock; error: jest.Mock; warning: jest.Mock; debug: jest.Mock };

  /** The last message handed to ipcService.send (shape produced by the mocked
   *  `new_json_payload` above). */
  const lastSent = () => mockSend.mock.calls.at(-1)?.[0];

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

  beforeEach(() => {
    messagesSubject = new Subject<IncomingMessage>();
    mockSend = jest.fn().mockResolvedValue(undefined);
    mockLogService = { info: jest.fn(), error: jest.fn(), warning: jest.fn(), debug: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        AgentFillBrowserService,
        { provide: LogService, useValue: mockLogService },
        {
          provide: IpcService,
          useValue: { messages$: messagesSubject.asObservable(), send: mockSend },
        },
      ],
    });

    service = TestBed.inject(AgentFillBrowserService);
    service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  describe("endpoint registry", () => {
    it("registers an endpoint from an agentFillHello and addresses requests to it", async () => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 7));

      const describePromise = service.describeTarget();
      await flush();

      expect(lastSent()).toMatchObject({
        destination: { BrowserBackground: { id: { Id: 7 } } },
        topic: AGENT_FILL_IPC_TOPIC,
        payload: { type: "agentFillDescribeRequest", requestId: expect.any(String) },
      });

      const { requestId } = lastSent().payload;
      messagesSubject.next(
        incoming({ type: "agentFillDescribeResponse", requestId, target: makeDescription() }, 7),
      );
      await expect(describePromise).resolves.toMatchObject({ origin: "https://example.com" });
    });

    it("rejects with ExtensionUnavailableError, without sending, when no endpoint is known", async () => {
      await expect(service.describeTarget()).rejects.toBeInstanceOf(ExtensionUnavailableError);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("rejects with MultipleBrowsersError, without sending, when two distinct endpoints are known", async () => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));
      messagesSubject.next(incoming({ type: "agentFillHello" }, 2));

      await expect(service.describeTarget()).rejects.toBeInstanceOf(MultipleBrowsersError);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("counts a repeated hello from the same endpoint as one endpoint", async () => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));

      const describePromise = service.describeTarget();
      await flush();
      const { requestId } = lastSent().payload;
      messagesSubject.next(
        incoming({ type: "agentFillDescribeResponse", requestId, target: makeDescription() }),
      );

      await expect(describePromise).resolves.toBeDefined();
    });

    it("ignores agent-fill messages from a non-BrowserBackground source", async () => {
      messagesSubject.next({
        topic: AGENT_FILL_IPC_TOPIC,
        source: "DesktopMain",
        parse_payload_as_json: () => ({ type: "agentFillHello" }),
      } as unknown as IncomingMessage);

      await expect(service.describeTarget()).rejects.toBeInstanceOf(ExtensionUnavailableError);
    });
  });

  describe("correlation", () => {
    beforeEach(() => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));
    });

    it("resolves only the exchange whose requestId matches, ignoring a mismatched response", async () => {
      const describePromise = service.describeTarget();
      await flush();
      const { requestId } = lastSent().payload;

      // A response for some other requestId must not settle this exchange.
      messagesSubject.next(
        incoming({
          type: "agentFillDescribeResponse",
          requestId: "not-this-one",
          target: makeDescription({ origin: "https://wrong.example" }),
        }),
      );
      const settled = jest.fn();
      void describePromise.then(settled, settled);
      await flush();
      expect(settled).not.toHaveBeenCalled();

      messagesSubject.next(
        incoming({ type: "agentFillDescribeResponse", requestId, target: makeDescription() }),
      );
      await expect(describePromise).resolves.toMatchObject({ origin: "https://example.com" });
    });

    it("throws NoDescribableTargetError carrying the refusal when the describe response has no target", async () => {
      const describePromise = service.describeTarget();
      await flush();
      const { requestId } = lastSent().payload;

      messagesSubject.next(
        incoming({
          type: "agentFillDescribeResponse",
          requestId,
          refusal: "looks-like-registration",
        }),
      );

      await expect(describePromise).rejects.toMatchObject({
        name: "NoDescribableTargetError",
        refusal: "looks-like-registration",
      });
      await expect(describePromise).rejects.toBeInstanceOf(NoDescribableTargetError);
    });

    it("returns the per-field fill result for a fill exchange", async () => {
      const result: AgentFillResult = {
        status: "filled",
        origin: "https://example.com",
        fields: [
          { role: "username", status: "filled", target: "input#email (login form)" },
          { role: "password", status: "filled", target: "input[type=password]#pw" },
        ],
      };

      const fillPromise = service.fill({
        origin: "https://example.com",
        targetToken: "ft_1",
        fields: ["username", "password"],
        credential: { username: "user@example.com", password: "hunter2" },
      });
      await flush();
      const { requestId } = lastSent().payload;
      messagesSubject.next(incoming({ type: "agentFillResponse", requestId, result }));

      await expect(fillPromise).resolves.toEqual(result);
      // The value rides the IPC payload — that is the one sanctioned place it transits.
      expect(lastSent().payload.credential).toEqual({
        username: "user@example.com",
        password: "hunter2",
      });
    });
  });

  describe("timeout", () => {
    beforeEach(() => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("rejects with AgentFillTimeoutError when no response arrives within the window", async () => {
      jest.useFakeTimers();

      const describePromise = service.describeTarget();
      // Let the async send settle before advancing the clock.
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      jest.advanceTimersByTime(AGENT_FILL_RESPONSE_TIMEOUT_MS + 1);

      await expect(describePromise).rejects.toBeInstanceOf(AgentFillTimeoutError);
    });

    it("ignores a response that arrives after the timeout already rejected the exchange", async () => {
      jest.useFakeTimers();

      const describePromise = service.describeTarget();
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      const { requestId } = lastSent().payload;
      jest.advanceTimersByTime(AGENT_FILL_RESPONSE_TIMEOUT_MS + 1);
      await expect(describePromise).rejects.toBeInstanceOf(AgentFillTimeoutError);

      // The late response must not throw or resurrect anything.
      messagesSubject.next(
        incoming({ type: "agentFillDescribeResponse", requestId, target: makeDescription() }),
      );
    });
  });

  describe("no credential value ever reaches a log", () => {
    it("never logs at all during a fill exchange, success or send failure", async () => {
      messagesSubject.next(incoming({ type: "agentFillHello" }, 1));

      const fillPromise = service.fill({
        origin: "https://example.com",
        fields: ["password"],
        credential: { password: "hunter2-super-secret" },
      });
      await flush();
      const { requestId } = lastSent().payload;
      messagesSubject.next(
        incoming({
          type: "agentFillResponse",
          requestId,
          result: { status: "filled", origin: "https://example.com", fields: [] },
        }),
      );
      await fillPromise;

      // Now a send failure on a second fill — still nothing logged.
      mockSend.mockRejectedValue(new Error("transport gone: hunter2-super-secret must not leak"));
      await expect(
        service.fill({
          origin: "https://example.com",
          fields: ["password"],
          credential: { password: "hunter2-super-secret" },
        }),
      ).rejects.toBeInstanceOf(ExtensionUnavailableError);

      for (const logFn of [
        mockLogService.info,
        mockLogService.error,
        mockLogService.warning,
        mockLogService.debug,
      ]) {
        expect(logFn).not.toHaveBeenCalled();
      }
    });
  });
});

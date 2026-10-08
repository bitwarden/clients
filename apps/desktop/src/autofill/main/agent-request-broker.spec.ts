import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { AgentRequestBroker } from "./agent-request-broker";

describe("AgentRequestBroker", () => {
  let messaging: ReturnType<typeof mock<MessagingService>>;
  let window: boolean;
  let showWindow: jest.Mock;
  let broker: AgentRequestBroker<{ q: string }, string>;

  const sent = () => messaging.send.mock.calls.map(([, payload]) => payload);
  const inAMinute = () => Date.now() + 60_000;

  beforeEach(() => {
    jest.useFakeTimers();
    messaging = mock<MessagingService>();
    window = true;
    showWindow = jest.fn().mockResolvedValue(undefined);
    broker = new AgentRequestBroker(
      "agent.request",
      messaging,
      mock<LogService>(),
      () => window,
      showWindow,
      "timeout",
    );
  });

  afterEach(() => jest.useRealTimers());

  it("holds requests until a renderer starts, then delivers them with an id", () => {
    void broker.request({ q: "a" }, inAMinute());
    expect(messaging.send).not.toHaveBeenCalled();

    broker.rendererStarted();

    expect(messaging.send).toHaveBeenCalledWith("agent.request", { q: "a", requestId: 1 });
  });

  it("resolves with the renderer's answer exactly once", async () => {
    broker.rendererStarted();
    const answer = broker.request({ q: "a" }, inAMinute());

    broker.answer(1, "approved");
    broker.answer(1, "denied");

    await expect(answer).resolves.toBe("approved");
  });

  it("resolves at the deadline and ignores a late answer", async () => {
    broker.rendererStarted();
    const answer = broker.request({ q: "a" }, Date.now() + 1_000);

    jest.advanceTimersByTime(1_000);
    broker.answer(1, "approved");

    await expect(answer).resolves.toBe("timeout");
  });

  it("re-sends pending requests when a new renderer starts", () => {
    broker.rendererStarted();
    void broker.request({ q: "a" }, inAMinute());
    void broker.request({ q: "b" }, inAMinute());
    broker.answer(1, "approved");

    broker.rendererStarted();

    expect(sent()).toEqual([
      { q: "a", requestId: 1 },
      { q: "b", requestId: 2 },
      { q: "b", requestId: 2 },
    ]);
  });

  it("opens one window for requests that arrive while none exists", async () => {
    broker.rendererStarted();
    window = false;

    void broker.request({ q: "a" }, inAMinute());
    void broker.request({ q: "b" }, inAMinute());
    await Promise.resolve();

    expect(showWindow).toHaveBeenCalledTimes(1);
    expect(messaging.send).not.toHaveBeenCalled();

    window = true;
    broker.rendererStarted();
    expect(sent()).toHaveLength(2);
  });

  it("settles everything pending with the given answer", async () => {
    const a = broker.request({ q: "a" }, inAMinute());
    const b = broker.request({ q: "b" }, inAMinute());

    broker.settleAll("denied");

    await expect(Promise.all([a, b])).resolves.toEqual(["denied", "denied"]);
  });

  it("settles only the pending requests the filter picks", async () => {
    const a = broker.request({ q: "a" }, inAMinute());
    const b = broker.request({ q: "b" }, inAMinute());

    broker.settleAll("denied", (request) => request.q === "a");
    broker.answer(2, "approved");

    await expect(Promise.all([a, b])).resolves.toEqual(["denied", "approved"]);
  });
});

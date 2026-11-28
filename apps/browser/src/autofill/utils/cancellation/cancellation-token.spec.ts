import { CancellationToken } from "./abstractions";
import { anyCancellation, cancellationToken, NEVER_CANCEL } from "./cancellation-token";

/** What a subscriber of a token's stream hears. */
const listen = (token: CancellationToken) => {
  const heard: string[] = [];
  const subscription = token.cancelled$.subscribe({
    next: () => heard.push("cancelled"),
    complete: () => heard.push("complete"),
  });
  return { heard, subscription };
};

describe("cancellationToken", () => {
  it("makes a token that is not cancelled", () => {
    const { token } = cancellationToken();

    expect(token.cancelled).toBe(false);
  });

  it("makes a token that its source cancels, and that stays cancelled", () => {
    const { cancel, token } = cancellationToken();

    cancel();

    expect(token.cancelled).toBe(true);
  });

  it("does not emit, and does not end, until it is cancelled", () => {
    const { token } = cancellationToken();

    const { heard, subscription } = listen(token);

    expect(heard).toEqual([]);
    subscription.unsubscribe();
  });

  it("emits to a subscriber present at the cancellation, and ends", () => {
    const { cancel, token } = cancellationToken();
    const { heard } = listen(token);

    cancel();

    expect(heard).toEqual(["cancelled", "complete"]);
  });

  it("emits to a subscriber that arrives after the cancellation", () => {
    const { cancel, token } = cancellationToken();
    cancel();

    const { heard } = listen(token);

    expect(heard).toEqual(["cancelled", "complete"]);
  });

  it("emits once, however often its source cancels", () => {
    const { cancel, token } = cancellationToken();
    const { heard } = listen(token);

    cancel();
    cancel();

    expect(heard).toEqual(["cancelled", "complete"]);
  });

  it("is cancelled by `cancel` handed to a subscriber, with whatever value it is given", () => {
    const { cancel, token } = cancellationToken();
    const forwarded: (value: string) => void = cancel;

    forwarded("anything");

    expect(token.cancelled).toBe(true);
  });

  it("makes tokens that are cancelled apart", () => {
    const first = cancellationToken();
    const second = cancellationToken();

    first.cancel();

    expect(first.token.cancelled).toBe(true);
    expect(second.token.cancelled).toBe(false);
  });

  it("makes a token that holds nothing to dispose, as the abstraction says", () => {
    const { token } = cancellationToken();

    expect(Symbol.dispose in token).toBe(false);
  });
});

describe("NEVER_CANCEL", () => {
  it("is never cancelled", () => {
    expect(NEVER_CANCEL.cancelled).toBe(false);
  });

  it("never emits, and never ends, for a subscriber of its stream", () => {
    const { heard, subscription } = listen(NEVER_CANCEL);

    expect(heard).toEqual([]);
    subscription.unsubscribe();
  });

  it("is frozen, so no fill can replace what it answers", () => {
    expect(Object.isFrozen(NEVER_CANCEL)).toBe(true);
    expect(() => {
      (NEVER_CANCEL as unknown as { cancelled$: unknown }).cancelled$ = undefined;
    }).toThrow(TypeError);
  });

  it("is not the token that a source makes, so no source can cancel it", () => {
    const { cancel, token } = cancellationToken();

    cancel();

    expect(token.cancelled).toBe(true);
    expect(NEVER_CANCEL.cancelled).toBe(false);
  });
});

describe("anyCancellation", () => {
  it("is not cancelled while none of its tokens is", () => {
    const first = cancellationToken();
    const second = cancellationToken();

    const token = anyCancellation(first.token, second.token);

    expect(token.cancelled).toBe(false);
  });

  it.each([
    ["first", 0],
    ["second", 1],
  ])("is cancelled when the %s of its tokens is cancelled", (_, index) => {
    const sources = [cancellationToken(), cancellationToken()];
    const token = anyCancellation(sources[0].token, sources[1].token);

    sources[index].cancel();

    expect(token.cancelled).toBe(true);
  });

  it("emits once, and ends, when its tokens are cancelled in turn", () => {
    const first = cancellationToken();
    const second = cancellationToken();
    const { heard } = listen(anyCancellation(first.token, second.token));

    second.cancel();
    first.cancel();

    expect(heard).toEqual(["cancelled", "complete"]);
  });

  it("emits to a subscriber that arrives after a token was cancelled", () => {
    const first = cancellationToken();
    const second = cancellationToken();
    const token = anyCancellation(first.token, second.token);
    first.cancel();

    const { heard } = listen(token);

    expect(heard).toEqual(["cancelled", "complete"]);
  });

  it("never emits, and never ends, when none of its tokens can be cancelled", () => {
    const { heard, subscription } = listen(anyCancellation(NEVER_CANCEL, NEVER_CANCEL));

    expect(heard).toEqual([]);
    subscription.unsubscribe();
  });

  it("composes with a token that can never be cancelled, and the other still cancels it", () => {
    const { cancel, token } = cancellationToken();
    const composed = anyCancellation(NEVER_CANCEL, token);

    cancel();

    expect(composed.cancelled).toBe(true);
  });

  it("composes composed tokens", () => {
    const first = cancellationToken();
    const second = cancellationToken();
    const third = cancellationToken();
    const composed = anyCancellation(anyCancellation(first.token, second.token), third.token);

    second.cancel();

    expect(composed.cancelled).toBe(true);
  });

  it("is a token that never cancels when it composes none", () => {
    expect(anyCancellation().cancelled).toBe(false);
    expect(anyCancellation()).toBe(NEVER_CANCEL);
  });

  it("holds no resources, so it has nothing to dispose", () => {
    const { token } = cancellationToken();

    expect(Symbol.dispose in anyCancellation(token)).toBe(false);
  });
});

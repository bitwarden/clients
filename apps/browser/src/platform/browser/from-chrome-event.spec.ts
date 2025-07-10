import { fromChromeEvent } from "./from-chrome-event";

describe("fromChromeEvent", () => {
  class FakeEvent implements chrome.events.Event<(arg1: string, arg2: number) => void> {
    listenerWasAdded: boolean;
    listenerWasRemoved: boolean;
    activeListeners: ((arg1: string, arg2: number) => void)[] = [];

    addListener(callback: (arg1: string, arg2: number) => void): void {
      this.listenerWasAdded = true;
      this.activeListeners.push(callback);
    }
    getRules(callback: (rules: chrome.events.Rule[]) => void): void;
    getRules(ruleIdentifiers: string[], callback: (rules: chrome.events.Rule[]) => void): void;
    getRules(ruleIdentifiers: unknown, callback?: unknown): void {
      throw new Error("Method not implemented.");
    }
    hasListener(callback: (arg1: string, arg2: number) => void): boolean {
      throw new Error("Method not implemented.");
    }
    removeRules(ruleIdentifiers?: string[], callback?: () => void): void;
    removeRules(callback?: () => void): void;
    removeRules(ruleIdentifiers?: unknown, callback?: unknown): void {
      throw new Error("Method not implemented.");
    }
    addRules(rules: chrome.events.Rule[], callback?: (rules: chrome.events.Rule[]) => void): void {
      throw new Error("Method not implemented.");
    }
    removeListener(callback: (arg1: string, arg2: number) => void): void {
      const index = this.activeListeners.findIndex((c) => c == callback);
      if (index === -1) {
        throw new Error("No registered callback.");
      }

      this.listenerWasRemoved = true;
      this.activeListeners.splice(index, 1);
    }
    hasListeners(): boolean {
      throw new Error("Method not implemented.");
    }

    fireEvent(arg1: string, arg2: number) {
      this.activeListeners.forEach((listener) => {
        listener(arg1, arg2);
      });
    }
  }

  let event: FakeEvent;

  beforeEach(() => {
    event = new FakeEvent();
  });

  it("should never call addListener when never subscribed to", () => {
    fromChromeEvent(event);
    expect(event.listenerWasAdded).toBeFalsy();
  });

  it("should add a listener when subscribed to.", () => {
    const eventObservable = fromChromeEvent(event);
    eventObservable.subscribe();
    expect(event.listenerWasAdded).toBeTruthy();
    expect(event.activeListeners).toHaveLength(1);
  });

  it("should call remove listener when the created subscription is unsubscribed", () => {
    const eventObservable = fromChromeEvent(event);
    const subscription = eventObservable.subscribe();
    subscription.unsubscribe();
    expect(event.listenerWasAdded).toBeTruthy();
    expect(event.listenerWasRemoved).toBeTruthy();
    expect(event.activeListeners).toHaveLength(0);
  });

  it("should fire each callback given to subscribe", () => {
    const eventObservable = fromChromeEvent(event);

    let subscription1Called = false;
    let subscription2Called = false;

    const subscription1 = eventObservable.subscribe(([arg1, arg2]) => {
      expect(arg1).toBe("Hi!");
      expect(arg2).toBe(2);
      subscription1Called = true;
    });

    const subscription2 = eventObservable.subscribe(([arg1, arg2]) => {
      expect(arg1).toBe("Hi!");
      expect(arg2).toBe(2);
      subscription2Called = true;
    });

    event.fireEvent("Hi!", 2);

    subscription1.unsubscribe();
    subscription2.unsubscribe();

    expect(event.activeListeners).toHaveLength(0);
    expect(subscription1Called).toBeTruthy();
    expect(subscription2Called).toBeTruthy();
  });
});

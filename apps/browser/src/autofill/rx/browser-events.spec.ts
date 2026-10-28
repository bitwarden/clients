import { Observable } from "rxjs";

import {
  tabActivated$,
  tabCreated$,
  tabRemoved$,
  tabAttached$,
  tabDetached$,
  windowFocusChanged$,
  windowRemoved$,
} from "./browser-events";

describe("browser-events", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Every wrapper shares one cold-observable contract: no listener is registered until subscribe,
  // one value is emitted per raw event (with the wrapper's payload projection), and the listener is
  // removed / the stream falls silent on unsubscribe. A single table exercises that contract so each
  // wrapper's only distinguishing detail — its event and payload shape — stays visible in one place.
  // Subscribing drives the real `BrowserApi.addListener`, so these also cover that integration; the
  // underlying chrome events are the jest.fn mocks from `test.setup.ts`.
  type EventMock = { addListener: jest.Mock; removeListener: jest.Mock };

  const cases: Array<{
    name: string;
    event: () => EventMock;
    observable: () => Observable<unknown>;
    invocations: Array<{ args: unknown[]; expected: unknown }>;
  }> = [
    {
      name: "tabActivated$",
      event: () => chrome.tabs.onActivated as unknown as EventMock,
      observable: () => tabActivated$(),
      invocations: [
        { args: [{ tabId: 5, windowId: 2 }], expected: { tabId: 5, windowId: 2 } },
        { args: [{ tabId: 6, windowId: 2 }], expected: { tabId: 6, windowId: 2 } },
      ],
    },
    {
      name: "tabCreated$",
      event: () => chrome.tabs.onCreated as unknown as EventMock,
      observable: () => tabCreated$(),
      invocations: [
        { args: [{ id: 5, windowId: 2 }], expected: { id: 5, windowId: 2 } },
        { args: [{ id: 6, windowId: 2 }], expected: { id: 6, windowId: 2 } },
      ],
    },
    {
      name: "tabRemoved$",
      event: () => chrome.tabs.onRemoved as unknown as EventMock,
      observable: () => tabRemoved$(),
      invocations: [
        {
          args: [5, { isWindowClosing: false, windowId: 2 }],
          expected: { tabId: 5, isWindowClosing: false, windowId: 2 },
        },
        {
          args: [6, { isWindowClosing: true, windowId: 2 }],
          expected: { tabId: 6, isWindowClosing: true, windowId: 2 },
        },
      ],
    },
    {
      name: "tabAttached$",
      event: () => chrome.tabs.onAttached as unknown as EventMock,
      observable: () => tabAttached$(),
      invocations: [
        {
          args: [7, { newWindowId: 3, newPosition: 1 }],
          expected: { tabId: 7, newWindowId: 3, newPosition: 1 },
        },
        {
          args: [8, { newWindowId: 3, newPosition: 2 }],
          expected: { tabId: 8, newWindowId: 3, newPosition: 2 },
        },
      ],
    },
    {
      name: "tabDetached$",
      event: () => chrome.tabs.onDetached as unknown as EventMock,
      observable: () => tabDetached$(),
      invocations: [
        {
          args: [7, { oldWindowId: 3, oldPosition: 1 }],
          expected: { tabId: 7, oldWindowId: 3, oldPosition: 1 },
        },
        {
          args: [9, { oldWindowId: 4, oldPosition: 0 }],
          expected: { tabId: 9, oldWindowId: 4, oldPosition: 0 },
        },
      ],
    },
    {
      name: "windowFocusChanged$",
      event: () => chrome.windows.onFocusChanged as unknown as EventMock,
      observable: () => windowFocusChanged$(),
      invocations: [
        { args: [4], expected: 4 },
        { args: [5], expected: 5 },
      ],
    },
    {
      name: "windowRemoved$",
      event: () => chrome.windows.onRemoved as unknown as EventMock,
      observable: () => windowRemoved$(),
      invocations: [
        { args: [9], expected: 9 },
        { args: [10], expected: 10 },
      ],
    },
  ];

  describe.each(cases)("$name", ({ event, observable, invocations }) => {
    it("does not register a listener until subscribed", () => {
      const stream = observable();
      expect(event().addListener).not.toHaveBeenCalled();

      stream.subscribe().unsubscribe();
      expect(event().addListener).toHaveBeenCalledTimes(1);
    });

    it("emits a payload for each event received", () => {
      const emitted: unknown[] = [];
      const subscription = observable().subscribe((v) => emitted.push(v));
      const handler = event().addListener.mock.calls[0][0];

      for (const { args } of invocations) {
        handler(...args);
      }

      expect(emitted).toEqual(invocations.map((i) => i.expected));
      subscription.unsubscribe();
    });

    it("removes the listener and stops emitting on unsubscribe", () => {
      const emitted: unknown[] = [];
      const subscription = observable().subscribe((v) => emitted.push(v));
      const handler = event().addListener.mock.calls[0][0];

      subscription.unsubscribe();
      expect(event().removeListener).toHaveBeenCalledWith(handler);

      handler(...invocations[0].args);
      expect(emitted).toEqual([]);
    });

    it("registers an independent listener per subscription", () => {
      // Cold and unicast: two subscriptions add two *distinct* handlers, each torn down on its own
      // unsubscribe.
      const first = observable().subscribe();
      const second = observable().subscribe();
      const [[firstHandler], [secondHandler]] = event().addListener.mock.calls;
      expect(firstHandler).not.toBe(secondHandler);

      first.unsubscribe();
      expect(event().removeListener).toHaveBeenCalledWith(firstHandler);

      second.unsubscribe();
      expect(event().removeListener).toHaveBeenCalledWith(secondHandler);
    });
  });

  describe("windowFocusChanged$", () => {
    // Beyond the table's generic emit-each coverage, this guards the specific decision that the
    // WINDOW_ID_NONE (-1) sentinel is forwarded rather than dropped — so no one adds a filter later.
    it("passes WINDOW_ID_NONE through unfiltered", () => {
      const emitted: number[] = [];
      const subscription = windowFocusChanged$().subscribe((v) => emitted.push(v));

      const handler = (chrome.windows.onFocusChanged.addListener as jest.Mock).mock.calls[0][0];
      handler(chrome.windows.WINDOW_ID_NONE);

      expect(emitted).toEqual([chrome.windows.WINDOW_ID_NONE]);

      subscription.unsubscribe();
    });
  });
});

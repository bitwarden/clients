import { mockQuerySelectorAllDefinedCall } from "../spec/testing-utils";

import { DomQueryService } from "./dom-query.service";
import { ShadowHostHydrationTracker } from "./shadow-host-hydration-tracker";

describe("ShadowHostHydrationTracker", () => {
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();
  let domQueryService: DomQueryService;
  let mutationObserver: MutationObserver;
  let requestPageDetailsUpdate: jest.Mock;
  let tracker: ShadowHostHydrationTracker;

  const buildMutation = (added: Node[]): MutationRecord =>
    ({
      type: "childList",
      addedNodes: added as unknown as NodeList,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null,
      removedNodes: document.querySelectorAll("nonexistent"),
      target: document.body,
    }) as MutationRecord;

  beforeEach(() => {
    jest.useFakeTimers();
    mutationObserver = new MutationObserver(() => {});
    domQueryService = new DomQueryService();
    domQueryService["knownShadowRoots"].clear();
    domQueryService["pageContainsShadowDom"] = false;
    requestPageDetailsUpdate = jest.fn();
    tracker = new ShadowHostHydrationTracker(
      domQueryService,
      mutationObserver,
      requestPageDetailsUpdate,
    );
  });

  afterEach(() => {
    tracker.reset();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  describe("noteAddedNodes (candidate filtering at observation)", () => {
    it("retains elements that already have a shadowRoot", () => {
      const host = document.createElement("div");
      host.attachShadow({ mode: "open" });

      tracker.noteAddedNodes([buildMutation([host])]);

      expect(tracker["pendingMutationAddedElements"].has(host)).toBe(true);
    });

    it("retains custom-element hosts by hyphenated tag name", () => {
      const widget = document.createElement("my-widget");

      tracker.noteAddedNodes([buildMutation([widget])]);

      expect(tracker["pendingMutationAddedElements"].has(widget)).toBe(true);
    });

    it("retains a shadow host adopted from an iframe realm (PM-39772)", () => {
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      // Cross-realm host: constructor comes from the iframe's realm, so
      // top-frame `host instanceof Element` returns false.
      const host = iframe.contentDocument!.createElement("foreign-host");
      host.attachShadow({ mode: "open" });

      // Precondition: confirm the cross-realm condition — if this fails,
      // jsdom didn't give us a foreign realm and the regression can't fire.
      expect(host instanceof Element).toBe(false);

      tracker.noteAddedNodes([buildMutation([host])]);

      expect(tracker["pendingMutationAddedElements"].has(host)).toBe(true);
    });

    it("retains plain elements that have descendants", () => {
      const parent = document.createElement("section");
      parent.appendChild(document.createElement("span"));

      tracker.noteAddedNodes([buildMutation([parent])]);

      expect(tracker["pendingMutationAddedElements"].has(parent)).toBe(true);
    });

    it("skips pure-leaf, non-custom elements with no children", () => {
      const span = document.createElement("span");
      const input = document.createElement("input");

      tracker.noteAddedNodes([buildMutation([span, input])]);

      expect(tracker["pendingMutationAddedElements"].size).toBe(0);
    });

    it("skips non-Element nodes (text)", () => {
      const text = document.createTextNode("hello");

      tracker.noteAddedNodes([buildMutation([text])]);

      expect(tracker["pendingMutationAddedElements"].size).toBe(0);
    });

    it("trips the overflow flag at the cap and keeps the capped set for incremental scan", () => {
      const cap = tracker["pendingMutationAddedElementsCap"];
      const widgets = Array.from({ length: cap + 50 }, () => document.createElement("my-widget"));

      tracker.noteAddedNodes([buildMutation(widgets)]);

      expect(tracker["pendingMutationAddedElementsOverflowed"]).toBe(true);
      expect(tracker["pendingMutationAddedElements"].size).toBe(cap);
    });

    it("is a no-op once overflow has been tripped (later batches are ignored)", () => {
      tracker["pendingMutationAddedElementsOverflowed"] = true;
      const widget = document.createElement("my-widget");

      tracker.noteAddedNodes([buildMutation([widget])]);

      expect(tracker["pendingMutationAddedElements"].has(widget)).toBe(false);
    });

    it("resets pending state and overflow flag after the debounced scan fires", () => {
      const widget = document.createElement("my-widget");
      document.body.appendChild(widget);
      tracker["pendingMutationAddedElementsOverflowed"] = true;
      tracker["pendingMutationAddedElements"].add(widget);

      tracker.noteAddedNodes([buildMutation([widget])]);
      jest.advanceTimersByTime(500);

      expect(tracker["pendingMutationAddedElements"].size).toBe(0);
      expect(tracker["pendingMutationAddedElementsOverflowed"]).toBe(false);
    });

    it("requests a collection walk after overflow, since the dropped tail reached no pool", () => {
      const cap = tracker["pendingMutationAddedElementsCap"];
      const widgets = Array.from({ length: cap + 50 }, () => document.createElement("my-widget"));
      widgets.forEach((widget) => document.body.appendChild(widget));

      tracker.noteAddedNodes([buildMutation(widgets)]);
      jest.advanceTimersByTime(500);

      expect(requestPageDetailsUpdate).toHaveBeenCalled();
    });

    it("does not request a collection walk when the batch fit under the cap", () => {
      jest
        .spyOn(domQueryService, "checkForNewShadowRoots")
        .mockReturnValue({ foundNewRoot: false, unresolvedHosts: new Set() });
      const widget = document.createElement("my-widget");
      document.body.appendChild(widget);

      tracker.noteAddedNodes([buildMutation([widget])]);
      jest.advanceTimersByTime(500);

      expect(requestPageDetailsUpdate).not.toHaveBeenCalled();
    });
  });

  describe("scan debouncing", () => {
    it("schedules a single debounced scan", () => {
      const checkSpy = jest
        .spyOn(domQueryService, "checkForNewShadowRoots")
        .mockReturnValue({ foundNewRoot: false, unresolvedHosts: new Set() });
      const widget = document.createElement("my-widget");
      document.body.appendChild(widget);

      tracker.noteAddedNodes([buildMutation([widget])]);

      expect(tracker["pendingScan"]).toBe(true);
      expect(tracker["scanTimeout"]).not.toBeNull();

      jest.advanceTimersByTime(500);

      expect(checkSpy).toHaveBeenCalled();
      expect(tracker["pendingScan"]).toBe(false);
    });

    it("does not reschedule while a scan is already pending", () => {
      const widget = document.createElement("my-widget");
      document.body.appendChild(widget);

      tracker.noteAddedNodes([buildMutation([widget])]);
      const firstTimeout = tracker["scanTimeout"];

      tracker.noteAddedNodes([buildMutation([widget])]);

      expect(tracker["scanTimeout"]).toBe(firstTimeout);
    });

    it("hands the scan the mutation observer so discovered roots are enrolled where they are found", () => {
      const checkSpy = jest
        .spyOn(domQueryService, "checkForNewShadowRoots")
        .mockReturnValue({ foundNewRoot: false, unresolvedHosts: new Set() });
      const widget = document.createElement("my-widget");
      document.body.appendChild(widget);

      tracker.noteAddedNodes([buildMutation([widget])]);
      jest.advanceTimersByTime(500);

      expect(checkSpy).toHaveBeenCalledWith(expect.any(Array), mutationObserver);
    });
  });

  describe("late hydration", () => {
    it("re-scans a custom element that attaches its shadow root after the candidate window", () => {
      // Defined-but-lazy proxy (Stencil-style): exercises the polling path.
      customElements.define("lazy-login", class extends HTMLElement {});
      const checkSpy = jest.spyOn(domQueryService, "checkForNewShadowRoots");
      const lazyHost = document.createElement("lazy-login");
      document.body.appendChild(lazyHost);

      tracker.noteAddedNodes([buildMutation([lazyHost])]);
      jest.advanceTimersByTime(500);

      // First scan ran before hydration: nothing found, host tracked for re-scan.
      expect(checkSpy).toHaveLastReturnedWith(expect.objectContaining({ foundNewRoot: false }));
      expect(tracker["hostsAwaitingShadowRoot"].has(lazyHost)).toBe(true);
      expect(tracker["retryTimeout"]).not.toBeNull();

      // Lazy hydration: attachShadow emits no mutation records.
      const shadowRoot = lazyHost.attachShadow({ mode: "open" });
      shadowRoot.appendChild(Object.assign(document.createElement("input"), { type: "text" }));

      jest.advanceTimersByTime(500);

      expect(checkSpy).toHaveLastReturnedWith(expect.objectContaining({ foundNewRoot: true }));
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["retryTimeout"]).toBeNull();
      expect(requestPageDetailsUpdate).toHaveBeenCalled();
    });

    it("re-scans a nested host that hydrates inside an already-registered root", () => {
      customElements.define("sign-in-form", class extends HTMLElement {});
      const checkSpy = jest.spyOn(domQueryService, "checkForNewShadowRoots");
      const outerHost = document.createElement("global-login");
      const outerRoot = outerHost.attachShadow({ mode: "open" });
      domQueryService["knownShadowRoots"].add(outerRoot);
      const innerHost = document.createElement("sign-in-form");
      outerRoot.appendChild(innerHost);
      document.body.appendChild(outerHost);

      tracker.noteAddedNodes([buildMutation([outerHost])]);
      jest.advanceTimersByTime(500);

      expect(checkSpy).toHaveLastReturnedWith(expect.objectContaining({ foundNewRoot: false }));
      expect(tracker["hostsAwaitingShadowRoot"].has(innerHost)).toBe(true);

      const innerRoot = innerHost.attachShadow({ mode: "open" });
      innerRoot.appendChild(Object.assign(document.createElement("input"), { type: "text" }));

      jest.advanceTimersByTime(500);

      expect(checkSpy).toHaveLastReturnedWith(expect.objectContaining({ foundNewRoot: true }));
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
    });

    it("stops re-scanning a host that never hydrates and tombstones it", () => {
      // Icon-library case: tag defined, renders light DOM, never attaches a root.
      customElements.define("inert-widget", class extends HTMLElement {});
      const inertHost = document.createElement("inert-widget");
      document.body.appendChild(inertHost);

      tracker.noteAddedNodes([buildMutation([inertHost])]);
      jest.advanceTimersByTime(500);
      expect(tracker["hostsAwaitingShadowRoot"].has(inertHost)).toBe(true);

      // Backoff retries continue until the first scan past the 30s lifetime.
      jest.advanceTimersByTime(32000);

      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["retryTimeout"]).toBeNull();
      expect(tracker["expiredHosts"].has(inertHost)).toBe(true);

      // A later candidate window cannot resurrect a tombstoned host.
      tracker.noteAddedNodes([buildMutation([inertHost])]);
      jest.advanceTimersByTime(500);
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
    });

    it("restarts the backoff only for new unresolved work, not already-tracked hosts", () => {
      customElements.define("backoff-a", class extends HTMLElement {});
      customElements.define("backoff-b", class extends HTMLElement {});
      const hostA = document.createElement("backoff-a");
      document.body.appendChild(hostA);

      tracker.noteAddedNodes([buildMutation([hostA])]);
      jest.advanceTimersByTime(500);
      expect(tracker["retryRound"]).toBe(1);

      // Retry with no new hosts: backoff climbs instead of resetting.
      jest.advanceTimersByTime(500);
      expect(tracker["retryRound"]).toBe(2);

      const hostB = document.createElement("backoff-b");
      document.body.appendChild(hostB);
      tracker.noteAddedNodes([buildMutation([hostB])]);
      jest.advanceTimersByTime(500);
      expect(tracker["retryRound"]).toBe(1);
    });

    it("rotates overflow hosts into tracking as earlier hosts expire", () => {
      customElements.define("inert-rotation-widget", class extends HTMLElement {});
      const cap = tracker["trackingCap"];
      const hosts = Array.from({ length: cap + 6 }, () =>
        document.createElement("inert-rotation-widget"),
      );
      for (const host of hosts) {
        document.body.appendChild(host);
      }

      tracker.noteAddedNodes([buildMutation(hosts)]);
      jest.advanceTimersByTime(500);

      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(cap);
      expect(tracker["overflowQueue"].length).toBe(6);
      expect(tracker["hostsAwaitingShadowRoot"].has(hosts[cap + 5])).toBe(false);

      // The first cohort tombstones past its 30s lifetime; the queue drains into freed slots.
      jest.advanceTimersByTime(32000);

      expect(tracker["hostsAwaitingShadowRoot"].has(hosts[cap + 5])).toBe(true);
      expect(tracker["overflowQueue"].length).toBe(0);
    });

    it("scans a re-reported host once, though it sits in both the pending and tracked pools", () => {
      customElements.define("rerendered-login", class extends HTMLElement {});
      const checkSpy = jest.spyOn(domQueryService, "checkForNewShadowRoots");
      const host = document.createElement("rerendered-login");
      document.body.appendChild(host);

      // First scan tracks it: `:defined`, but no shadow root yet.
      tracker.noteAddedNodes([buildMutation([host])]);
      jest.advanceTimersByTime(500);
      expect(tracker["hostsAwaitingShadowRoot"].has(host)).toBe(true);

      // Re-parenting re-reports a host that tracking already holds, so both pools name it.
      tracker.noteAddedNodes([buildMutation([host])]);
      expect(tracker["pendingMutationAddedElements"].has(host)).toBe(true);
      jest.advanceTimersByTime(500);

      // A duplicate would re-walk the same subtree in `scanForNewShadowRootInSubtree`.
      expect(checkSpy.mock.lastCall?.[0]).toEqual([host]);
    });
  });

  describe("hosts awaiting definition", () => {
    it("parks an undefined-tag host scan-free and enrolls it when the definition lands", () => {
      const lazyHost = document.createElement("late-defined-login");
      document.body.appendChild(lazyHost);

      tracker.noteAddedNodes([buildMutation([lazyHost])]);
      jest.advanceTimersByTime(500);

      // Undefined tag: parked, paying no polling budget at the fast cadence.
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["hostsAwaitingDefinition"].has(lazyHost)).toBe(true);

      customElements.define(
        "late-defined-login",
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open" });
          }
        },
      );

      // Definition alone signals nothing — the parked-only sweep at cap cadence finds the
      // `:defined` flip, promotes the host, and the same scan sees its new root.
      jest.advanceTimersByTime(8000);

      expect(tracker["hostsAwaitingDefinition"].size).toBe(0);
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["retryTimeout"]).toBeNull();
    });

    it("does not expire a parked host while its definition is still loading", () => {
      const slowHost = document.createElement("slow-network-login");
      document.body.appendChild(slowHost);

      tracker.noteAddedNodes([buildMutation([slowHost])]);
      jest.advanceTimersByTime(500);

      // Past the shadow-root lifetime but inside the 60s park deadline: still waiting.
      jest.advanceTimersByTime(30000);
      expect(tracker["hostsAwaitingDefinition"].has(slowHost)).toBe(true);
      expect(tracker["expiredHosts"].has(slowHost)).toBe(false);

      customElements.define(
        "slow-network-login",
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open" });
          }
        },
      );
      jest.advanceTimersByTime(8000);

      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["hostsAwaitingDefinition"].size).toBe(0);
    });

    it("expires a parked host whose definition never lands so the retry timer settles", () => {
      const ghostHost = document.createElement("never-defined-widget");
      document.body.appendChild(ghostHost);

      tracker.noteAddedNodes([buildMutation([ghostHost])]);
      jest.advanceTimersByTime(500);

      // Parked, waiting on a definition that never comes.
      expect(tracker["hostsAwaitingDefinition"].has(ghostHost)).toBe(true);

      // Past the 60s park deadline: a retry sweep evicts + tombstones it and stops re-arming.
      jest.advanceTimersByTime(65000);

      expect(tracker["hostsAwaitingDefinition"].size).toBe(0);
      expect(tracker["expiredHosts"].has(ghostHost)).toBe(true);
      expect(tracker["retryTimeout"]).toBeNull();
    });

    it("enrolls a parked host when :defined flips without this realm's registry ever learning the tag", () => {
      const checkSpy = jest.spyOn(domQueryService, "checkForNewShadowRoots");
      const host = document.createElement("isolated-world-widget");
      document.body.appendChild(host);

      tracker.noteAddedNodes([buildMutation([host])]);
      jest.advanceTimersByTime(500);
      expect(tracker["hostsAwaitingDefinition"].has(host)).toBe(true);

      // The production shape, verified on a live page: a page-world `define()` never reaches this
      // realm's registry, but it upgrades the shared DOM node, so `:defined` flips here.
      expect(globalThis.customElements.get("isolated-world-widget")).toBeUndefined();
      jest.spyOn(host, "matches").mockImplementation((selector) => selector === ":defined");
      const shadowRoot = host.attachShadow({ mode: "open" });
      shadowRoot.appendChild(Object.assign(document.createElement("input"), { type: "text" }));

      // Parked-only sweep runs at the retry cap cadence.
      jest.advanceTimersByTime(8000);

      expect(checkSpy).toHaveLastReturnedWith(expect.objectContaining({ foundNewRoot: true }));
      expect(tracker["hostsAwaitingDefinition"].size).toBe(0);
      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
    });

    it("does not refresh a park deadline when the same host is re-parked", () => {
      let clock = 0;
      tracker = new ShadowHostHydrationTracker(
        domQueryService,
        mutationObserver,
        requestPageDetailsUpdate,
        () => clock,
      );
      const host = document.createElement("re-parked-widget");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));
      const firstDeadline = tracker["hostsAwaitingDefinition"].get(host);
      expect(firstDeadline).toBe(tracker["awaitingDefinitionLifetimeMs"]);

      clock = 30000;
      tracker.reconcileFromScan(new Set([host]));

      // Re-parking must not push the deadline out, or a tag that never defines never expires.
      expect(tracker["hostsAwaitingDefinition"].get(host)).toBe(firstDeadline);
    });

    it("does not restart backoff for hosts that overflowed instead of taking a tracking slot", () => {
      customElements.define("crowded-widget", class extends HTMLElement {});
      const hosts = Array.from({ length: tracker["trackingCap"] + 40 }, () =>
        document.createElement("crowded-widget"),
      );
      hosts.forEach((host) => document.body.appendChild(host));

      tracker.reconcileFromScan(new Set(hosts));
      const firstRound = tracker["retryRound"];

      // The overflowed tail is re-reported by every scan. Counting it as new work would pin the
      // sweep at the 500ms floor for the whole host lifetime on any component-heavy page.
      tracker.reconcileFromScan(new Set(hosts));

      expect(tracker["retryRound"]).toBeGreaterThan(firstRound);
    });

    it("stops parking a tag once one instance has spent its full lifetime undefined", () => {
      const first = document.createElement("framework-shell");
      document.body.appendChild(first);

      tracker.noteAddedNodes([buildMutation([first])]);
      jest.advanceTimersByTime(500);
      expect(tracker["hostsAwaitingDefinition"].has(first)).toBe(true);

      // Past the park deadline: the tag is abandoned, not just this instance.
      jest.advanceTimersByTime(65000);
      expect(tracker["tagVerdicts"].get("FRAMEWORK-SHELL")).toBe("abandoned");

      // A later render of the same selector no longer takes a slot or re-arms the sweep.
      const second = document.createElement("framework-shell");
      document.body.appendChild(second);
      tracker.noteAddedNodes([buildMutation([second])]);
      jest.advanceTimersByTime(500);

      expect(tracker["hostsAwaitingDefinition"].has(second)).toBe(false);
      expect(tracker["retryTimeout"]).toBeNull();
    });

    it("never abandons a tag that was seen :defined, so a slow definition still upgrades", () => {
      const early = document.createElement("eventually-defined-widget");
      document.body.appendChild(early);
      tracker.noteAddedNodes([buildMutation([early])]);
      jest.advanceTimersByTime(500);

      jest.spyOn(early, "matches").mockImplementation((selector) => selector === ":defined");
      jest.advanceTimersByTime(8000);
      expect(tracker["tagVerdicts"].get("EVENTUALLY-DEFINED-WIDGET")).toBe("defined");

      // A sibling that expires undefined must not poison the tag for the rest of the page.
      const stragglerNotDefined = document.createElement("eventually-defined-widget");
      document.body.appendChild(stragglerNotDefined);
      tracker.noteAddedNodes([buildMutation([stragglerNotDefined])]);
      jest.advanceTimersByTime(65000);

      expect(tracker["tagVerdicts"].get("EVENTUALLY-DEFINED-WIDGET")).toBe("defined");
    });

    it("bounds the learned verdicts against a page that mints tag names", () => {
      const cap = tracker["tagVerdictCap"];
      for (let index = 0; index < cap + 10; index++) {
        tracker["abandonTagName"](`MINTED-TAG-${index}`);
      }

      expect(tracker["tagVerdicts"].size).toBe(cap);
    });

    it("bounds the learned verdicts when the minted tags are the ones that define", () => {
      const cap = tracker["tagVerdictCap"];
      for (let index = 0; index < cap; index++) {
        tracker["abandonTagName"](`MINTED-TAG-${index}`);
      }

      const host = document.createElement("late-minted-widget");
      document.body.appendChild(host);
      tracker["hostsAwaitingDefinition"].set(host, 60000);
      jest.spyOn(host, "matches").mockImplementation((selector) => selector === ":defined");
      tracker["enrollUpgradedParkedHosts"](0);

      expect(tracker["tagVerdicts"].size).toBe(cap);
      expect(tracker["tagVerdicts"].has("LATE-MINTED-WIDGET")).toBe(false);
      // The cap bounds what is learned, not what is tracked.
      expect(tracker["hostsAwaitingShadowRoot"].has(host)).toBe(true);
    });

    it("repairs an abandoned verdict at the cap, where a new verdict would be dropped", () => {
      const cap = tracker["tagVerdictCap"];
      for (let index = 0; index < cap; index++) {
        tracker["abandonTagName"](`MINTED-TAG-${index}`);
      }

      const host = document.createElement("minted-tag-0");
      document.body.appendChild(host);
      tracker["hostsAwaitingDefinition"].set(host, 60000);
      jest.spyOn(host, "matches").mockImplementation((selector) => selector === ":defined");
      tracker["enrollUpgradedParkedHosts"](0);

      expect(tracker["tagVerdicts"].get("MINTED-TAG-0")).toBe("defined");
      expect(tracker["tagVerdicts"].size).toBe(cap);
    });

    it("repairs an abandoned verdict when an instance of that tag is later seen :defined", () => {
      tracker["abandonTagName"]("REPAIRED-WIDGET");
      const host = document.createElement("repaired-widget");
      document.body.appendChild(host);
      // Already parked before the verdict landed, so the sweep still visits it.
      tracker["hostsAwaitingDefinition"].set(host, 60000);

      jest.spyOn(host, "matches").mockImplementation((selector) => selector === ":defined");
      tracker["enrollUpgradedParkedHosts"](0);

      expect(tracker["tagVerdicts"].get("REPAIRED-WIDGET")).toBe("defined");
    });
  });

  describe("reconcileFromScan", () => {
    it("drops a tracked host that the scan no longer reports", () => {
      customElements.define("dropped-widget", class extends HTMLElement {});
      const stale = document.createElement("dropped-widget");
      const fresh = document.createElement("dropped-widget");
      document.body.append(stale, fresh);

      tracker.reconcileFromScan(new Set([stale, fresh]));
      expect(tracker["hostsAwaitingShadowRoot"].has(stale)).toBe(true);

      // A full re-scan that omits `stale` means it hydrated or left — not that it is unchanged.
      tracker.reconcileFromScan(new Set([fresh]));

      expect(tracker["hostsAwaitingShadowRoot"].has(stale)).toBe(false);
      expect(tracker["hostsAwaitingShadowRoot"].has(fresh)).toBe(true);
    });

    it("preserves the original deadline for a host the scan reports again", () => {
      customElements.define("survivor-widget", class extends HTMLElement {});
      let clock = 1000;
      tracker = new ShadowHostHydrationTracker(
        domQueryService,
        mutationObserver,
        requestPageDetailsUpdate,
        () => clock,
      );
      const host = document.createElement("survivor-widget");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));
      const deadline = tracker["hostsAwaitingShadowRoot"].get(host);

      clock = 5000;
      tracker.reconcileFromScan(new Set([host]));

      // A survivor keeps its budget; re-reporting must not extend its lifetime.
      expect(tracker["hostsAwaitingShadowRoot"].get(host)).toBe(deadline);
    });

    it("tombstones a host once the clock passes its deadline", () => {
      customElements.define("expiring-widget", class extends HTMLElement {});
      let clock = 0;
      tracker = new ShadowHostHydrationTracker(
        domQueryService,
        mutationObserver,
        requestPageDetailsUpdate,
        () => clock,
      );
      const host = document.createElement("expiring-widget");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));
      expect(tracker["hostsAwaitingShadowRoot"].has(host)).toBe(true);

      clock = tracker["hostLifetimeMs"] + 1;
      tracker.reconcileFromScan(new Set([host]));

      expect(tracker["hostsAwaitingShadowRoot"].has(host)).toBe(false);
      expect(tracker["expiredHosts"].has(host)).toBe(true);
    });
  });

  describe("hasHostsAwaitingShadowRoot", () => {
    it("reports a :defined host with no shadow root", () => {
      customElements.define("gating-widget", class extends HTMLElement {});
      const host = document.createElement("gating-widget");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));

      expect(tracker.hasHostsAwaitingShadowRoot()).toBe(true);
    });

    it("ignores hosts that are only awaiting definition", () => {
      // Steady state on framework pages: every unregistered component selector (<app-root>,
      // <mat-form-field>, …) parks permanently. Reporting it here would keep the explicit-
      // collection gate — and its O(document) shadow scan — firing on every fill.
      const host = document.createElement("app-root");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));

      expect(tracker["hostsAwaitingDefinition"].size).toBe(1);
      expect(tracker.hasHostsAwaitingShadowRoot()).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears tracking, the pending batch, and both timers", () => {
      customElements.define("reset-widget", class extends HTMLElement {});
      const tracked = document.createElement("reset-widget");
      const parked = document.createElement("unregistered-reset-widget");
      document.body.append(tracked, parked);

      tracker.reconcileFromScan(new Set([tracked, parked]));
      tracker.noteAddedNodes([buildMutation([tracked])]);
      expect(tracker["retryTimeout"]).not.toBeNull();
      expect(tracker["scanTimeout"]).not.toBeNull();

      tracker.reset();

      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["hostsAwaitingDefinition"].size).toBe(0);
      expect(tracker["overflowQueue"].length).toBe(0);
      expect(tracker["pendingMutationAddedElements"].size).toBe(0);
      expect(tracker["pendingMutationAddedElementsOverflowed"]).toBe(false);
      expect(tracker["pendingScan"]).toBe(false);
      expect(tracker["retryRound"]).toBe(0);
      expect(tracker["retryTimeout"]).toBeNull();
      expect(tracker["scanTimeout"]).toBeNull();
    });

    it("keeps tombstones so an expired host cannot be resurrected after reset", () => {
      customElements.define("tombstoned-widget", class extends HTMLElement {});
      const host = document.createElement("tombstoned-widget");
      document.body.appendChild(host);
      tracker["expiredHosts"].add(host);

      tracker.reset();
      tracker.reconcileFromScan(new Set([host]));

      expect(tracker["hostsAwaitingShadowRoot"].has(host)).toBe(false);
    });

    it("does not resurrect a parked host that is defined after the reset", () => {
      const host = document.createElement("reset-race-widget");
      document.body.appendChild(host);

      tracker.reconcileFromScan(new Set([host]));
      expect(tracker["hostsAwaitingDefinition"].has(host)).toBe(true);

      // Reset drops the parked pool, so a later definition has nothing to promote. Enrollment is
      // pull-only (the `:defined` sweep), so nothing outside the tracker can re-arm a timer.
      tracker.reset();
      customElements.define("reset-race-widget", class extends HTMLElement {});
      jest.advanceTimersByTime(8000);

      expect(tracker["hostsAwaitingShadowRoot"].size).toBe(0);
      expect(tracker["retryTimeout"]).toBeNull();
    });
  });
});

import { nodeIsElement } from "../utils";

import { DomQueryService } from "./abstractions/dom-query.service";

/** A wall-clock deadline or reading; durations stay plain `number`. */
type EpochMs = number;

/** What a scan has learned about a tag name. One verdict per tag, so the two can't disagree. */
const TagVerdict = Object.freeze({ Defined: "defined", Abandoned: "abandoned" } as const);
type TagVerdict = (typeof TagVerdict)[keyof typeof TagVerdict];

/**
 * `attachShadow()` emits no mutation record, so a custom-element host observed once and never
 * revisited is a field we silently fail to autofill. Both waits below are deadline-bounded, so a
 * host that never hydrates expires instead of keeping the retry timer armed:
 *
 *   parked (not `:defined`) --`:defined`--> awaiting shadow root --attachShadow--> enrolled, dropped
 */
export class ShadowHostHydrationTracker {
  private hostsAwaitingShadowRoot: Map<Element, EpochMs> = new Map();
  // Tombstones, keyed by identity: an expired host must not be re-admitted by a later scan.
  private expiredHosts = new WeakSet<Element>();
  // Rotates FIFO when the tracking map is full — delay, not starvation.
  private overflowQueue: Element[] = [];
  private hostsAwaitingDefinition: Map<Element, EpochMs> = new Map();
  private tagVerdicts = new Map<string, TagVerdict>();

  private pendingMutationAddedElements: Set<Element> = new Set();
  private pendingMutationAddedElementsOverflowed = false;

  private retryTimeout: NodeJS.Timeout | number | null = null;
  private retryRound = 0;
  private scanTimeout: NodeJS.Timeout | number | null = null;
  private pendingScan = false;

  // Deadlines, not scan counts: coverage stays independent of page churn.
  private readonly hostLifetimeMs = 30000;
  // Longer than a hydration wait so a slow-loading definition still upgrades, but finite.
  private readonly awaitingDefinitionLifetimeMs = 60000;
  private readonly maxRetryDelayMs = 8000;
  private readonly trackingCap = 64;
  private readonly overflowCap = 192;
  private readonly awaitingDefinitionCap = 64;
  // Bounds the learned verdicts against a page that mints tag names.
  private readonly tagVerdictCap = 128;
  private readonly pendingMutationAddedElementsCap = 256;
  // Also the base delay for retry backoff.
  private readonly scanDebounceMs = 500;

  /**
   * @param mutationObserver handed to each scan so discovered roots are enrolled where they are
   *   found, rather than waiting for the next whole-document walk
   * @param requestPageDetailsUpdate invoked when a scan finds a root that earlier collection
   *   missed; the caller debounces it into a re-collection
   * @param now injectable clock, so specs can advance deadlines without faking timers
   */
  constructor(
    private readonly domQueryService: DomQueryService,
    private readonly mutationObserver: MutationObserver,
    private readonly requestPageDetailsUpdate: () => void,
    private readonly now: () => EpochMs = () => Date.now(),
  ) {}

  /**
   * Handles DOM additions surfaced by the MutationObserver, coalescing them into
   * a single debounced page scan.
   *
   * Shadow-root candidates are collected on every call, so that batches arriving
   * before a pending scan fires still contribute their candidates. The scan
   * itself is armed once per burst: the first call starts a `scanDebounceMs`
   * timer and further calls before it fires are absorbed, yielding at most one
   * scan.
   *
   * @param mutations - Mutation records batched by the observer.
   */
  noteAddedNodes(mutations: MutationRecord[]): void {
    this.collectAddedShadowRootCandidates(mutations);
    if (this.pendingScan) {
      return;
    }
    this.pendingScan = true;
    if (this.scanTimeout) {
      globalThis.clearTimeout(this.scanTimeout);
    }
    this.scanTimeout = setTimeout(() => {
      this.scanTimeout = null;
      const overflowed = this.pendingMutationAddedElementsOverflowed;
      this.runScan();
      this.pendingScan = false;
      this.pendingMutationAddedElements.clear();
      this.pendingMutationAddedElementsOverflowed = false;
      // The tail past the cap reached no pool, and `attachShadow` emits no mutation to find it
      // later; one collection walk re-enrolls what the batch dropped.
      if (overflowed) {
        this.requestPageDetailsUpdate();
      }
    }, this.scanDebounceMs);
  }

  /**
   * Replaces tracking with the result of a **complete** re-scan: a tracked host absent from
   * `scannedHosts` is dropped as hydrated-or-gone. A partial set silently evicts live tracking.
   */
  reconcileFromScan(scannedHosts: Set<Element>): void {
    this.reconcile(scannedHosts, this.now());
  }

  /**
   * Must exclude {@link hostsAwaitingDefinition}: on framework pages every unregistered component
   * selector (`<app-root>`, `<mat-form-field>`, …) parks there permanently, so including it would
   * report "work pending" forever. Coverage holds because the sweep promotes a host into this pool
   * the moment it flips `:defined`.
   */
  hasHostsAwaitingShadowRoot(): boolean {
    return this.hostsAwaitingShadowRoot.size > 0;
  }

  /**
   * `expiredHosts` deliberately survives: tombstones key on element identity, and clearing them
   * would let an expired host resurrect on the next scan. `tagVerdicts` survives too — every caller
   * stays in the same document, so which tags it defines has not changed.
   */
  reset(): void {
    if (this.retryTimeout) {
      globalThis.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.scanTimeout) {
      globalThis.clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    this.hostsAwaitingShadowRoot.clear();
    this.overflowQueue.length = 0;
    this.hostsAwaitingDefinition.clear();
    this.pendingMutationAddedElements.clear();
    this.pendingMutationAddedElementsOverflowed = false;
    this.pendingScan = false;
    this.retryRound = 0;
  }

  private runScan = (): void => {
    const now = this.now();
    this.enrollUpgradedParkedHosts(now);

    // Hosts added by mutation may have been removed during the scan debounce. Neither source can
    // hold internal duplicates, so the pending set doubles as the cross-source dedup.
    const batch: Element[] = [];
    for (const element of this.pendingMutationAddedElements) {
      if (element.isConnected) {
        batch.push(element);
      }
    }
    for (const host of this.hostsAwaitingShadowRoot.keys()) {
      if (!this.pendingMutationAddedElements.has(host) && host.isConnected) {
        batch.push(host);
      }
    }

    const { foundNewRoot, unresolvedHosts } = this.domQueryService.checkForNewShadowRoots(
      batch,
      this.mutationObserver,
    );
    if (foundNewRoot) {
      this.requestPageDetailsUpdate();
    }
    this.reconcile(unresolvedHosts, now);
  };

  private reconcile(scannedHosts: Set<Element>, now: EpochMs): void {
    const previousDeadlines = this.hostsAwaitingShadowRoot;
    this.hostsAwaitingShadowRoot = new Map();
    let sawNewHost = false;

    for (const element of scannedHosts) {
      if (this.expiredHosts.has(element)) {
        continue;
      }
      if (!element.matches(":defined")) {
        this.parkHost(element, now);
        continue;
      }
      const expiresAt = previousDeadlines.get(element) ?? now + this.hostLifetimeMs;
      if (now >= expiresAt) {
        this.expiredHosts.add(element);
        continue;
      }
      // Newly *tracked*, not newly seen: an overflowed host takes no slot, and counting it would
      // reset the backoff every scan on any page holding more unresolved hosts than the cap.
      if (this.admitHost(element, expiresAt) && !previousDeadlines.has(element)) {
        sawNewHost = true;
      }
    }

    this.drainOverflow(now);

    if (sawNewHost) {
      this.noteNewWork();
    }

    this.scheduleRetry();
  }

  /** @returns whether the host took a tracking slot — queued and dropped hosts both report false. */
  private admitHost(element: Element, expiresAt: EpochMs): boolean {
    if (this.hostsAwaitingShadowRoot.size < this.trackingCap) {
      this.hostsAwaitingShadowRoot.set(element, expiresAt);
      return true;
    }
    if (this.overflowQueue.length < this.overflowCap) {
      this.overflowQueue.push(element);
    }
    return false;
  }

  private drainOverflow(now: EpochMs): void {
    while (this.overflowQueue.length > 0 && this.hostsAwaitingShadowRoot.size < this.trackingCap) {
      const element = this.overflowQueue.shift();
      if (
        element &&
        element.isConnected &&
        !this.expiredHosts.has(element) &&
        !this.hostsAwaitingShadowRoot.has(element)
      ) {
        // while-guard keeps size < cap, so admit always seats in the map here.
        this.admitHost(element, now + this.hostLifetimeMs);
      }
    }
  }

  /**
   * Polling `:defined` is the only enrollment path out of the parked pool, not a fallback. This
   * realm's `customElements` registry never learns a page-world `define()` (verified on a live
   * page), but `:defined` reads the shared DOM node's state, so the upgrade is visible here.
   */
  private enrollUpgradedParkedHosts(now: EpochMs): void {
    let enrolled = false;
    for (const [element, parkDeadline] of this.hostsAwaitingDefinition) {
      if (!element.isConnected) {
        this.hostsAwaitingDefinition.delete(element);
        continue;
      }
      if (element.matches(":defined")) {
        this.hostsAwaitingDefinition.delete(element);
        this.markTagNameDefined(element.tagName);
        // `admitHost` first — `||` would short-circuit past admission once one host has enrolled.
        enrolled = this.admitHost(element, now + this.hostLifetimeMs) || enrolled;
        continue;
      }
      // Tombstoned, not just dropped, so it can't re-park and the retry timer can settle.
      if (now >= parkDeadline) {
        this.hostsAwaitingDefinition.delete(element);
        this.expiredHosts.add(element);
        this.abandonTagName(element.tagName);
      }
    }
    if (enrolled) {
      this.noteNewWork();
    }
  }

  /**
   * `has` first, so proof of definition still repairs an `Abandoned` verdict at the cap; past it
   * {@link abandonTagName} is a no-op too, so a dropped verdict abandons nothing.
   */
  private markTagNameDefined(tagName: string): void {
    if (this.tagVerdicts.has(tagName) || this.tagVerdicts.size < this.tagVerdictCap) {
      this.tagVerdicts.set(tagName, TagVerdict.Defined);
    }
  }

  /**
   * A full lifetime spent undefined is the only evidence available that a tag will never register —
   * this realm's registry can't be consulted (see {@link enrollUpgradedParkedHosts}). Skipping later
   * instances keeps framework selectors from filling the capped pool and re-arming the sweep on
   * every render. Cost: a definition landing after the deadline loses that tag's other instances.
   */
  private abandonTagName(tagName: string): void {
    // Any existing verdict wins: `Defined` is the exemption, `Abandoned` is already recorded.
    if (this.tagVerdicts.has(tagName) || this.tagVerdicts.size >= this.tagVerdictCap) {
      return;
    }
    this.tagVerdicts.set(tagName, TagVerdict.Abandoned);
  }

  private parkHost(element: Element, now: EpochMs): void {
    if (this.tagVerdicts.get(element.tagName) === TagVerdict.Abandoned) {
      return;
    }
    // Stamp once — re-parking on later scans must not refresh the deadline, or an element whose
    // tag never defines would postpone expiry forever.
    if (
      this.hostsAwaitingDefinition.size < this.awaitingDefinitionCap &&
      !this.hostsAwaitingDefinition.has(element)
    ) {
      this.hostsAwaitingDefinition.set(element, now + this.awaitingDefinitionLifetimeMs);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimeout) {
      globalThis.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.hostsAwaitingShadowRoot.size === 0 && this.hostsAwaitingDefinition.size === 0) {
      this.retryRound = 0;
      return;
    }
    // Exponential backoff (deadlines bound total work). Parked-only: sweep at the slowest cadence.
    const delay =
      this.hostsAwaitingShadowRoot.size === 0
        ? this.maxRetryDelayMs
        : Math.min(
            // Clamp the exponent: `<<` is a 32-bit shift, so an unclamped round would
            // eventually wrap to a tiny delay. 5 already exceeds the max (500 << 5 = 16s).
            this.scanDebounceMs << Math.min(this.retryRound, 5),
            this.maxRetryDelayMs,
          );
    this.retryRound++;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      this.runScan();
    }, delay);
  }

  private noteNewWork(): void {
    this.retryRound = 0;
  }

  // Residual gap: a plain (non-custom) element given `attachShadow()` later is never
  // a candidate and emits no mutation. Custom elements are covered by the re-scans.
  private collectAddedShadowRootCandidates(mutations: MutationRecord[]): void {
    if (this.pendingMutationAddedElementsOverflowed) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes ?? []) {
        if (!this.isShadowRootCandidate(node)) {
          continue;
        }
        this.pendingMutationAddedElements.add(node);
        if (this.pendingMutationAddedElements.size >= this.pendingMutationAddedElementsCap) {
          this.pendingMutationAddedElementsOverflowed = true;
          // Don't clear: the scan still covers these, and the post-overflow walk covers the rest.
          return;
        }
      }
    }
  }

  private isShadowRootCandidate(node: Node): node is Element {
    if (!nodeIsElement(node)) {
      return false;
    }
    if (node.shadowRoot) {
      return true;
    }
    // Custom element — `attachShadow` may run after observation.
    if (node.tagName.includes("-")) {
      return true;
    }
    return node.firstElementChild !== null;
  }
}

import { Subject } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { resolvedTransitions } from "./resolved-transitions.rx";
import type { BufferedTransitionReport, ResolvedTransitionReport } from "./types";

/** The URL of the tab whose document reported; distinct for each document. */
const urlOf = (documentId: string) => `https://${documentId}.example/`;

const user = "user-1" as UserId;

const edge = (from: TabState, to: TabState, cause: TabEdgeCause): TabEdge => ({
  from,
  to,
  cause,
  focused: true,
});

const buffered = (
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  stampedAt = 1000,
): BufferedTransitionReport => ({
  userId: user,
  tabId,
  frameId,
  documentId,
  url: urlOf(documentId),
  stampedAt,
  expiresAt: stampedAt + 5000,
});

describe("resolvedTransitions", () => {
  let resolved$: Subject<BufferedTransitionReport>;
  let tabLifecycleChanged$: Subject<readonly [number, TabEdge]>;
  let tabRemoved$: Subject<number>;
  let emitted: ResolvedTransitionReport[];
  let order: string[];

  beforeEach(() => {
    resolved$ = new Subject();
    tabLifecycleChanged$ = new Subject();
    tabRemoved$ = new Subject();
    emitted = [];
    order = [];
    resolved$
      .pipe(resolvedTransitions({ tabLifecycleChanged$, tabRemoved$ }))
      .subscribe((report) => {
        emitted.push(report);
        order.push(`emitted ${report.documentId}`);
      });
  });

  const leaveHot = (tabId: number) =>
    tabLifecycleChanged$.next([
      tabId,
      edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate),
    ]);

  describe("each transition", () => {
    it("is handed on with its tab's URL, without the buffer's bookkeeping, and with a token that is not cancelled", () => {
      resolved$.next(buffered(1, 0, "a"));

      expect(emitted).toEqual([
        {
          userId: user,
          tabId: 1,
          frameId: 0,
          documentId: "a",
          url: urlOf("a"),
          expiresAt: 6000,
          cancellation: expect.anything(),
        },
      ]);
      expect(emitted[0]).not.toHaveProperty("stampedAt");
      expect(emitted[0].cancellation.cancelled).toBe(false);
      const heard: string[] = [];
      emitted[0].cancellation.cancelled$.subscribe({
        next: () => heard.push("cancelled"),
        complete: () => heard.push("complete"),
      });
      expect(heard).toEqual([]);
    });

    it("keeps the top frame as a frame without an id", () => {
      resolved$.next(buffered(1, undefined, "top"));

      expect(emitted[0].frameId).toBeUndefined();
    });
  });

  describe("when its tab leaves hot", () => {
    it.each([
      ["is deactivated", edge(TabState.Hot, TabState.CoolDown, TabEdgeCause.Deactivate)],
      ["loses its window's focus", edge(TabState.Hot, TabState.Warm, TabEdgeCause.Blur)],
      ["is frozen by a logout", edge(TabState.Hot, TabState.Frozen, TabEdgeCause.Logout)],
    ])("expires every transition of the tab when it %s", (_, leaving) => {
      resolved$.next(buffered(1, 0, "a"));
      resolved$.next(buffered(1, 3, "b"));

      tabLifecycleChanged$.next([1, leaving]);

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, true]);
    });

    it("leaves the transitions of other tabs", () => {
      resolved$.next(buffered(1, 0, "a"));
      resolved$.next(buffered(2, 0, "b"));

      leaveHot(1);

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, false]);
    });

    it.each([
      ["becomes hot", edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle)],
      ["becomes hot by a command", edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Command)],
      ["gains focus", edge(TabState.Warm, TabState.Hot, TabEdgeCause.Focus)],
      ["is activated", edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate)],
      ["cools down", edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed)],
    ])("expires nothing when the tab %s", (_, change) => {
      resolved$.next(buffered(1, 0, "a"));

      tabLifecycleChanged$.next([1, change]);

      expect(emitted[0].cancellation.cancelled).toBe(false);
    });

    it("does not expire a transition that resolves after the tab left hot", () => {
      leaveHot(1);

      resolved$.next(buffered(1, 0, "a"));

      expect(emitted[0].cancellation.cancelled).toBe(false);
    });

    it("expires a transition that resolves after a second time the tab was hot, when it leaves again", () => {
      resolved$.next(buffered(1, 0, "a"));
      leaveHot(1);
      tabLifecycleChanged$.next([1, edge(TabState.CoolDown, TabState.Hot, TabEdgeCause.Activate)]);
      resolved$.next(buffered(1, 0, "b"));
      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, false]);

      leaveHot(1);

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, true]);
    });

    it("expires a transition that is removed after its tab left hot, and once", () => {
      resolved$.next(buffered(1, 0, "a"));
      const { heard } = (() => {
        const heard: string[] = [];
        emitted[0].cancellation.cancelled$.subscribe(() => heard.push("cancelled"));
        return { heard };
      })();

      leaveHot(1);
      tabRemoved$.next(1);

      expect(heard).toEqual(["cancelled"]);
    });

    it.each<[string, () => void]>([
      ["its tab leaves hot", () => leaveHot(1)],
      ["its tab is removed", () => tabRemoved$.next(1)],
      ["a newer transition resolves", () => resolved$.next(buffered(1, 0, "newer"))],
    ])("lets the stream of its token hear the expiry once, when %s", (_, expire) => {
      resolved$.next(buffered(1, 0, "a"));
      const heard: string[] = [];
      emitted[0].cancellation.cancelled$.subscribe({
        next: () => heard.push("cancelled"),
        complete: () => heard.push("complete"),
      });

      expire();

      expect(heard).toEqual(["cancelled", "complete"]);
    });
  });

  describe("when its tab is removed", () => {
    it("expires every transition of the tab, and no other", () => {
      resolved$.next(buffered(1, 0, "a"));
      resolved$.next(buffered(1, 3, "b"));
      resolved$.next(buffered(2, 0, "c"));

      tabRemoved$.next(1);

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([
        true,
        true,
        false,
      ]);
    });
  });

  describe("when a newer transition for its frame resolves", () => {
    it("expires the older transition, and not the newer one", () => {
      resolved$.next(buffered(1, 0, "older"));

      resolved$.next(buffered(1, 0, "newer"));

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, false]);
    });

    it("expires the older transition before the newer one is emitted", () => {
      resolved$.next(buffered(1, 0, "older"));
      emitted[0].cancellation.cancelled$.subscribe(() => order.push("older expired"));

      resolved$.next(buffered(1, 0, "newer"));

      expect(order).toEqual(["emitted older", "older expired", "emitted newer"]);
    });

    it("leaves the transitions of other frames of the tab", () => {
      resolved$.next(buffered(1, 0, "a"));
      resolved$.next(buffered(1, 3, "b"));

      resolved$.next(buffered(1, 0, "a again"));

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([
        true,
        false,
        false,
      ]);
    });

    it("does not emit a transition that is older than the latest of its frame, and keeps the latest live", () => {
      resolved$.next(buffered(1, 0, "newer", 2000));

      // as a transition restored from storage arrives after a fresh one
      resolved$.next(buffered(1, 0, "older", 1000));

      expect(emitted.map(({ documentId }) => documentId)).toEqual(["newer"]);
      expect(emitted[0].cancellation.cancelled).toBe(false);
    });

    it("emits a transition that is as new as the latest of its frame", () => {
      resolved$.next(buffered(1, 0, "first", 1000));

      resolved$.next(buffered(1, 0, "second", 1000));

      expect(emitted.map(({ documentId }) => documentId)).toEqual(["first", "second"]);
      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, false]);
    });

    it("emits an older transition once its tab left hot, because nothing newer is kept", () => {
      resolved$.next(buffered(1, 0, "newer", 2000));
      leaveHot(1);

      resolved$.next(buffered(1, 0, "older", 1000));

      expect(emitted.map(({ documentId }) => documentId)).toEqual(["newer", "older"]);
    });

    it("tells the top frame from frame 0", () => {
      resolved$.next(buffered(1, undefined, "top"));

      resolved$.next(buffered(1, 0, "frame zero"));

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([false, false]);
    });

    it("leaves the transitions of other tabs", () => {
      resolved$.next(buffered(1, 0, "a"));

      resolved$.next(buffered(2, 0, "b"));

      expect(emitted.map(({ cancellation }) => cancellation.cancelled)).toEqual([false, false]);
    });
  });

  describe("each subscription", () => {
    it("keeps its own record, so a second subscription expires nothing of the first", () => {
      const other = new Subject<BufferedTransitionReport>();
      const second: ResolvedTransitionReport[] = [];
      other
        .pipe(resolvedTransitions({ tabLifecycleChanged$, tabRemoved$ }))
        .subscribe((report) => second.push(report));
      resolved$.next(buffered(1, 0, "first"));

      other.next(buffered(1, 0, "second"));

      expect(emitted[0].cancellation.cancelled).toBe(false);
      expect(second[0].cancellation.cancelled).toBe(false);
    });

    it("stops listening to the transitions and to the tabs when it ends", () => {
      const ended = new Subject<BufferedTransitionReport>();
      const ownEdges$ = new Subject<readonly [number, TabEdge]>();
      const ownRemovals$ = new Subject<number>();
      const own: ResolvedTransitionReport[] = [];
      const subscription = ended
        .pipe(resolvedTransitions({ tabLifecycleChanged$: ownEdges$, tabRemoved$: ownRemovals$ }))
        .subscribe((report) => own.push(report));
      ended.next(buffered(1, 0, "a"));
      expect(ownEdges$.observed).toBe(true);

      subscription.unsubscribe();

      expect(ended.observed).toBe(false);
      expect(ownEdges$.observed).toBe(false);
      expect(ownRemovals$.observed).toBe(false);
    });

    describe("when it ends", () => {
      const ending: [string, (source: Subject<BufferedTransitionReport>) => void][] = [
        ["it is unsubscribed", () => undefined],
        ["the transitions it follows complete", (source) => source.complete()],
        [
          "the transitions it follows fail",
          (source) => source.error(new Error("the buffer failed")),
        ],
      ];

      it.each(ending)("expires every transition it handed on, when %s", (name, end) => {
        const source = new Subject<BufferedTransitionReport>();
        const own: ResolvedTransitionReport[] = [];
        const subscription = source
          .pipe(resolvedTransitions({ tabLifecycleChanged$, tabRemoved$ }))
          .subscribe({ next: (report) => own.push(report), error: () => undefined });
        source.next(buffered(1, 0, "a"));
        source.next(buffered(2, 0, "b"));
        expect(own.map(({ cancellation }) => cancellation.cancelled)).toEqual([false, false]);

        if (name === "it is unsubscribed") {
          subscription.unsubscribe();
        } else {
          end(source);
        }

        expect(own.map(({ cancellation }) => cancellation.cancelled)).toEqual([true, true]);
      });
    });

    it("ends with the transitions it follows", () => {
      const source = new Subject<BufferedTransitionReport>();
      let completed = false;
      source
        .pipe(resolvedTransitions({ tabLifecycleChanged$, tabRemoved$ }))
        .subscribe({ complete: () => (completed = true) });

      source.complete();

      expect(completed).toBe(true);
    });

    it("passes on an error of the transitions it follows", () => {
      const source = new Subject<BufferedTransitionReport>();
      const errors: unknown[] = [];
      source
        .pipe(resolvedTransitions({ tabLifecycleChanged$, tabRemoved$ }))
        .subscribe({ error: (error: unknown) => errors.push(error) });

      source.error(new Error("the buffer failed"));

      expect(errors).toHaveLength(1);
    });
  });
});

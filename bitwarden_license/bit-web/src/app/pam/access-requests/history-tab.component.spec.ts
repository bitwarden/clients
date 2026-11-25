import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTableV2Component,
  DialogService,
  FilterControl,
  ToastService,
} from "@bitwarden/components";

import { HistoryPageService, HistoryPageView } from "./history-page.service";
import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessRequestRow } from "./my-access-row";

const NOW = new Date("2026-08-17T12:00:00.000Z");

/** An ISO time `minutes` before {@link NOW}. */
function ago(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

// Loosely typed, not `Partial<MyAccessRequestRow>`, since `id` is an opaque branded type.
function historyRow(overrides: Record<string, unknown> = {}): MyAccessRequestRow {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    status: "denied",
    badgeState: null,
    statusBadge: null,
    submittedAt: ago(120),
    resolvedAt: ago(30),
    leaseNotBefore: ago(60),
    leaseNotAfter: ago(10),
    resolverLabelKey: null,
    resolverName: null,
    requester: "marcus.chen",
    requesterEmail: "marcus@example.com",
    finalDeny: { name: "derek.finnegan", at: ago(30) },
    approverComment: null,
    producedLeaseId: null,
    producedLeaseStatus: null,
    producedLeaseNotAfter: null,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessRequestRow;
}

/** One row per end state, as the design frame lists them. */
const FRAME_ROWS = [
  historyRow({ id: "stripe", cipherName: "Stripe dashboard", resolvedAt: ago(0) }),
  historyRow({
    id: "okta",
    cipherName: "Okta admin",
    collectionName: "Identity",
    status: "approved",
    producedLeaseId: "lease-okta",
    producedLeaseStatus: "revoked",
    finalDeny: { name: "derek.finnegan", at: ago(60) },
  }),
  historyRow({
    id: "figma",
    cipherName: "Figma org",
    collectionName: "Design",
    status: "canceled",
    resolvedAt: ago(180),
    finalDeny: null,
  }),
  historyRow({
    id: "pagerduty",
    cipherName: "PagerDuty",
    collectionName: "Identity",
    status: "expired",
    resolvedAt: null,
    leaseNotAfter: ago(24 * 60),
    finalDeny: null,
  }),
  historyRow({
    id: "datadog",
    cipherName: "Datadog org owner",
    requester: "sam.okafor",
    status: "approved",
    producedLeaseId: "lease-datadog",
    producedLeaseStatus: "expired",
    producedLeaseNotAfter: ago(2 * 24 * 60),
    finalDeny: null,
  }),
  historyRow({
    id: "servicenow",
    cipherName: "Service Now",
    requester: "sam.okafor",
    status: "approved",
    producedLeaseId: "lease-servicenow",
    producedLeaseStatus: "canceled",
    finalDeny: { name: "sam.okafor", at: ago(7 * 24 * 60) },
  }),
];

const DESIGN_ID = "11111111-1111-4111-8111-1111111111c1";
const IDENTITY_ID = "11111111-1111-4111-8111-1111111111c2";
const MARCUS_ID = "11111111-1111-4111-8111-1111111111a1";
const SAM_ID = "11111111-1111-4111-8111-1111111111a2";

function pageOf(
  rows: MyAccessRequestRow[],
  overrides: Partial<HistoryPageView> = {},
): HistoryPageView {
  return {
    rows,
    total: rows.length,
    requesterOptions: [
      { value: MARCUS_ID, label: "marcus.chen" },
      { value: SAM_ID, label: "sam.okafor" },
    ],
    collectionOptions: [
      { value: DESIGN_ID, label: "Design" },
      { value: IDENTITY_ID, label: "Identity" },
    ],
    cipherById: new Map<string, CipherView>(),
    ...overrides,
  };
}

describe("HistoryTabComponent", () => {
  let fixture: ComponentFixture<HistoryTabComponent>;
  let page$: BehaviorSubject<HistoryPageView | null>;
  let loading$: BehaviorSubject<boolean>;
  let loadError$: BehaviorSubject<unknown | null>;
  let setQuery: jest.Mock;
  let showToast: jest.Mock;

  function create(): void {
    fixture = TestBed.createComponent(HistoryTabComponent);
    fixture.detectChanges();
  }

  /** Settles a page read: the latest page lands and the load ends. */
  function land(page: HistoryPageView | null): void {
    page$.next(page);
    loading$.next(false);
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function queryAll(selector: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector));
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function cell(column: string, id: string): HTMLElement | null {
    return query(`[data-testid="my-access-history-${column}-${id}"]`);
  }

  function headers(): HTMLElement[] {
    return queryAll('[data-testid="history-table"] [role="columnheader"]');
  }

  /** The row ids in display order, read off the Item cells. */
  function rowIds(): string[] {
    return queryAll('[data-testid="history-table"] [data-testid^="my-access-history-"]')
      .map((element) => element.getAttribute("data-testid") ?? "")
      .filter((testId) =>
        /^my-access-history-(?!status-|requester-|resolver-|resolved-|no-results|empty)/.test(
          testId,
        ),
      )
      .map((testId) => testId.replace("my-access-history-", ""));
  }

  function table(): BitTableV2Component {
    return fixture.debugElement.query(By.directive(BitTableV2Component))
      .componentInstance as BitTableV2Component;
  }

  function filterControl(key: string): FilterControl {
    const control = table()
      .filterControls()
      .find((c) => c.key() === key);
    if (control == null) {
      throw new Error(`the ${key} control did not register`);
    }
    return control;
  }

  function setFilter(key: string, value: unknown): void {
    filterControl(key).setValue(value);
    fixture.detectChanges();
  }

  function lastQuery() {
    return setQuery.mock.calls[setQuery.mock.calls.length - 1][0];
  }

  function tick(ms: number): void {
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  function passSkeletonDelay(): void {
    tick(1000);
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    page$ = new BehaviorSubject<HistoryPageView | null>(null);
    loading$ = new BehaviorSubject(true);
    loadError$ = new BehaviorSubject<unknown | null>(null);
    setQuery = jest.fn();
    showToast = jest.fn();

    await TestBed.configureTestingModule({
      imports: [HistoryTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: ToastService, useValue: { showToast } },
        { provide: DialogService, useValue: { open: jest.fn() } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          // Echoes the key plus params, since I18nMockService throws on any key not given.
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((a) => a != null)].join(" "),
          },
        },
      ],
    })
      // Stubs the vault favicon component, which pulls in environment/settings services this test
      // has no interest in. The page service is the tab's own provider, so it is replaced there.
      .overrideComponent(HistoryTabComponent, {
        add: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [
            {
              provide: HistoryPageService,
              useValue: { page$, loading$, loadError$, setQuery },
            },
          ],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  describe("table", () => {
    beforeEach(() => {
      create();
      land(pageOf(FRAME_ROWS));
    });

    it("shows Item, Status, Requester, Resolved by and Resolved, with no Action column", () => {
      expect(headers().map(text)).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamInboxRequester",
        "pamColumnResolvedBy",
        "pamColumnResolved",
      ]);
    });

    it("sorts on no column, since the server orders the rows newest request first", () => {
      expect(headers().filter((header) => header.querySelector("button") != null)).toEqual([]);
    });

    it("lists the rows in the server's order", () => {
      land(pageOf([...FRAME_ROWS].reverse()));

      expect(rowIds()).toEqual(["servicenow", "datadog", "pagerduty", "figma", "okta", "stripe"]);
    });

    it("shows each end state as plain text with who resolved it", () => {
      expect(
        rowIds().map((id) => [id, text(cell("status", id)), text(cell("resolver", id))]),
      ).toEqual([
        ["stripe", "pamStatusDenied", "derek.finnegan"],
        ["okta", "pamStatusRevoked", "derek.finnegan"],
        ["figma", "pamStatusCanceled", "marcus.chen"],
        ["pagerduty", "pamStatusExpired", "system"],
        ["datadog", "pamStatusSessionEnded", "system"],
        ["servicenow", "pamStatusSessionEnded", "sam.okafor"],
      ]);
      expect(
        cell("status", "stripe")?.querySelector("[bitBadge], app-pam-access-state-badge"),
      ).toBeNull();
    });

    it("shows the requester's username only, without their email", () => {
      expect(text(cell("requester", "stripe"))).toBe("marcus.chen");
    });

    it("shows when each request ended relative to now", () => {
      expect(rowIds().map((id) => text(cell("resolved", id)).split(",")[0])).toEqual([
        "pamInboxElapsedJustNow 0",
        "pamInboxElapsedHours 1",
        "pamInboxElapsedHours 3",
        "pamInboxElapsedDays 1",
        "pamInboxElapsedDays 2",
        "pamInboxElapsedWeeks 1",
      ]);
    });

    it("gives the exact time to a pointer and to assistive tech", () => {
      const time = cell("resolved", "figma")!.querySelector("time")!;

      expect(time.getAttribute("datetime")).toBe(ago(180));
      expect(time.querySelector(".tw-sr-only")?.textContent).toContain("2026");
    });

    it("marks the item as organization-owned beside its name, then names its folder", () => {
      const item = query('[data-testid="my-access-history-okta"]')!;
      const icon = item.querySelector('bit-icon[name="bwi-business"]');

      expect(icon).not.toBeNull();
      expect(icon?.previousElementSibling?.textContent?.trim()).toBe("Okta admin");
      expect(text(item)).toContain("pamInboxInSharedFolder Identity");
    });

    it("links each item to its request", () => {
      const link = query('[data-testid="my-access-history-okta"] a')!;

      expect(link.getAttribute("href")).toBe("/pam/requests/okta");
      expect(link.id).toBe("pam-history-tab_link_item-okta");
    });

    it("is read-only: no row carries an action", () => {
      expect(queryAll('[data-testid="history-table"] bit-cell button')).toEqual([]);
    });
  });

  describe("paging and filters", () => {
    beforeEach(() => {
      create();
      land(pageOf(FRAME_ROWS, { total: 53 }));
    });

    it("asks for the first page of ten, unfiltered", () => {
      expect(lastQuery()).toEqual({
        page: 0,
        pageSize: 10,
        statuses: [],
        collectionIds: [],
        requesterIds: [],
      });
    });

    it("pages over the server's total", () => {
      expect(query('[data-testid="history-paginator"]')).not.toBeNull();

      fixture.componentInstance["pageIndex"].set(3);
      fixture.detectChanges();

      expect(lastQuery()).toMatchObject({ page: 3, pageSize: 10 });
    });

    it("counts the rows on screen out of the server's total", () => {
      expect(text(query("bit-table-toolbar"))).toContain("pamHistoryRangeOfTotal 1 10 53");
    });

    it("offers Status, Shared folders and Requester filters, and no search", () => {
      expect(
        table()
          .filterControls()
          .map((control) => control.key()),
      ).toEqual(["status", "collection", "requester"]);
      expect(query("bit-search")).toBeNull();
    });

    it("sends the SDK's status names and the chosen ids, from the first page", () => {
      fixture.componentInstance["pageIndex"].set(2);
      fixture.detectChanges();

      setFilter("status", ["sessionEnded", "denied"]);
      setFilter("collection", [IDENTITY_ID]);
      setFilter("requester", [SAM_ID]);

      expect(lastQuery()).toEqual({
        page: 0,
        pageSize: 10,
        statuses: ["session_ended", "denied"],
        collectionIds: [IDENTITY_ID],
        requesterIds: [SAM_ID],
      });
    });

    it("moves back to the last page when the history shrinks under the reader", () => {
      fixture.componentInstance["pageIndex"].set(5);
      fixture.detectChanges();

      land(pageOf([], { total: 23 }));

      expect(lastQuery()).toMatchObject({ page: 2 });
    });

    it("shows the table's loading rows while a new page is read", () => {
      loading$.next(true);
      fixture.detectChanges();

      expect(rowIds()).toEqual([]);
      expect(queryAll('[data-testid="history-table"] bit-skeleton-text').length).toBeGreaterThan(0);
    });
  });

  describe("empty state", () => {
    it("replaces the table and its toolbar when nothing has ended yet", () => {
      create();
      land(pageOf([]));

      expect(query('[data-testid="my-access-history-empty"]')).not.toBeNull();
      expect(query("bit-table-toolbar")).toBeNull();
    });

    it("keeps the table when a filter matches nothing, so it can be cleared", () => {
      create();
      land(pageOf(FRAME_ROWS));

      setFilter("status", ["revoked"]);
      land(pageOf([]));

      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();
      expect(query('[data-testid="my-access-history-no-results"]')).not.toBeNull();
    });
  });

  describe("loading", () => {
    it("shows the skeleton once the load has run for a second, then the history", () => {
      create();

      expect(query('[data-testid="history-loading"]')).toBeNull();

      passSkeletonDelay();

      const skeleton = query('[data-testid="history-loading"]');
      expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton?.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);

      land(pageOf([historyRow({ id: "managed-1" })]));

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
    });

    it("never shows the skeleton when the history arrives inside a second", () => {
      create();
      tick(500);

      land(pageOf([historyRow({ id: "mine-1" })]));
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
      expect(text(query('[data-testid="history-loading-status"]'))).toBe("");
    });

    // A live region must exist before its text changes, or assistive tech announces nothing.
    it("keeps one live region mounted, announces both halves of the load, then clears", () => {
      create();

      const status = query('[data-testid="history-loading-status"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.getAttribute("aria-live")).toBe("polite");
      expect(text(status)).toBe("");

      passSkeletonDelay();

      expect(text(status)).toBe("loading");

      land(pageOf([historyRow({ id: "managed-1" })]));

      expect(query('[data-testid="history-loading-status"]')).toBe(status);
      expect(text(status)).toBe("pamHistoryLoaded");

      tick(2000);

      expect(text(status)).toBe("");
    });

    it("toasts a failed read and keeps the table rather than claim there is no history", () => {
      create();

      loadError$.next(new Error("boom"));
      land(null);

      expect(showToast).toHaveBeenCalledWith({ variant: "error", message: "pamHistoryLoadFailed" });
      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();
      expect(query('[data-testid="history-table"]')).not.toBeNull();
    });

    // The latch resolves on the loading flag alone; a failed read ends the skeleton same as success.
    it("does not announce a failed load as loaded", () => {
      create();
      passSkeletonDelay();

      loadError$.next(new Error("boom"));
      land(null);

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(text(query('[data-testid="history-loading-status"]'))).toBe("");
    });
  });
});

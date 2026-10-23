import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTableV2Component,
  DialogService,
  FilterControl,
  ToastService,
} from "@bitwarden/components";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

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

describe("HistoryTabComponent", () => {
  let fixture: ComponentFixture<HistoryTabComponent>;
  let component: HistoryTabComponent;
  let myRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedRows$: BehaviorSubject<MyAccessRequestRow[]>;
  let managedLoading$: BehaviorSubject<boolean>;
  let managedLoadError$: BehaviorSubject<unknown | null>;
  let myLoading$: BehaviorSubject<boolean>;
  let myLoadError$: BehaviorSubject<unknown | null>;
  let lastSync$: BehaviorSubject<Date | null>;
  let canApprove$: BehaviorSubject<boolean>;

  function create(): void {
    fixture = TestBed.createComponent(HistoryTabComponent);
    component = fixture.componentInstance;
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

  function clickSortHeader(heading: string): void {
    const header = headers().find((candidate) => text(candidate) === heading)!;
    header.querySelector("button")!.click();
    fixture.detectChanges();
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
    myRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedRows$ = new BehaviorSubject<MyAccessRequestRow[]>([]);
    managedLoading$ = new BehaviorSubject(false);
    managedLoadError$ = new BehaviorSubject<unknown | null>(null);
    myLoading$ = new BehaviorSubject(false);
    myLoadError$ = new BehaviorSubject<unknown | null>(null);
    lastSync$ = new BehaviorSubject<Date | null>(new Date("2026-08-17T09:00:00.000Z"));
    canApprove$ = new BehaviorSubject(false);

    await TestBed.configureTestingModule({
      imports: [HistoryTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            historyRows$: myRows$,
            cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
            loading$: myLoading$,
            loadError$: myLoadError$,
          },
        },
        {
          provide: ApproverInboxService,
          useValue: {
            historyRows$: managedRows$,
            cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
            loading$: managedLoading$,
            loadError$: managedLoadError$,
          },
        },
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        { provide: SyncService, useValue: { activeUserLastSync$: () => lastSync$ } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
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
      // has no interest in.
      .overrideComponent(HistoryTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  describe("table", () => {
    beforeEach(() => {
      myRows$.next(FRAME_ROWS);
      create();
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

    it("sorts on Item, Status and Resolved only", () => {
      expect(
        headers()
          .filter((header) => header.querySelector("button") != null)
          .map(text),
      ).toEqual(["pamColumnItem", "pamColumnStatus", "pamColumnResolved"]);
    });

    it("lists the newest resolution first", () => {
      expect(rowIds()).toEqual(["stripe", "okta", "figma", "pagerduty", "datadog", "servicenow"]);
    });

    it("reverses the Resolved sort by timestamp, not by its relative text", () => {
      clickSortHeader("pamColumnResolved");

      expect(rowIds()).toEqual(["servicenow", "datadog", "pagerduty", "figma", "okta", "stripe"]);
    });

    it("sorts Status by the label it shows", () => {
      clickSortHeader("pamColumnStatus");

      expect(rowIds().map((id) => text(cell("status", id)))).toEqual([
        "pamStatusCanceled",
        "pamStatusDenied",
        "pamStatusExpired",
        "pamStatusRevoked",
        "pamStatusSessionEnded",
        "pamStatusSessionEnded",
      ]);
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
      expect(text(item)).toContain("pamInboxInCollection Identity");
      expect(item.querySelector('bit-icon[name="bwi-collection-shared"]')).toBeNull();
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

  describe("rows", () => {
    it("merges both reads, listing a request they both return once", () => {
      canApprove$.next(true);
      myRows$.next([historyRow({ id: "shared" }), historyRow({ id: "mine", resolvedAt: ago(40) })]);
      managedRows$.next([
        historyRow({ id: "shared" }),
        historyRow({ id: "managed", resolvedAt: ago(50) }),
      ]);

      create();

      expect(rowIds()).toEqual(["shared", "mine", "managed"]);
    });

    it("leaves out requests still pending, waiting to start, or running", () => {
      canApprove$.next(true);
      managedRows$.next([
        historyRow({ id: "denied" }),
        historyRow({ id: "pending", status: "pending", resolvedAt: null }),
        historyRow({ id: "waiting", status: "approved", leaseNotAfter: ago(-60) }),
        historyRow({
          id: "running",
          status: "approved",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          producedLeaseNotAfter: ago(-60),
        }),
      ]);

      create();

      expect(rowIds()).toEqual(["denied"]);
    });

    it("brings in a lease that runs out while the tab is open", () => {
      canApprove$.next(true);
      managedRows$.next([
        historyRow({ id: "denied" }),
        historyRow({
          id: "running",
          status: "approved",
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          producedLeaseNotAfter: ago(-1),
          finalDeny: null,
        }),
      ]);
      create();

      expect(rowIds()).toEqual(["denied"]);

      tick(2 * 60_000);

      expect(rowIds()).toEqual(["running", "denied"]);
      expect(text(cell("status", "running"))).toBe("pamStatusSessionEnded");
      expect(text(cell("resolver", "running"))).toBe("system");
    });

    it("puts a newly ended request at the top", () => {
      myRows$.next([historyRow({ id: "older", resolvedAt: ago(60) })]);
      create();

      myRows$.next([
        historyRow({ id: "older", resolvedAt: ago(60) }),
        historyRow({ id: "new", resolvedAt: ago(0) }),
      ]);
      fixture.detectChanges();

      expect(rowIds()).toEqual(["new", "older"]);
    });
  });

  describe("toolbar", () => {
    function optionLabels(key: string): string[] {
      const menu = query(`bit-filter-menu[key="${key}"]`)!;
      return Array.from(menu.querySelectorAll("bit-filter-option")).map(text);
    }

    function searchFor(term: string): void {
      setFilter("search", term);
    }

    beforeEach(() => {
      myRows$.next(FRAME_ROWS);
      create();
    });

    it("offers search and multi-select Status, Shared folders and Requester filters", () => {
      expect(query("bit-table-toolbar bit-search")?.id).toBe("pam-history-tab_input_search");
      expect(
        queryAll("bit-table-toolbar bit-filter-menu").map((menu) => [
          menu.getAttribute("key"),
          menu.hasAttribute("multiple"),
        ]),
      ).toEqual([
        ["status", true],
        ["collection", true],
        ["requester", true],
      ]);
    });

    it("lists every end state under Status, without icons", () => {
      expect(optionLabels("status")).toEqual([
        "pamStatusDenied",
        "pamStatusRevoked",
        "pamStatusCanceled",
        "pamStatusExpired",
        "pamStatusSessionEnded",
      ]);
      expect(component["statusOptions"].some((option) => "iconTile" in option)).toBe(false);
    });

    it("lists each shared folder and requester once", () => {
      expect(optionLabels("collection")).toEqual(["Design", "Identity", "Production"]);
      expect(optionLabels("requester")).toEqual(["marcus.chen", "sam.okafor"]);
    });

    it("counts each option's rows", () => {
      expect(table().optionCount("status", ["sessionEnded"])).toBe(2);
      expect(table().optionCount("status", ["denied"])).toBe(1);
      expect(table().optionCount("collection", ["Identity"])).toBe(2);
      expect(table().optionCount("requester", ["sam.okafor"])).toBe(2);
    });

    it("matches any selected option within a filter", () => {
      setFilter("status", ["denied", "revoked"]);

      expect(rowIds()).toEqual(["stripe", "okta"]);
    });

    it("matches every filter across them", () => {
      setFilter("status", ["sessionEnded", "expired"]);
      setFilter("requester", ["sam.okafor"]);

      expect(rowIds()).toEqual(["datadog", "servicenow"]);

      setFilter("collection", ["Identity"]);

      expect(rowIds()).toEqual([]);
    });

    it("counts the items left on screen", () => {
      const count = () => text(query("bit-table-toolbar [bitOverflowTrigger]"));

      expect(count()).toBe("itemCount 6");

      setFilter("collection", ["Identity"]);

      expect(count()).toBe("itemCount 2");
    });

    it("searches the item, folder, requester, resolver and status", () => {
      searchFor("figma");
      expect(rowIds()).toEqual(["figma"]);

      searchFor("design");
      expect(rowIds()).toEqual(["figma"]);

      searchFor("derek");
      expect(rowIds()).toEqual(["stripe", "okta"]);

      searchFor("system");
      expect(rowIds()).toEqual(["pagerduty", "datadog"]);

      searchFor("revoked");
      expect(rowIds()).toEqual(["okta"]);
    });

    it("ignores case and surrounding whitespace", () => {
      searchFor("  OKTA  ");

      expect(rowIds()).toEqual(["okta"]);
    });

    it("says nothing matched rather than that the history is empty", () => {
      searchFor("no-such-thing");

      expect(rowIds()).toEqual([]);
      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();
      expect(text(query('[data-testid="my-access-history-no-results"]'))).toContain(
        "noMatchingItems",
      );
    });
  });

  describe("empty state", () => {
    it("replaces the table and its toolbar when nothing has ended yet", () => {
      myRows$.next([historyRow({ id: "pending", status: "pending", resolvedAt: null })]);

      create();

      expect(query('[data-testid="my-access-history-empty"]')).not.toBeNull();
      expect(query("bit-table-toolbar")).toBeNull();
    });
  });

  describe("loading", () => {
    it("shows the skeleton once the load has run for a second, then the history", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="history-loading"]')).toBeNull();

      passSkeletonDelay();

      const skeleton = query('[data-testid="history-loading"]');
      expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton?.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-managed-1"]')).not.toBeNull();
    });

    it("never shows the skeleton when the history arrives inside a second", () => {
      canApprove$.next(true);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();
      tick(500);

      managedLoading$.next(false);
      passSkeletonDelay();

      expect(query("bit-skeleton")).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
      expect(text(query('[data-testid="history-loading-status"]'))).toBe("");
    });

    // A live region must exist before its text changes, or assistive tech announces nothing.
    it("keeps one live region mounted, announces both halves of the load, then clears", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();

      const status = query('[data-testid="history-loading-status"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.getAttribute("aria-live")).toBe("polite");
      expect(text(status)).toBe("");

      passSkeletonDelay();

      expect(text(status)).toBe("loading");

      managedRows$.next([historyRow({ id: "managed-1" })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading-status"]')).toBe(status);
      expect(text(status)).toBe("pamHistoryLoaded");

      tick(2000);

      expect(text(status)).toBe("");
    });

    // The latch resolves on loading flags alone; a failed read ends the skeleton same as success.
    it("does not announce a failed load as loaded", () => {
      canApprove$.next(true);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      managedLoadError$.next(new Error("boom"));
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(text(query('[data-testid="history-loading-status"]'))).toBe("");
    });

    it("does not announce a failed own-history load as loaded", () => {
      myLoading$.next(true);

      create();
      passSkeletonDelay();

      myLoadError$.next(new Error("boom"));
      myLoading$.next(false);
      fixture.detectChanges();

      expect(text(query('[data-testid="history-loading-status"]'))).toBe("");
    });

    // The latch never resolves for a non-approver on an unsynced session.
    it("drops its load-latch subscription when the tab is destroyed", () => {
      lastSync$.next(null);
      managedLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(component["historyLoaded"]()).toBe(false);
      expect(canApprove$.observed).toBe(true);

      fixture.destroy();

      expect(canApprove$.observed).toBe(false);
    });

    // The shell never loads the inbox for a member who can't approve.
    it("does not wait on the inbox for a member who cannot approve", () => {
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();

      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });

    // `canApprove$` answers false for a genuine approver before the first sync lands.
    it("waits for the first sync before reading a false approval privilege as settled", () => {
      lastSync$.next(null);
      managedLoading$.next(true);
      myRows$.next([historyRow({ id: "mine-1" })]);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).not.toBeNull();

      canApprove$.next(true);
      lastSync$.next(new Date("2026-08-17T09:05:00.000Z"));
      managedRows$.next([historyRow({ id: "managed-1", resolvedAt: ago(5) })]);
      managedLoading$.next(false);
      fixture.detectChanges();

      expect(rowIds()).toEqual(["managed-1", "mine-1"]);
    });

    it("waits on the caller's own history too, so its empty state cannot flash", () => {
      myLoading$.next(true);

      create();
      passSkeletonDelay();

      expect(query('[data-testid="my-access-history-empty"]')).toBeNull();

      myRows$.next([historyRow({ id: "mine-1" })]);
      myLoading$.next(false);
      fixture.detectChanges();

      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });

    it("does not replace rows already on screen with a skeleton when a reload starts", () => {
      myRows$.next([historyRow({ id: "mine-1" })]);
      create();

      myLoading$.next(true);
      passSkeletonDelay();

      expect(query('[data-testid="history-loading"]')).toBeNull();
      expect(query('[data-testid="my-access-history-mine-1"]')).not.toBeNull();
    });
  });
});

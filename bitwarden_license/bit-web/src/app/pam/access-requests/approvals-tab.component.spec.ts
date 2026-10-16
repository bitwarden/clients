import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTableV2Component,
  DialogService,
  FilterControl,
  ToastService,
} from "@bitwarden/components";

import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  ApproverRow,
  fromApprovalRow,
  fromManagedLease,
  fromUnstartedApproval,
} from "../approvals/approver-row";
import { toManagedLeaseRow } from "../approvals/managed-lease-row";

import { emptyResolvedNames } from "./access-name-resolver.service";
import { ApprovalsTabComponent } from "./approvals-tab.component";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const MINUTE = 60_000;

const NAMES = {
  ...emptyResolvedNames(),
  cipherNameById: new Map([
    ["cipher-1", "Prod database"],
    ["cipher-2", "Billing API"],
  ]),
  collectionNameById: new Map([
    ["col-1", "Production"],
    ["col-2", "Staging"],
  ]),
  organizationNameById: new Map([["org-1", "Meridian Group"]]),
};

function accessRequest(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "prod incident",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;
}

function pending(overrides: Record<string, unknown> = {}, canDecide = true): ApproverRow {
  return fromApprovalRow(
    toApprovalRow(accessRequest(overrides), NAMES, NOW, canDecide, "en-US"),
    NOW,
  );
}

function ready(overrides: Record<string, unknown> = {}): ApproverRow {
  return fromUnstartedApproval(
    accessRequest({
      status: "approved",
      leaseNotBefore: "2026-08-18T09:00:00.000Z",
      leaseNotAfter: "2026-08-18T13:00:00.000Z",
      ...overrides,
    }),
    NAMES,
    NOW,
    "en-US",
  );
}

function active(overrides: Record<string, unknown> = {}): ApproverRow {
  const lease = toManagedLeaseRow(
    accessRequest({
      status: "approved",
      producedLeaseId: "lease-1",
      producedLeaseStatus: "active",
      leaseNotBefore: "2026-08-17T11:00:00.000Z",
      leaseNotAfter: "2026-08-17T14:00:00.000Z",
      ...overrides,
    }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
    NAMES,
  );
  return fromManagedLease(lease, NOW, "en-US");
}

describe("ApprovalsTabComponent", () => {
  let fixture: ComponentFixture<ApprovalsTabComponent>;
  let inbox: {
    approverRows$: BehaviorSubject<ApproverRow[]>;
    cipherById$: BehaviorSubject<Map<string, CipherView>>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
    decide: jest.Mock;
    revokeLease: jest.Mock;
    cancelApproval: jest.Mock;
  };
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let viewportWidth: number;
  let mediaListeners: Array<() => void>;

  function matchesWidth(query: string): boolean {
    return viewportWidth >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
  }

  /** jsdom has no `matchMedia`; this answers `min-width` queries against `viewportWidth`. */
  function stubMatchMedia(): void {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: matchesWidth(query),
        media: query,
        addEventListener: jest.fn((_type: string, listener: (event: unknown) => void) =>
          mediaListeners.push(() => listener({ matches: matchesWidth(query), media: query })),
        ),
        removeEventListener: jest.fn(),
        // The CDK's high-contrast detector still uses the deprecated listener API.
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    });
  }

  function create(): void {
    fixture = TestBed.createComponent(ApprovalsTabComponent);
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

  function headings(): string[] {
    return queryAll('[data-testid="approvals-table"] [role="columnheader"]').map(text);
  }

  /** The row ids in display order, read off the Item cells. */
  function rowOrder(): string[] {
    return queryAll('[data-testid^="approvals-cell-item-"]').map((cell) =>
      (cell.getAttribute("data-testid") ?? "").replace("approvals-cell-item-", ""),
    );
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

  /** Lets a clicked action's confirm and mutation run; `whenStable` never settles under the ticker. */
  async function settle(): Promise<void> {
    await jest.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function tick(ms: number): void {
    jest.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    viewportWidth = 1440;
    mediaListeners = [];
    stubMatchMedia();

    inbox = {
      approverRows$: new BehaviorSubject<ApproverRow[]>([]),
      cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
      loading$: new BehaviorSubject<boolean>(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
      decide: jest.fn().mockResolvedValue(undefined),
      revokeLease: jest.fn().mockResolvedValue(undefined),
      cancelApproval: jest.fn().mockResolvedValue(undefined),
    };
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [ApprovalsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApproverInboxService, useValue: inbox },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
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
      .overrideComponent(ApprovalsTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    delete (window as { matchMedia?: unknown }).matchMedia;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("loading", () => {
    it("shows a skeleton table, hidden from assistive tech, once loading has run for a second", () => {
      inbox.loading$.next(true);

      create();

      const status = query('[data-testid="approvals-loading-status"]');
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.textContent?.trim()).toBe("");
      expect(query("bit-skeleton")).toBeNull();

      tick(1000);

      const skeleton = query('[data-testid="approvals-loading"]');
      expect(skeleton?.querySelector("bit-table-v2")?.getAttribute("aria-hidden")).toBe("true");
      expect(skeleton?.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
      expect(status?.textContent).toContain("loading");
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });

    it("never shows the skeleton when the rows arrive inside a second", () => {
      inbox.loading$.next(true);
      create();

      inbox.approverRows$.next([pending()]);
      inbox.loading$.next(false);
      tick(1000);

      expect(query('[data-testid="approvals-loading"]')).toBeNull();
      expect(rowOrder()).toEqual(["req-1"]);
    });

    it("announces the rows once a shown skeleton clears", () => {
      inbox.loading$.next(true);
      create();
      tick(1000);

      inbox.approverRows$.next([pending()]);
      inbox.loading$.next(false);
      tick(1000);

      expect(text(query('[data-testid="approvals-loading-status"]'))).toBe("pamApprovalsLoaded");
    });

    it("does not announce a load that failed as loaded", () => {
      inbox.loading$.next(true);
      create();
      tick(1000);

      inbox.loadError$.next(new Error("boom"));
      inbox.loading$.next(false);
      tick(1000);

      expect(text(query('[data-testid="approvals-loading-status"]'))).toBe("");
    });
  });

  describe("table", () => {
    it("shows the empty state when there is nothing to act on", () => {
      create();

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
      expect(query('[data-testid="approvals-table"]')).toBeNull();
    });

    it("renders the five columns in order, with no reason column", () => {
      inbox.approverRows$.next([pending()]);

      create();

      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamInboxRequester",
        "pamColumnRequestedWindow",
        "pamColumnActions",
      ]);
    });

    it("drops the window below lg, leaving the detail dialog to carry it", () => {
      inbox.approverRows$.next([pending()]);
      viewportWidth = 800;

      create();

      expect(headings()).toEqual([
        "pamColumnItem",
        "pamColumnStatus",
        "pamInboxRequester",
        "pamColumnActions",
      ]);

      viewportWidth = 1100;
      mediaListeners.forEach((notify) => notify());
      fixture.detectChanges();

      expect(headings()).toContain("pamColumnRequestedWindow");
    });

    it("renders one row per request, in every stage", () => {
      inbox.approverRows$.next([
        pending({ id: "req-p" }),
        ready({ id: "req-r" }),
        active({ id: "req-a" }),
      ]);

      create();

      expect(rowOrder()).toEqual(["req-p", "req-r", "req-a"]);
    });

    it("badges each row with its stage", () => {
      inbox.approverRows$.next([
        pending({ id: "req-p" }),
        ready({ id: "req-r" }),
        active({ id: "req-a" }),
      ]);

      create();

      const badge = (id: string) =>
        query(`[data-testid="approvals-cell-status-${id}"] [data-testid^="access-state-badge-"]`);
      expect(badge("req-p")?.getAttribute("data-testid")).toBe("access-state-badge-pending");
      expect(badge("req-r")?.getAttribute("data-testid")).toBe("access-state-badge-ready");
      expect(badge("req-a")?.getAttribute("data-testid")).toBe("access-state-badge-active");
    });

    it("shows the item, its shared folder, and links it to the request's detail dialog", () => {
      inbox.approverRows$.next([pending()]);

      create();

      const item = query('[data-testid="approvals-cell-item-req-1"]');
      expect(text(item)).toContain("Prod database");
      expect(text(item)).toContain("pamInboxInCollection Production");
      expect(item?.querySelector('bit-icon[name="bwi-collection-shared"]')).not.toBeNull();
      expect(item?.querySelector("a")?.getAttribute("href")).toBe("/pam/requests/req-1");
    });

    it("shows the duration over the window, with the exact window on title", () => {
      inbox.approverRows$.next([ready()]);

      create();

      const cell = query('[data-testid="approvals-cell-window-req-1"]');
      expect(text(cell)).toContain("pamInboxDurationHours 4");
      expect(text(cell)).toMatch(/pamWindow\w+/);
      expect(cell?.querySelector("[title]")?.getAttribute("title")).toContain("–");
    });

    it("re-sorts by status when its header is clicked", () => {
      inbox.approverRows$.next([
        active({ id: "req-a" }),
        pending({ id: "req-p" }),
        ready({ id: "req-r" }),
      ]);
      create();

      const statusHeader = queryAll('[role="columnheader"]').find(
        (header) => text(header) === "pamColumnStatus",
      );
      statusHeader?.querySelector("button")?.click();
      fixture.detectChanges();

      expect(rowOrder()).toEqual(["req-p", "req-r", "req-a"]);
    });
  });

  describe("row actions", () => {
    it("offers a solid green approve and a solid red deny, with tooltips, only on a pending request", () => {
      inbox.approverRows$.next([pending()]);

      create();

      const approve = query('[data-testid="approvals-approve-req-1"]');
      const deny = query('[data-testid="approvals-deny-req-1"]');
      expect(approve?.getAttribute("aria-label")).toBe("pamApprovalsApproveRequest");
      expect(deny?.getAttribute("aria-label")).toBe("pamApprovalsDenyRequest");
      expect(approve?.querySelector(".bwi-check-circle")).not.toBeNull();
      expect(approve?.className).toContain("tw-bg-bg-success");
      expect(deny?.querySelector(".bwi-clear")).not.toBeNull();
      expect(deny?.className).toContain("tw-bg-bg-danger");
      expect(query('[data-testid="approvals-revoke-req-1"]')).toBeNull();
    });

    it.each([
      ["ready", ready],
      ["active", active],
    ])("offers only revoke on a %s row", (_kind, build) => {
      inbox.approverRows$.next([build()]);

      create();

      expect(query('[data-testid="approvals-revoke-req-1"]')?.getAttribute("aria-label")).toBe(
        "pamApprovalsRevokeAccess",
      );
      expect(query('[data-testid="approvals-revoke-req-1"]')?.className).toContain(
        "tw-bg-bg-danger",
      );
      expect(query('[data-testid="approvals-approve-req-1"]')).toBeNull();
      expect(query('[data-testid="approvals-deny-req-1"]')).toBeNull();
    });

    it("reveals the actions only on row hover or keyboard focus", () => {
      inbox.approverRows$.next([pending()]);

      create();

      const strip = query('[data-testid="approvals-approve-req-1"]')?.parentElement;
      expect(strip?.className).toContain("tw-opacity-0");
      expect(strip?.className).toContain("group-hover/row:tw-opacity-100");
      expect(strip?.className).toContain("group-has-[:focus-visible]/row:tw-opacity-100");
    });

    it("disables both decisions on the caller's own request, saying why", () => {
      inbox.approverRows$.next([pending({}, false)]);

      create();

      expect(query('[data-testid="approvals-approve-req-1"]')?.getAttribute("aria-label")).toBe(
        "pamInboxCannotApproveOwn",
      );
      // aria-disabled rather than disabled, so the buttons stay hoverable for their tooltips.
      expect(query('[data-testid="approvals-approve-req-1"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
      expect(query('[data-testid="approvals-deny-req-1"]')?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    });

    it.each(["approve", "deny"] as const)(
      "records a %s through the decide dialog, with the verdict it closed on",
      async (verdict) => {
        dialogService.open.mockReturnValue({
          closed: of({ confirmed: true, verdict, comment: "ok" }),
        } as never);
        inbox.approverRows$.next([pending()]);
        create();

        query(`[data-testid="approvals-${verdict}-req-1"]`)?.click();
        await settle();

        expect(dialogService.open).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ data: expect.objectContaining({ verdict }) }),
        );
        expect(inbox.decide).toHaveBeenCalledWith("req-1", verdict, "ok");
        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "success" }),
        );
      },
    );

    it("records nothing when the decide dialog is dismissed", async () => {
      dialogService.open.mockReturnValue({ closed: of(undefined) } as never);
      inbox.approverRows$.next([pending()]);
      create();

      query('[data-testid="approvals-approve-req-1"]')?.click();
      await settle();

      expect(inbox.decide).not.toHaveBeenCalled();
    });

    it("withdraws an approval not yet started, once confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.approverRows$.next([ready()]);
      create();

      query('[data-testid="approvals-revoke-req-1"]')?.click();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "pamInboxWithdrawApproval" } }),
      );
      expect(inbox.cancelApproval).toHaveBeenCalledWith("req-1");
      expect(inbox.revokeLease).not.toHaveBeenCalled();
    });

    it("ends a running lease, once confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      inbox.approverRows$.next([active()]);
      create();

      query('[data-testid="approvals-revoke-req-1"]')?.click();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "pamInboxRevoke" } }),
      );
      expect(inbox.revokeLease).toHaveBeenCalledWith("req-1", "lease-1");
      expect(inbox.cancelApproval).not.toHaveBeenCalled();
    });

    it("does nothing when the revoke confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      inbox.approverRows$.next([active()]);
      create();

      query('[data-testid="approvals-revoke-req-1"]')?.click();
      await settle();

      expect(inbox.revokeLease).not.toHaveBeenCalled();
    });
  });

  describe("row lifecycle", () => {
    it("drops a lease once its window closes, with no server push", () => {
      inbox.approverRows$.next([
        pending({ id: "req-p" }),
        active({ id: "req-a", leaseNotAfter: new Date(NOW.getTime() + 2000).toISOString() }),
      ]);
      create();

      expect(rowOrder()).toEqual(["req-p", "req-a"]);

      tick(3000);

      expect(rowOrder()).toEqual(["req-p"]);
    });

    it("drops an approval whose window ends unstarted", () => {
      inbox.approverRows$.next([
        ready({
          leaseNotBefore: new Date(NOW.getTime() - MINUTE).toISOString(),
          leaseNotAfter: new Date(NOW.getTime() + 2000).toISOString(),
        }),
      ]);
      create();

      tick(3000);

      expect(query('[data-testid="approvals-empty"]')).not.toBeNull();
    });

    it("runs no clock when every row is pending", () => {
      const setInterval = jest.spyOn(window, "setInterval");
      inbox.approverRows$.next([pending()]);

      create();

      expect(setInterval.mock.calls.filter(([, delay]) => delay === 1000)).toHaveLength(0);
    });
  });

  describe("toolbar", () => {
    beforeEach(() => {
      inbox.approverRows$.next([
        pending({ id: "req-p" }),
        ready({ id: "req-r", collectionId: "col-2", requesterName: "Ada", cipherId: "cipher-2" }),
        active({ id: "req-a" }),
        active({
          id: "req-e",
          producedLeaseId: "lease-2",
          requesterName: "Ada",
          leaseNotAfter: new Date(NOW.getTime() + 4 * MINUTE).toISOString(),
        }),
      ]);
    });

    it("offers search plus multi-select Status, Shared folders and Requester chips", () => {
      create();

      const chips = queryAll("bit-filter-menu");
      expect(chips.map((chip) => chip.getAttribute("key"))).toEqual([
        "status",
        "collection",
        "requester",
      ]);
      expect(chips.every((chip) => chip.hasAttribute("multiple"))).toBe(true);
      expect(filterControl("search")).toBeDefined();
    });

    it("gives each status option its own icon tile", () => {
      create();

      expect(
        fixture.componentInstance["statusOptions"].map((option) => [option.value, option.iconTile]),
      ).toEqual([
        ["pending", { icon: "bwi-clock", variant: "warning" }],
        ["ready", { icon: "bwi-check-circle", variant: "success" }],
        ["inUse", { icon: "bwi-unlock", variant: "teal" }],
        ["endingSoon", { icon: "bwi-warning", variant: "danger" }],
      ]);
    });

    it("counts the rows the filters leave", () => {
      create();

      expect(table().filteredCount()).toBe(4);

      setFilter("requester", ["Ada"]);

      expect(table().filteredCount()).toBe(2);
    });

    it("filters by search term across item, shared folder and requester", () => {
      create();

      setFilter("search", "billing");

      expect(rowOrder()).toEqual(["req-r"]);
    });

    it("splits running leases into in use and ending soon by the live clock", () => {
      create();

      setFilter("status", ["endingSoon"]);
      expect(rowOrder()).toEqual(["req-e"]);

      setFilter("status", ["inUse"]);
      expect(rowOrder()).toEqual(["req-a"]);
    });

    it("ORs the options within a filter", () => {
      create();

      setFilter("status", ["pending", "ready"]);

      expect(rowOrder()).toEqual(["req-p", "req-r"]);
    });

    it("ANDs across filters", () => {
      create();

      setFilter("requester", ["Ada"]);
      setFilter("collection", ["Production"]);

      expect(rowOrder()).toEqual(["req-e"]);
    });

    it("counts each status option against the current rows", () => {
      create();

      expect(table().optionCount("status", ["pending"])).toBe(1);
      expect(table().optionCount("status", ["inUse"])).toBe(1);
      expect(table().optionCount("status", ["endingSoon"])).toBe(1);
      expect(table().optionCount("collection", ["Staging"])).toBe(1);
    });

    it("keeps the toolbar up and says so when the filters match nothing", () => {
      create();

      setFilter("search", "nothing matches this");

      expect(query('[data-testid="approvals-no-results"]')).not.toBeNull();
      expect(query("bit-table-toolbar")).not.toBeNull();
      expect(query('[data-testid="approvals-empty"]')).toBeNull();
    });
  });
});

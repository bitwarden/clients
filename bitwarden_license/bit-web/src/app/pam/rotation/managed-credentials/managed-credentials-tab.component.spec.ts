import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, combineLatest, map, of, throwError } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";

import { OrgCiphersService } from "../org-ciphers.service";
import { QuartzSchedulePreset, TargetSystemMethod } from "../rotation";
import type { RotationConfig } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import {
  ORGANIZATION_ID,
  configId,
  id,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfig,
  sysId,
} from "../testing/rotation-builders";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/** Joins the key with whatever the message's placeholders resolved to, so both are assertable. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string, ...params: (string | number | undefined)[]) =>
    [id, ...params.filter((param) => param != null)].join(":"),
  translate: (id: string) => id,
};

function makeRow(
  configOverrides: Partial<RotationConfig> = {},
  description = rotationConfigDescription(),
): RotationConfigRow {
  return buildRotationConfigRow(
    rotationConfig(configOverrides),
    undefined,
    "My Cipher",
    description,
  );
}

function makeCipher(cipherId: CipherId, collectionIds: string[] = []): CipherView {
  const cipher = new CipherView();
  cipher.id = uuidAsString(cipherId);
  cipher.collectionIds = collectionIds;
  return cipher;
}

function makeTargetSystemsServiceStub(systems: unknown[] = [{ id: "ts-1" }]) {
  return {
    systems$: new BehaviorSubject<unknown[]>(systems),
    loading$: new BehaviorSubject(false),
    loadError$: new BehaviorSubject<unknown | null>(null),
    load: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * `loadError$` is composed the way the service composes it: its own failure, or failing that the
 * target-system read's, so a failed target-system read reaches the component on both streams.
 * Push a configs-side failure through {@link ownLoadError$}.
 */
function makeConfigsServiceStub(
  targetSystems: ReturnType<typeof makeTargetSystemsServiceStub>,
  rows: RotationConfigRow[] = [makeRow()],
) {
  const ownLoadError$ = new BehaviorSubject<unknown | null>(null);
  return {
    loading$: new BehaviorSubject(false),
    ownLoadError$,
    loadError$: combineLatest([ownLoadError$, targetSystems.loadError$]).pipe(
      map(([own, targetSystemsError]) => own ?? targetSystemsError),
    ),
    rows$: new BehaviorSubject(rows),
    configs$: new BehaviorSubject(rows.map((r) => r.config)),
    awaitingManualCount$: new BehaviorSubject(0),
    load: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    rotateNow: jest.fn().mockResolvedValue(undefined),
    recordManual: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeCipherCollectionProviders(
  ciphers: CipherView[] = [],
  collections: CollectionAdminView[] = [],
  { collectionsFail = false } = {},
) {
  return [
    {
      provide: OrgCiphersService,
      useValue: {
        ciphers$: new BehaviorSubject(ciphers),
        load: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: CollectionAdminService,
      useValue: {
        collectionAdminViews$: () =>
          collectionsFail ? throwError(() => new Error("boom")) : of(collections),
      },
    },
    {
      provide: AccountService,
      useValue: { activeAccount$: of({ id: "user-1" }) },
    },
  ];
}

describe("ManagedCredentialsTabComponent", () => {
  let fixture: ComponentFixture<ManagedCredentialsTabComponent>;
  let component: any;
  let configsService: ReturnType<typeof makeConfigsServiceStub>;
  let targetSystemsService: ReturnType<typeof makeTargetSystemsServiceStub>;
  let toastService: { showToast: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock };

  function setupTestBed(
    dialogResult = true,
    targetSystems: unknown[] = [{ id: "ts-1" }],
    renderTemplate = false,
  ) {
    targetSystemsService = makeTargetSystemsServiceStub(targetSystems);
    configsService = makeConfigsServiceStub(targetSystemsService);
    toastService = { showToast: jest.fn() };
    dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(dialogResult) };

    if (!renderTemplate) {
      TestBed.overrideComponent(ManagedCredentialsTabComponent, {
        set: { template: "<div>stub</div>", imports: [] },
      });
    }

    TestBed.configureTestingModule({
      imports: [ManagedCredentialsTabComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ organizationId: ORGANIZATION_ID }) } },
        { provide: RotationConfigsService, useValue: configsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        ...makeCipherCollectionProviders(),
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe("initialization", () => {
    it("calls configsService.load with the organizationId from route params", () => {
      setupTestBed();
      expect(configsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
    });
  });

  describe("first-run lockup", () => {
    /**
     * The target-system read records its own failure rather than rejecting, so an empty list is
     * either an org with no targets or a read that never landed. Only the first is grounds for
     * the set-up-a-target invitation; the failure is folded into the configs load error, so it
     * reaches the operator as the load-error state instead.
     */
    it("shows the load error rather than the invitation when the target-system read failed", () => {
      setupTestBed(true, [], true);
      targetSystemsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).not.toContain("pamNoTargetSystemsYetTitle");
    });

    it("keeps the table while the target-system read is still in flight", () => {
      setupTestBed(true, [], true);
      targetSystemsService.loading$.next(true);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
        "pamNoTargetSystemsYetTitle",
      );
    });

    it("invites the operator to set one up when the read landed with none", () => {
      setupTestBed(true, [], true);

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        "pamNoTargetSystemsYetTitle",
      );
    });
  });

  describe("load error state", () => {
    it("renders the load-error state instead of the empty state", () => {
      setupTestBed(true, [], true);
      configsService.ownLoadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.textContent).not.toContain("pamNoTargetSystemsYetTitle");
      expect(el.textContent).not.toContain("pamRotationConfigEmptyState");
    });

    it("renders the load-error state while the load is still in flight", () => {
      setupTestBed(true, [], true);
      configsService.ownLoadError$.next(new Error("boom"));
      configsService.loading$.next(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.querySelector('[data-testid="managed-credentials-loading"]')).toBeNull();
    });

    it("retries the load from the error state", async () => {
      setupTestBed(true, [], true);
      configsService.ownLoadError$.next(new Error("boom"));
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();

      expect(configsService.load).toHaveBeenCalledTimes(2);
    });
  });

  describe("credential column", () => {
    function nameCellButton(): HTMLButtonElement {
      setupTestBed(true, [{ id: "ts-1" }], true);

      return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        "tbody tr td:first-child button",
      )!;
    }

    it("renders the credential name as a primary link", () => {
      const button = nameCellButton();

      expect(button.textContent).toContain("My Cipher");
      expect(button.classList).toContain("tw-text-fg-brand");
    });

    it("keeps the credential name keyboard focusable", () => {
      const button = nameCellButton();

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    });
  });

  describe("target-system awareness", () => {
    it("hasTargetSystems is false when none exist", () => {
      setupTestBed(true, []);
      expect(component.hasTargetSystems()).toBe(false);
    });

    it("hasTargetSystems is true when some exist", () => {
      setupTestBed(true, [{ id: "ts-1" }]);
      expect(component.hasTargetSystems()).toBe(true);
    });

    it("setUpTargetSystem navigates to the target-system create page, marked to return", async () => {
      setupTestBed();
      const router = TestBed.inject(Router);
      const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
      await component.setUpTargetSystem();
      expect(nav).toHaveBeenCalledWith(
        ["..", "target-systems", "new"],
        expect.objectContaining({
          relativeTo: expect.anything(),
          queryParams: { then: "managed-credential" },
        }),
      );
    });
  });

  describe("rotateNow", () => {
    beforeEach(() => setupTestBed());

    it("calls service.rotateNow and shows a success toast", async () => {
      const row = makeRow();
      await component.rotateNow(row);
      expect(configsService.rotateNow).toHaveBeenCalledWith(row.config);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("shows an error toast when rotateNow throws", async () => {
      configsService.rotateNow.mockRejectedValue(new Error("fail"));
      const row = makeRow();
      await component.rotateNow(row);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  describe("confirmDelete (confirmed)", () => {
    beforeEach(() => setupTestBed(true));

    it("opens a confirm dialog then deletes when confirmed", async () => {
      const row = makeRow();
      await component.confirmDelete(row);
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(configsService.delete).toHaveBeenCalledWith(row.config);
    });

    it("shows a success toast after deleting", async () => {
      const row = makeRow();
      await component.confirmDelete(row);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("confirmDelete (canceled)", () => {
    beforeEach(() => setupTestBed(false));

    it("does not delete when the dialog is canceled", async () => {
      const row = makeRow();
      await component.confirmDelete(row);
      expect(configsService.delete).not.toHaveBeenCalled();
    });
  });

  describe("confirmRecordManual (confirmed)", () => {
    beforeEach(() => setupTestBed(true));

    it("opens confirm dialog and calls recordManual when confirmed", async () => {
      const row = makeRow();
      await component.confirmRecordManual(row);
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(configsService.recordManual).toHaveBeenCalledWith(row.config);
    });
  });

  describe("confirmRecordManual (canceled)", () => {
    beforeEach(() => setupTestBed(false));

    it("does not call recordManual when the dialog is canceled", async () => {
      const row = makeRow();
      await component.confirmRecordManual(row);
      expect(configsService.recordManual).not.toHaveBeenCalled();
    });
  });

  describe("pause", () => {
    beforeEach(() => setupTestBed());

    it("calls service.pause and shows a success toast", async () => {
      const row = makeRow();
      await component.pause(row);
      expect(configsService.pause).toHaveBeenCalledWith(row.config);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("in-flight row guard", () => {
    beforeEach(() => setupTestBed(true));

    it("does not dispatch a second rotateNow while the first is unsettled", async () => {
      const pending = deferred();
      configsService.rotateNow.mockReturnValue(pending.promise);
      const row = makeRow();

      const first = component.rotateNow(row);
      const second = component.rotateNow(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(configsService.rotateNow).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a second pause while the first is unsettled", async () => {
      const pending = deferred();
      configsService.pause.mockReturnValue(pending.promise);
      const row = makeRow();

      const first = component.pause(row);
      const second = component.pause(row);
      pending.settle();
      await Promise.all([first, second]);

      expect(configsService.pause).toHaveBeenCalledTimes(1);
    });

    it("re-enables the row once the request settles", async () => {
      const pending = deferred();
      configsService.rotateNow.mockReturnValue(pending.promise);
      const row = makeRow();

      const first = component.rotateNow(row);
      expect(component.isRowBusy(row.id)).toBe(true);

      pending.settle();
      await first;
      expect(component.isRowBusy(row.id)).toBe(false);

      await component.rotateNow(row);
      expect(configsService.rotateNow).toHaveBeenCalledTimes(2);
    });

    it("allows a second action on a different row while one is in flight", async () => {
      const pending = deferred();
      configsService.pause.mockReturnValue(pending.promise);
      const rowA = makeRow();
      const rowB = makeRow({ id: configId("7") });

      const first = component.pause(rowA);
      const second = component.pause(rowB);
      pending.settle();
      await Promise.all([first, second]);

      expect(configsService.pause).toHaveBeenCalledTimes(2);
    });
  });

  describe("resume", () => {
    beforeEach(() => setupTestBed());

    it("calls service.resume and shows a success toast", async () => {
      const row = makeRow({ enabled: false });
      await component.resume(row);
      expect(configsService.resume).toHaveBeenCalledWith(row.config);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("rotate-on-access-end cell", () => {
    const rotates = () => makeRow({ rotateOnAccessEnd: true });
    const doesNotRotate = () => makeRow({ rotateOnAccessEnd: false, id: configId("7") });

    function renderCells(rows: RotationConfigRow[]): HTMLElement[] {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.rows$.next(rows);
      fixture.detectChanges();

      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '[id^="managed-credentials-tab_rotate-on-access-end_"]',
        ),
      );
    }

    it("reads as text, not only a check icon, when the credential rotates on access end", () => {
      const [cell] = renderCells([rotates()]);
      expect(cell.textContent).toContain("yes");
      expect(cell.querySelector(".bwi-check")).not.toBeNull();
    });

    it("reads as text when the credential does not rotate on access end", () => {
      const [cell] = renderCells([doesNotRotate()]);
      expect(cell.textContent).toContain("no");
      expect(cell.querySelector(".bwi-check")).toBeNull();
    });

    it("leaves no cell in the column empty", () => {
      const cells = renderCells([rotates(), doesNotRotate()]);
      expect(cells.map((cell) => cell.textContent!.trim())).toEqual(["yes", "no"]);
    });
  });

  /**
   * The four statuses are mutually exclusive, so the cell shows one badge and never a stack: an
   * Active badge sitting beside a "rotating" or "manual" one is what these exclude.
   */
  describe("status cell", () => {
    function statusCell(row: RotationConfigRow): HTMLElement {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.rows$.next([row]);
      fixture.detectChanges();

      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[id^="managed-credentials-tab_status_"]',
      )!;
    }

    function badges(cell: HTMLElement): HTMLElement[] {
      return Array.from(cell.querySelectorAll<HTMLElement>("span[bitbadge]"));
    }

    function expectOnlyBadge(cell: HTMLElement, labelKey: string, icon: string): void {
      const rendered = badges(cell);
      expect(rendered).toHaveLength(1);
      expect(rendered[0].textContent!.trim()).toBe(labelKey);
      expect(rendered[0].querySelector(`.${icon}`)).not.toBeNull();
    }

    it("shows only the active badge for an enabled, idle credential", () => {
      expectOnlyBadge(statusCell(makeRow()), "pamRotationConfigStatusActive", "bwi-check-circle");
    });

    it("shows only the paused badge for a disabled credential", () => {
      expectOnlyBadge(
        statusCell(makeRow({ enabled: false })),
        "pamRotationConfigStatusPaused",
        "bwi-minus-circle",
      );
    });

    it("shows only the rotating badge while a job is in flight", () => {
      expectOnlyBadge(
        statusCell(makeRow({ hasActiveJob: true })),
        "pamRotationConfigInProgress",
        "bwi-refresh",
      );
    });

    it("shows only the manual-rotation badge while awaiting a confirmation", () => {
      expectOnlyBadge(
        statusCell(makeRow({ awaitingManualRotation: true })),
        "pamRotationConfigManualDue",
        "bwi-clock",
      );
    });

    it("resolves to one status, not three, when every flag is set at once", () => {
      const rendered = badges(
        statusCell(makeRow({ enabled: false, hasActiveJob: true, awaitingManualRotation: true })),
      );
      expect(rendered[0].textContent!.trim()).toBe("pamRotationConfigInProgress");
      expect(rendered[0].querySelector(".bwi-refresh")).not.toBeNull();
      expect(rendered.map((el) => el.textContent!.trim())).not.toContain(
        "pamRotationConfigManualDue",
      );
    });

    /**
     * Pausing is not gated on an in-flight job, so this state is reachable. The resolved status
     * gives the job precedence, and the pause would otherwise leave no mark on the row.
     */
    it("keeps the pause visible alongside the rotating badge", () => {
      const rendered = badges(statusCell(makeRow({ enabled: false, hasActiveJob: true })));
      expect(rendered.map((el) => el.textContent!.trim())).toEqual([
        "pamRotationConfigInProgress",
        "pamRotationConfigStatusPaused",
      ]);
      expect(rendered[1].querySelector(".bwi-minus-circle")).not.toBeNull();
    });

    it("does not repeat the pause when the status badge already says paused", () => {
      expectOnlyBadge(
        statusCell(makeRow({ enabled: false })),
        "pamRotationConfigStatusPaused",
        "bwi-minus-circle",
      );
    });
  });

  /**
   * The column printed raw Quartz whenever the SDK called a schedule Custom, so an expression the
   * schedule input's own interval builder composed came back to the operator as a cron string.
   */
  describe("schedule cell", () => {
    function scheduleCell(row: RotationConfigRow): HTMLElement {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.rows$.next([row]);
      fixture.detectChanges();

      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '[id^="managed-credentials-tab_schedule_"]',
      )!;
    }

    function cellFor(cron: string | undefined, preset: QuartzSchedulePreset): HTMLElement {
      return scheduleCell(
        makeRow({ scheduleCron: cron }, rotationConfigDescription({ schedulePreset: preset })),
      );
    }

    it("names the preset the SDK matched the expression to", () => {
      const cell = cellFor("0 0 0 * * ?", QuartzSchedulePreset.Daily);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleDaily");
      expect(cell.getAttribute("title")).toBeNull();
    });

    it("spells out an interval with its time of day instead of its expression", () => {
      const cell = cellFor("0 0 3 * * ?", QuartzSchedulePreset.Custom);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleColumnEveryDay:03:00");
      expect(cell.textContent).not.toContain("0 0 3 * * ?");
    });

    it("spells out a multi-day interval with its count and time of day", () => {
      const cell = cellFor("0 0 2 1/7 * ?", QuartzSchedulePreset.Custom);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleColumnEveryNDays:7:02:00");
    });

    it("labels a hand-written expression Custom and keeps it in the cell's tooltip", () => {
      const cell = cellFor("0 0 9 ? * MON-FRI", QuartzSchedulePreset.Custom);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleCustom");
      expect(cell.getAttribute("title")).toBe("0 0 9 ? * MON-FRI");
    });

    /** The cell rendered an empty `<code>` here, and reached `I18nService.t("")`. */
    it("says there is no schedule rather than leaving the cell empty", () => {
      const cell = cellFor(undefined, QuartzSchedulePreset.Custom);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleNone");
    });

    it("spells the absence out rather than rendering a dash", () => {
      const cell = cellFor(undefined, QuartzSchedulePreset.None);
      expect(cell.textContent!.trim()).toBe("pamRotationScheduleNone");
      expect(cell.textContent).not.toContain("\u2014");
    });
  });

  /**
   * The column sorted on `statusLabelKey` until now, which compared raw i18n identifiers and so
   * ordered the four statuses by the spelling of their keys.
   */
  describe("status column sort", () => {
    function renderedStatuses(): string[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '[id^="managed-credentials-tab_status_"]',
        ),
      ).map((cell) => cell.querySelector("span[bitbadge]")!.textContent!.trim());
    }

    function sortByStatus(): void {
      const header = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        'th[bitsortable="statusSortOrder"]',
      );
      expect(header).not.toBeNull();
      header!.querySelector("button")!.click();
      fixture.detectChanges();
    }

    function renderRows(): void {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.rows$.next([
        makeRow({ id: configId("1"), enabled: true }),
        makeRow({ id: configId("2"), awaitingManualRotation: true }),
        makeRow({ id: configId("3"), hasActiveJob: true }),
        makeRow({ id: configId("4"), enabled: false }),
      ]);
      fixture.detectChanges();
    }

    it("orders ascending by the resolved status, not by the status label's i18n key", () => {
      renderRows();
      sortByStatus();

      expect(renderedStatuses()).toEqual([
        "pamRotationConfigInProgress",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigManualDue",
        "pamRotationConfigStatusActive",
      ]);
    });

    it("reverses on a second click", () => {
      renderRows();
      sortByStatus();
      sortByStatus();

      expect(renderedStatuses()).toEqual([
        "pamRotationConfigStatusActive",
        "pamRotationConfigManualDue",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigInProgress",
      ]);
    });
  });

  describe("row menu", () => {
    function openRowMenu(row: RotationConfigRow): void {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.rows$.next([row]);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button[id^="managed-credentials-tab_menu-trigger_"]')!
        .click();
      fixture.detectChanges();
    }

    function item(idPrefix: string): HTMLButtonElement {
      return document.querySelector<HTMLButtonElement>(`.bit-menu-panel [id^="${idPrefix}"]`)!;
    }

    /** The panel this test just opened. */
    function itemLabels(): string[] {
      const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
      const panel = panels[panels.length - 1];
      return Array.from(panel.querySelectorAll<HTMLElement>("[bitmenuitem]")).map((el) =>
        el.textContent!.trim(),
      );
    }

    function expectExplained(button: HTMLButtonElement): void {
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-describedby")).toMatch(/^bit-tooltip-\d+$/);
    }

    /** The i18n key the row menu's disabled Rotate now item states as its reason. */
    function rotateNowBlockedKey(row: RotationConfigRow): string {
      return component.rotateNowBlockedKey(row);
    }

    it("offers edit, rotate now, pause and remove on an active credential", () => {
      openRowMenu(makeRow());

      expect(itemLabels()).toEqual([
        "pamRotationConfigEditCredential",
        "pamRotationConfigRotateNow",
        "pamRotationConfigPause",
        "pamRotationConfigRemoveFromRotation",
      ]);
    });

    it("swaps pause for resume on a paused credential", () => {
      openRowMenu(
        makeRow(
          { enabled: false },
          rotationConfigDescription({
            actions: rotationConfigActions({
              canRotateNow: false,
              canPause: false,
              canResume: true,
            }),
          }),
        ),
      );

      expect(itemLabels()).toEqual([
        "pamRotationConfigEditCredential",
        "pamRotationConfigRotateNow",
        "pamRotationConfigResume",
        "pamRotationConfigRemoveFromRotation",
      ]);
    });

    it("swaps rotate now for mark as rotated on a manual credential", () => {
      openRowMenu(
        makeRow(
          { targetSystemMethod: TargetSystemMethod.Manual, awaitingManualRotation: true },
          rotationConfigDescription({
            actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
          }),
        ),
      );

      expect(itemLabels()).toEqual([
        "pamRotationConfigEditCredential",
        "pamRotationConfigRecordManual",
        "pamRotationConfigPause",
        "pamRotationConfigRemoveFromRotation",
      ]);
    });

    it("keeps rotate now and remove present but unavailable while rotating", () => {
      openRowMenu(
        makeRow(
          { hasActiveJob: true },
          rotationConfigDescription({
            actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
          }),
        ),
      );

      expect(itemLabels()).toEqual([
        "pamRotationConfigEditCredential",
        "pamRotationConfigRotateNow",
        "pamRotationConfigPause",
        "pamRotationConfigRemoveFromRotation",
      ]);
      expectExplained(item("managed-credentials-tab_button_rotate-now-locked_"));
      expectExplained(item("managed-credentials-tab_button_delete-locked_"));
    });

    it("leaves the rotating badge the only place the row says a job is running", () => {
      const row = makeRow(
        { hasActiveJob: true },
        rotationConfigDescription({
          actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
        }),
      );
      openRowMenu(row);

      expectExplained(item("managed-credentials-tab_button_rotate-now-locked_"));
      expect(rotateNowBlockedKey(row)).toBe("pamRotationConfigRotateNowDisabledActiveJob");
      expect(row.statusBadge.labelKey).toBe("pamRotationConfigInProgress");
    });

    it("blames the pause when a paused credential cannot rotate now", () => {
      const row = makeRow(
        { enabled: false },
        rotationConfigDescription({
          actions: rotationConfigActions({
            canRotateNow: false,
            canPause: false,
            canResume: true,
          }),
        }),
      );
      openRowMenu(row);

      expectExplained(item("managed-credentials-tab_button_rotate-now-locked_"));
      expect(rotateNowBlockedKey(row)).toBe("pamRotationConfigRotateNowDisabledPaused");
    });

    it("explains an unavailable mark as rotated", () => {
      openRowMenu(
        makeRow(
          { targetSystemMethod: TargetSystemMethod.Manual },
          rotationConfigDescription({
            actions: rotationConfigActions({ canRotateNow: false, canRecordManual: false }),
          }),
        ),
      );

      expectExplained(item("managed-credentials-tab_button_record-manual-locked_"));
    });

    it("keeps the unavailable rotate-now item focusable and described", () => {
      openRowMenu(
        makeRow(
          {},
          rotationConfigDescription({ actions: rotationConfigActions({ canRotateNow: false }) }),
        ),
      );

      expectExplained(item("managed-credentials-tab_button_rotate-now-locked_"));
    });

    it("blames the target system when nothing else explains a blocked rotate now", () => {
      const row = makeRow(
        {},
        rotationConfigDescription({ actions: rotationConfigActions({ canRotateNow: false }) }),
      );
      openRowMenu(row);

      expect(rotateNowBlockedKey(row)).toBe("pamRotationConfigRotateNowDisabledTargetInactive");
    });

    it("keeps the locked delete item focusable and described", () => {
      openRowMenu(
        makeRow(
          {},
          rotationConfigDescription({ actions: rotationConfigActions({ mutationsLocked: true }) }),
        ),
      );

      expectExplained(item("managed-credentials-tab_button_delete-locked_"));
    });

    it("keeps the row menu open when a locked item is clicked", () => {
      openRowMenu(
        makeRow(
          {},
          rotationConfigDescription({ actions: rotationConfigActions({ mutationsLocked: true }) }),
        ),
      );

      item("managed-credentials-tab_button_delete-locked_").click();
      fixture.detectChanges();

      expect(document.querySelector(".bit-menu-panel")).not.toBeNull();
    });
  });

  describe("toolbar filters", () => {
    const cipherA = asUuid<CipherId>(id("cipher-a"));
    const cipherB = asUuid<CipherId>(id("cipher-b"));
    const cipherC = asUuid<CipherId>(id("cipher-c"));

    const rowA = makeRow({
      cipherId: cipherA,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
    });
    const rowB = makeRow({
      cipherId: cipherB,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      enabled: false,
    });
    const rowC = makeRow({
      cipherId: cipherC,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
    });

    function setupWithData(
      rows: RotationConfigRow[],
      ciphers: CipherView[],
      collections: CollectionAdminView[] = [],
    ) {
      targetSystemsService = makeTargetSystemsServiceStub();
      configsService = makeConfigsServiceStub(targetSystemsService, rows);
      toastService = { showToast: jest.fn() };
      dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [ManagedCredentialsTabComponent],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
          },
          { provide: RotationConfigsService, useValue: configsService },
          { provide: TargetSystemsService, useValue: targetSystemsService },
          ...makeCipherCollectionProviders(ciphers, collections),
          { provide: ToastService, useValue: toastService },
          { provide: DialogService, useValue: dialogService },
          { provide: I18nService, useValue: i18nFake },
        ],
      });

      fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    }

    function chip(key: string): FilterMenuComponent {
      return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
    }

    it("derives target-system options from the loaded rows, sorted by name", () => {
      setupWithData([rowA, rowB, rowC], []);
      expect(component.targetSystemOptions()).toEqual([
        { value: sysId("1"), label: "Prod Entra" },
        { value: sysId("2"), label: "Staging AD" },
      ]);
    });

    it("keys target-system options by id, so two systems sharing a name stay distinct", () => {
      const rowSameNameOtherSystem = makeRow({
        cipherId: cipherC,
        targetSystemId: sysId("2"),
        targetSystemName: "Prod Entra",
        enabled: true,
      });
      setupWithData([rowA, rowSameNameOtherSystem], []);
      expect(component.targetSystemOptions()).toEqual([
        { value: sysId("1"), label: "Prod Entra" },
        { value: sysId("2"), label: "Prod Entra" },
      ]);
    });

    it("derives collection options from the rows' ciphers, not every org collection", async () => {
      setupWithData(
        [rowA, rowB],
        [makeCipher(cipherA, ["col-1"]), makeCipher(cipherB, ["col-2"])],
        [
          { id: "col-1", name: "Engineering" } as CollectionAdminView,
          { id: "col-2", name: "Finance" } as CollectionAdminView,
          { id: "col-3", name: "Unreferenced" } as CollectionAdminView,
        ],
      );
      await fixture.whenStable();
      expect(component.collectionOptions()).toEqual([
        { value: "col-1", label: "Engineering" },
        { value: "col-2", label: "Finance" },
      ]);
    });

    it("withholds the collection chip when the collection read failed", async () => {
      targetSystemsService = makeTargetSystemsServiceStub();
      configsService = makeConfigsServiceStub(targetSystemsService, [rowA]);
      toastService = { showToast: jest.fn() };
      dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

      TestBed.configureTestingModule({
        imports: [ManagedCredentialsTabComponent],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
          },
          { provide: RotationConfigsService, useValue: configsService },
          { provide: TargetSystemsService, useValue: targetSystemsService },
          ...makeCipherCollectionProviders([makeCipher(cipherA, ["col-1"])], [], {
            collectionsFail: true,
          }),
          { provide: ToastService, useValue: toastService },
          { provide: DialogService, useValue: dialogService },
          { provide: I18nService, useValue: i18nFake },
        ],
      });

      fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.collectionOptions()).toEqual([]);
      expect(fixture.debugElement.query(By.css('bit-filter-menu[key="collection"]'))).toBeNull();
      expect(fixture.debugElement.query(By.css("bit-table"))).not.toBeNull();
    });

    it("does not render the collection chip when no row's cipher carries a collection", () => {
      setupWithData([rowA], [makeCipher(cipherA, [])]);
      expect(fixture.debugElement.query(By.css('bit-filter-menu[key="collection"]'))).toBeNull();
    });

    it("narrows rows to the selected status", () => {
      setupWithData([rowA, rowB, rowC], []);
      chip("status").toggle("pamRotationConfigStatusPaused");
      fixture.detectChanges();
      expect(component.processedRows()).toHaveLength(1);
      expect(component.processedRows()[0].config.cipherId).toBe(cipherB);
    });

    it("narrows rows to the selected target system", () => {
      setupWithData([rowA, rowB, rowC], []);
      chip("targetSystem").toggle(sysId("2"));
      fixture.detectChanges();
      expect(component.processedRows()).toHaveLength(1);
      expect(component.processedRows()[0].config.cipherId).toBe(cipherB);
    });

    it("gives each fixture cipher its own id", () => {
      expect(new Set([cipherA, cipherB, cipherC]).size).toBe(3);
    });

    it("narrows rows to the selected collection", () => {
      setupWithData(
        [rowA, rowB, rowC],
        [
          makeCipher(cipherA, ["col-1"]),
          makeCipher(cipherB, ["col-2"]),
          makeCipher(cipherC, ["col-2"]),
        ],
        [
          { id: "col-1", name: "Engineering" } as CollectionAdminView,
          { id: "col-2", name: "Finance" } as CollectionAdminView,
        ],
      );
      chip("collection").toggle("col-1");
      fixture.detectChanges();
      expect(component.processedRows()).toHaveLength(1);
      expect(component.processedRows()[0].config.cipherId).toBe(cipherA);
    });

    it("resolves each row's collections from its own cipher", () => {
      setupWithData(
        [rowA, rowB, rowC],
        [
          makeCipher(cipherA, ["col-1"]),
          makeCipher(cipherB, ["col-2"]),
          makeCipher(cipherC, ["col-3"]),
        ],
        [
          { id: "col-1", name: "Engineering" } as CollectionAdminView,
          { id: "col-2", name: "Finance" } as CollectionAdminView,
          { id: "col-3", name: "Support" } as CollectionAdminView,
        ],
      );
      chip("collection").toggle("col-2");
      fixture.detectChanges();
      expect(component.processedRows()).toHaveLength(1);
      expect(component.processedRows()[0].config.cipherId).toBe(cipherB);
    });

    it("does not exclude a row from the collection filter when its cipher never loaded", () => {
      setupWithData(
        [rowA, rowC],
        [makeCipher(cipherA, ["col-1"])],
        [{ id: "col-1", name: "Engineering" } as CollectionAdminView],
      );
      chip("collection").toggle("col-1");
      fixture.detectChanges();
      const ids = component.processedRows().map((r: RotationConfigRow) => r.config.cipherId);
      expect(ids.sort()).toEqual([cipherA, cipherC].sort());
    });

    it("ANDs the chips with each other and with the search text", () => {
      setupWithData([rowA, rowB, rowC], []);
      component.searchControl.setValue("prod");
      chip("status").toggle("pamRotationConfigStatusActive");
      fixture.detectChanges();
      const ids = component.processedRows().map((r: RotationConfigRow) => r.config.cipherId);
      expect(ids.sort()).toEqual([cipherA, cipherC].sort());
    });

    it("shows the generic no-results message when chip filters alone empty the table", () => {
      setupWithData([rowA], []);
      chip("status").toggle("pamRotationConfigStatusPaused");
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain("pamRotationConfigNoResultsFiltered");
    });
  });

  describe("loading skeleton", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    });

    afterEach(() => jest.useRealTimers());

    function renderLoading() {
      setupTestBed(true, [{ id: "ts-1" }], true);
      configsService.loading$.next(true);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    /** Runs the placeholder's clock on. */
    function advance(ms: number): void {
      fixture.detectChanges();
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    }

    /** Renders the page mid-load with its placeholder already drawn. */
    function renderSkeleton(): HTMLElement {
      const el = renderLoading();
      advance(1000);
      return el;
    }

    it("stands a skeleton table in for the list, carrying the real columns", () => {
      const el = renderSkeleton();
      const loading = el.querySelector('[data-testid="managed-credentials-loading"]');

      expect(el.querySelector("bit-spinner")).toBeNull();
      expect(loading).not.toBeNull();
      expect(loading!.querySelectorAll("bit-skeleton-text").length).toBeGreaterThan(0);
      expect(loading!.textContent).toContain("pamRotationConfigColumnItem");
      expect(loading!.textContent).toContain("pamRotationConfigColumnNextRotation");
    });

    it("keeps the placeholder itself out of the accessibility tree", () => {
      const loading = renderLoading().querySelector('[data-testid="managed-credentials-loading"]');

      expect(loading!.getAttribute("aria-hidden")).toBe("true");
    });

    it("stands a placeholder in for the toolbar rather than offering row-derived filters", () => {
      const el = renderSkeleton();

      expect(el.querySelector("bit-search")).toBeNull();
      expect(el.querySelector("bit-filter-menu")).toBeNull();
      expect(
        el.querySelectorAll(
          '[data-testid="managed-credentials-loading"] > div:first-child bit-skeleton',
        ).length,
      ).toBeGreaterThan(0);
    });

    it("announces the load from a live region while the skeleton stands in", () => {
      const status = renderLoading().querySelector('[data-testid="rotation-loading-status"]');

      expect(status!.getAttribute("role")).toBe("status");
      expect(status!.getAttribute("aria-live")).toBe("polite");
      expect(status!.textContent).toContain("loading");
    });

    it("replaces the skeleton with the real rows, and announces the arrival", () => {
      const el = renderSkeleton();

      configsService.loading$.next(false);
      advance(1000);

      expect(el.querySelector('[data-testid="managed-credentials-loading"]')).toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector("tbody tr td:first-child button")!.textContent).toContain(
        "My Cipher",
      );
      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "pamManagedCredentialsLoaded",
      );
    });

    it("renders the tab's own furniture, not a blank area, before the delay is up", () => {
      const el = renderLoading();
      advance(999);

      const loading = el.querySelector('[data-testid="managed-credentials-loading"]');
      expect(loading).not.toBeNull();
      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(loading!.textContent).toContain("pamRotationConfigColumnItem");
    });

    it("never draws the placeholder for a list that arrives inside the delay", () => {
      const el = renderLoading();
      advance(500);
      configsService.loading$.next(false);
      advance(1000);

      expect(el.querySelector("bit-skeleton")).toBeNull();
      expect(el.querySelector('[data-testid="managed-credentials-loading"]')).toBeNull();
    });

    it("holds the placeholder its minimum time once it is up, so it cannot blink", () => {
      const el = renderSkeleton();
      expect(el.querySelector("bit-skeleton")).not.toBeNull();

      configsService.loading$.next(false);
      advance(300);

      expect(el.querySelector("bit-skeleton")).not.toBeNull();

      advance(700);

      expect(el.querySelector("bit-skeleton")).toBeNull();
    });

    it("announces the load at once, not on the placeholder's clock", () => {
      const el = renderLoading();

      expect(el.querySelector('[data-testid="rotation-loading-status"]')!.textContent).toContain(
        "loading",
      );
      expect(el.querySelector("bit-skeleton")).toBeNull();
    });
  });
});

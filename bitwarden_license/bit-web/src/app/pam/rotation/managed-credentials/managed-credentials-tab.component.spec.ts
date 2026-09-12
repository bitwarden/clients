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
import { TargetSystemMethod } from "../rotation";
import type { RotationConfigView } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import {
  CIPHER_ID,
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

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeRow(
  configOverrides: Partial<RotationConfigView> = {},
  description = rotationConfigDescription(),
  cipherName = "My Cipher",
): RotationConfigRow {
  return buildRotationConfigRow(
    rotationConfig(configOverrides),
    undefined,
    cipherName,
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
 * Composes `loadError$` as the service does, its own failure else the target-system read's. Push a
 * configs-side failure through {@link ownLoadError$}.
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

function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function headings(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('bit-table-v2 [role="columnheader"]')).map(text);
}

function bodyRows(el: HTMLElement): Element[] {
  return Array.from(el.querySelectorAll("bit-table-v2 bit-row"));
}

function cellTexts(el: HTMLElement): string[][] {
  return bodyRows(el).map((row) => Array.from(row.querySelectorAll('[role="cell"]')).map(text));
}

function rowNames(el: HTMLElement): string[] {
  return bodyRows(el).map((row) => text(row.querySelector("button[bitLink]")!));
}

function sortButtonLabels(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('bit-table-v2 [role="columnheader"] button')).map(text);
}

function renderedStatuses(el: HTMLElement): string[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>('[id^="managed-credentials-tab_status_"]'),
  ).map((cell) => cell.querySelector("span[bitbadge]")!.textContent!.trim());
}

describe("ManagedCredentialsTabComponent", () => {
  let fixture: ComponentFixture<ManagedCredentialsTabComponent>;
  let component: any;
  let configsService: ReturnType<typeof makeConfigsServiceStub>;
  let targetSystemsService: ReturnType<typeof makeTargetSystemsServiceStub>;
  let toastService: { showToast: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock };
  let router: Router;

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  function clickSort(el: HTMLElement, label: string): void {
    Array.from(el.querySelectorAll<HTMLElement>('bit-table-v2 [role="columnheader"]'))
      .find((header) => text(header) === label)!
      .querySelector("button")!
      .click();
    fixture.detectChanges();
  }

  function menuItems(el: HTMLElement, rowIndex: number): string[] {
    el.querySelectorAll<HTMLButtonElement>('button[id^="managed-credentials-tab_menu-trigger_"]')[
      rowIndex
    ].click();
    fixture.detectChanges();
    const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
    return Array.from(panels[panels.length - 1].querySelectorAll("[bitmenuitem]")).map(text);
  }

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
    it("leaves the configs load to the rotation shell", () => {
      setupTestBed();
      expect(configsService.load).not.toHaveBeenCalled();
    });
  });

  describe("first-run lockup", () => {
    /**
     * An empty target list after a failed read isn't an org without targets, so it shows the
     * load-error state rather than the set-up invitation.
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

      expect(configsService.load).toHaveBeenCalledTimes(1);
      expect(configsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
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

    it("shows the server's reason when the SDK refuses the rotation", async () => {
      configsService.rotateNow.mockRejectedValue(
        Object.assign(
          new Error(
            'error in response: status code 400 Bad Request: {"object":"error",' +
              '"message":"A rotation for this credential is already in progress."}',
          ),
          { name: "RotationError", variant: "Api" },
        ),
      );
      await component.rotateNow(makeRow());
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "A rotation for this credential is already in progress.",
      });
    });

    it("falls back to the generic message for an error with no server reason", async () => {
      configsService.rotateNow.mockRejectedValue(new Error("fail"));
      await component.rotateNow(makeRow());
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "unexpectedError",
      });
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

  /** The statuses are exclusive, so the cell shows one badge, never a stack. */
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
      expectOnlyBadge(statusCell(makeRow()), "active", "bwi-check-circle");
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
        "pamRotationConfigRotatingBadge",
        "bwi-refresh",
      );
    });

    it("shows only the manual-rotation badge while awaiting a confirmation", () => {
      expectOnlyBadge(
        statusCell(makeRow({ awaitingManualRotation: true })),
        "pamRotationConfigRotationDueBadge",
        "bwi-clock",
      );
    });

    it("resolves to one status, not three, when every flag is set at once", () => {
      const rendered = badges(
        statusCell(makeRow({ enabled: false, hasActiveJob: true, awaitingManualRotation: true })),
      );
      expect(rendered[0].textContent!.trim()).toBe("pamRotationConfigRotatingBadge");
      expect(rendered[0].querySelector(".bwi-refresh")).not.toBeNull();
      expect(rendered.map((el) => el.textContent!.trim())).not.toContain(
        "pamRotationConfigRotationDueBadge",
      );
    });

    /**
     * Pausing isn't locked by an in-flight job, and the job's status takes precedence, so the pause
     * needs its own mark.
     */
    it("keeps the pause visible alongside the rotating badge", () => {
      const rendered = badges(statusCell(makeRow({ enabled: false, hasActiveJob: true })));
      expect(rendered.map((el) => el.textContent!.trim())).toEqual([
        "pamRotationConfigRotatingBadge",
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
        "pamRotationConfigRotatingBadge",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigRotationDueBadge",
        "pamRotationConfigStatusActive",
      ]);
    });

    it("reverses on a second click", () => {
      renderRows();
      sortByStatus();
      sortByStatus();

      expect(renderedStatuses()).toEqual([
        "pamRotationConfigStatusActive",
        "pamRotationConfigRotationDueBadge",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigRotatingBadge",
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

    /** The panel this test opened last. */
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

    it("offers edit, rotate now, pause and remove on an active credential", () => {
      openRowMenu(makeRow());

      expect(itemLabels()).toEqual([
        "pamRotationConfigEditCredential",
        "pamRotationConfigRotateNow",
        "pamRotationConfigPauseRotation",
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
        "pamRotationConfigResumeRotation",
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
        "pamRotationConfigMarkRotated",
        "pamRotationConfigPauseRotation",
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
        "pamRotationConfigPauseRotation",
        "pamRotationConfigRemoveFromRotation",
      ]);
      expectExplained(item("managed-credentials-tab_button_rotate-now-locked_"));
      expectExplained(item("managed-credentials-tab_button_delete-locked_"));
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

    const rowA = makeRow(
      {
        id: configId("a"),
        cipherId: cipherA,
        targetSystemId: sysId("1"),
        targetSystemName: "Prod Entra",
        enabled: true,
      },
      undefined,
      "Cipher A",
    );
    const rowB = makeRow(
      {
        id: configId("b"),
        cipherId: cipherB,
        targetSystemId: sysId("2"),
        targetSystemName: "Staging AD",
        enabled: false,
      },
      undefined,
      "Cipher B",
    );
    const rowC = makeRow(
      {
        id: configId("c"),
        cipherId: cipherC,
        targetSystemId: sysId("1"),
        targetSystemName: "Prod Entra",
        enabled: true,
      },
      undefined,
      "Cipher C",
    );

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

    // Nothing else covers ROTATION_STATUS_BADGES, and without it the chip silently offers "All".
    it("offers one status option per badge", () => {
      setupWithData([rowA, rowB, rowC], []);

      const values = fixture.debugElement
        .queryAll(By.css('bit-filter-menu[key="status"] bit-filter-option'))
        .map((option) => option.componentInstance.value());

      expect(values).toEqual([
        "active",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigRotatingBadge",
        "pamRotationConfigRotationDueBadge",
      ]);
    });

    it("derives target-system options from the loaded rows, sorted by name", () => {
      setupWithData([rowA, rowB, rowC], []);
      expect(component.targetSystemOptions()).toEqual([
        { value: sysId("1"), label: "Prod Entra" },
        { value: sysId("2"), label: "Staging AD" },
      ]);
    });

    it("keys target-system options by id, so two systems sharing a name stay distinct", () => {
      const rowSameNameOtherSystem = makeRow({
        id: configId("c"),
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
      expect(fixture.debugElement.query(By.css("bit-table-v2"))).not.toBeNull();
    });

    it("does not render the collection chip when no row's cipher carries a collection", () => {
      setupWithData([rowA], [makeCipher(cipherA, [])]);
      expect(fixture.debugElement.query(By.css('bit-filter-menu[key="collection"]'))).toBeNull();
    });

    it("gives each fixture cipher its own id", () => {
      expect(new Set([cipherA, cipherB, cipherC]).size).toBe(3);
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
      expect(rowNames(fixture.nativeElement)).toEqual(["Cipher A"]);
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
      expect(rowNames(fixture.nativeElement)).toEqual(["Cipher B"]);
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
      expect(rowNames(fixture.nativeElement)).toEqual(["Cipher A", "Cipher C"]);
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

    function advance(ms: number): void {
      fixture.detectChanges();
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    }

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

    it("draws the skeleton as a table with every column and five rows", () => {
      const loading = renderSkeleton().querySelector<HTMLElement>(
        '[data-testid="managed-credentials-loading"]',
      )!;

      expect(loading.querySelector("bit-table-v2")).not.toBeNull();
      expect(headings(loading)).toEqual([
        "pamRotationConfigColumnItem",
        "pamRotationConfigColumnTargetSystem",
        "status",
        "pamRotationConfigColumnSchedule",
        "pamRotationConfigColumnRotateOnAccessEnd",
        "pamRotationConfigColumnLastRotated",
        "pamRotationConfigColumnNextRotation",
        "",
      ]);
      expect(loading.querySelectorAll("bit-table-v2 bit-row")).toHaveLength(5);
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
      expect(rowNames(el)).toEqual(["My Cipher"]);
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

  describe("table", () => {
    const active = buildRotationConfigRow(
      rotationConfig({
        id: configId("1"),
        targetSystemId: sysId("1"),
        targetSystemName: "Prod Entra",
        rotateOnAccessEnd: true,
        lastRotationAt: "2026-03-01T10:00:00Z",
        nextRotationAt: "2026-04-01T10:00:00Z",
      }),
      undefined,
      "Prod DB service account",
      rotationConfigDescription(),
    );
    const paused = buildRotationConfigRow(
      rotationConfig({
        id: configId("2"),
        targetSystemId: sysId("2"),
        targetSystemName: "Staging AD",
        enabled: false,
        lastRotationAt: "2026-01-15T10:00:00Z",
      }),
      undefined,
      "Staging admin login",
      rotationConfigDescription({
        actions: rotationConfigActions({ canRotateNow: false, canPause: false, canResume: true }),
      }),
    );
    const rotating = buildRotationConfigRow(
      rotationConfig({ id: configId("3"), hasActiveJob: true }),
      undefined,
      "CI pipeline token",
      rotationConfigDescription({
        actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
      }),
    );
    const manual = buildRotationConfigRow(
      rotationConfig({
        id: configId("4"),
        targetSystemId: sysId("2"),
        targetSystemName: "Staging AD",
        targetSystemMethod: TargetSystemMethod.Manual,
        awaitingManualRotation: true,
      }),
      undefined,
      "Mainframe operator",
      rotationConfigDescription({
        actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
      }),
    );
    const ROWS = [active, paused, rotating, manual];

    function render(rows: RotationConfigRow[] = ROWS): HTMLElement {
      TestBed.resetTestingModule();
      targetSystemsService = makeTargetSystemsServiceStub();
      configsService = makeConfigsServiceStub(targetSystemsService, rows);
      dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(false) };

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
          ...makeCipherCollectionProviders(),
          { provide: ToastService, useValue: { showToast: jest.fn() } },
          { provide: DialogService, useValue: dialogService },
          { provide: I18nService, useValue: i18nFake },
        ],
      });

      router = TestBed.inject(Router);
      fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it("renders the column headings in order", () => {
      expect(headings(render())).toEqual([
        "pamRotationConfigColumnItem",
        "pamRotationConfigColumnTargetSystem",
        "status",
        "pamRotationConfigColumnSchedule",
        "pamRotationConfigColumnRotateOnAccessEnd",
        "pamRotationConfigColumnLastRotated",
        "pamRotationConfigColumnNextRotation",
        "",
      ]);
    });

    it("renders every row in the order loaded", () => {
      expect(rowNames(render())).toEqual(ROWS.map((r) => r.cipherName));
    });

    it("renders the cell text for each column", () => {
      const cells = cellTexts(render());

      expect(cells.map((row) => row.length)).toEqual([8, 8, 8, 8]);
      expect(cells[0].slice(0, 7)).toEqual([
        "Prod DB service account",
        "Prod Entra pamTargetSystemMethodAutomatic",
        "active",
        "pamRotationScheduleDaily",
        "yes",
        "Mar 1, 2026",
        "Apr 1, 2026",
      ]);
    });

    it("names the row menu trigger and keeps the credential name a focusable button", () => {
      const el = render();
      const trigger = el.querySelector<HTMLButtonElement>(
        'bit-table-v2 button[id^="managed-credentials-tab_menu-trigger_"]',
      )!;
      const link = el.querySelector<HTMLButtonElement>("bit-table-v2 bit-row button[bitLink]")!;

      expect(trigger.getAttribute("aria-label")).toBe("options");
      expect(link.tagName).toBe("BUTTON");
      expect(link.getAttribute("tabindex")).not.toBe("-1");
      expect(link.classList).toContain("tw-text-fg-brand");
    });

    it("opens the edit page from the credential name", () => {
      const el = render();
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      el.querySelector<HTMLButtonElement>("bit-table-v2 bit-row button[bitLink]")!.click();

      expect(navigateSpy).toHaveBeenCalledWith(
        ["..", "managed-credentials", active.id],
        expect.objectContaining({ relativeTo: expect.anything() }),
      );
    });

    it("rotates now and confirms a removal from the row menu", async () => {
      const el = render();
      menuItems(el, 0);
      document
        .querySelector<HTMLButtonElement>(
          '.bit-menu-panel [id^="managed-credentials-tab_button_rotate-now_"]',
        )!
        .click();
      await fixture.whenStable();

      expect(configsService.rotateNow).toHaveBeenCalledWith(active.config);

      menuItems(el, 0);
      document
        .querySelector<HTMLButtonElement>(
          '.bit-menu-panel [id^="managed-credentials-tab_button_delete_"]',
        )!
        .click();
      await fixture.whenStable();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "pamRotationConfigDeleteConfirmTitle" } }),
      );
      expect(configsService.delete).not.toHaveBeenCalled();
    });

    it("sorts on the item, status and rotation date columns, and starts unsorted", () => {
      const el = render();

      expect(sortButtonLabels(el)).toEqual([
        "pamRotationConfigColumnItem",
        "status",
        "pamRotationConfigColumnLastRotated",
        "pamRotationConfigColumnNextRotation",
      ]);
      expect(rowNames(el)).toEqual(ROWS.map((r) => r.cipherName));
    });

    /** Sorting on `statusLabelKey` would order the statuses by the spelling of their keys. */
    it("orders the status column by resolved status, and reverses on a second click", () => {
      const el = render();

      clickSort(el, "status");
      expect(renderedStatuses(el)).toEqual([
        "pamRotationConfigRotatingBadge",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigRotationDueBadge",
        "active",
      ]);

      clickSort(el, "status");
      expect(renderedStatuses(el)).toEqual([
        "active",
        "pamRotationConfigRotationDueBadge",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigRotatingBadge",
      ]);
    });

    it.each<[string, string[], string[]]>([
      [
        "pamRotationConfigColumnItem",
        [
          "CI pipeline token",
          "Mainframe operator",
          "Prod DB service account",
          "Staging admin login",
        ],
        [
          "Staging admin login",
          "Prod DB service account",
          "Mainframe operator",
          "CI pipeline token",
        ],
      ],
      [
        "pamRotationConfigColumnLastRotated",
        [
          "CI pipeline token",
          "Mainframe operator",
          "Staging admin login",
          "Prod DB service account",
        ],
        [
          "Prod DB service account",
          "Staging admin login",
          "CI pipeline token",
          "Mainframe operator",
        ],
      ],
      [
        "pamRotationConfigColumnNextRotation",
        [
          "Staging admin login",
          "CI pipeline token",
          "Mainframe operator",
          "Prod DB service account",
        ],
        [
          "Prod DB service account",
          "Staging admin login",
          "CI pipeline token",
          "Mainframe operator",
        ],
      ],
    ])("sorts the %s column both ways", (label, ascending, descending) => {
      const el = render();

      clickSort(el, label);
      expect(rowNames(el)).toEqual(ascending);

      clickSort(el, label);
      expect(rowNames(el)).toEqual(descending);
    });

    it("shows the generic no-results message when the filters empty the table", () => {
      const el = render();
      chip("status").toggle("pamRotationConfigStatusPaused");
      chip("targetSystem").toggle(sysId("1"));
      fixture.detectChanges();

      expect(bodyRows(el)).toHaveLength(0);
      expect(text(el.querySelector("bit-table-v2")!)).toContain(
        "pamRotationConfigNoResultsFiltered",
      );
    });

    it("keeps the empty-state lockup, not an empty table, when there are no credentials", () => {
      const el = render([]);

      expect(el.querySelector("bit-table-v2")).toBeNull();
      expect(el.textContent).toContain("pamRotationConfigEmptyState");
    });

    describe("create action", () => {
      const BUTTON_ID = "#rotation-shell_button_new-managed-credential";

      function endSlot(el: HTMLElement): Element {
        const toolbar = el.querySelector("bit-table-v2 bit-table-toolbar")!;
        return toolbar.querySelector("bit-search")!.parentElement!.parentElement!.lastElementChild!;
      }

      it("puts the create action in the toolbar's end slot", () => {
        const el = render();

        expect(endSlot(el).children).toHaveLength(1);
        const button = endSlot(el).querySelector<HTMLButtonElement>(BUTTON_ID);
        expect(button).not.toBeNull();
        expect(text(button!)).toBe("pamRotationConfigNew");
        expect(button!.getAttribute("type")).toBe("button");
      });

      it("leaves the create action to the empty state when there are no credentials", () => {
        const el = render([]);

        expect(el.querySelector("bit-table-toolbar")).toBeNull();
        expect(el.querySelector(BUTTON_ID)).toBeNull();
        expect(el.querySelector("#managed-credentials-tab_button_new-empty")).not.toBeNull();
      });

      it("navigates to the create page from the end slot button", async () => {
        const el = render();
        const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

        el.querySelector<HTMLButtonElement>(BUTTON_ID)!.click();
        await fixture.whenStable();

        expect(navigateSpy).toHaveBeenCalledWith(
          ["..", "managed-credentials", "new"],
          expect.objectContaining({ relativeTo: expect.anything() }),
        );
      });
    });

    describe("toolbar", () => {
      function toolbar(el: HTMLElement): HTMLElement {
        return el.querySelector("bit-table-v2 bit-table-toolbar")!;
      }

      function chipKeys(root: ParentNode): (string | null)[] {
        return Array.from(root.querySelectorAll("bit-filter-menu")).map((menu) =>
          menu.getAttribute("key"),
        );
      }

      it("puts the search and every filter chip inside the table's toolbar", () => {
        const el = render();

        expect(toolbar(el)).not.toBeNull();
        expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
        expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem"]);
        expect(el.querySelectorAll("bit-search")).toHaveLength(1);
        expect(el.querySelectorAll("bit-filter-menu")).toHaveLength(2);
      });

      it("labels each chip with its unset state", () => {
        const labels = Array.from(toolbar(render()).querySelectorAll("bit-filter-menu")).map(text);

        expect(labels).toEqual([
          expect.stringMatching(/^status: all/),
          expect.stringMatching(/^pamRotationConfigColumnTargetSystem: all/),
        ]);
      });

      it("gives the search its placeholder and leaves it enabled", () => {
        const input = toolbar(render()).querySelector("bit-search input")!;

        expect(input.getAttribute("placeholder")).toBe("pamRotationConfigSearch");
        expect(input.getAttribute("type")).toBe("search");
        expect(input.hasAttribute("disabled")).toBe(false);
      });

      it("projects the collection chip into the toolbar when the rows' ciphers carry one", async () => {
        TestBed.resetTestingModule();
        targetSystemsService = makeTargetSystemsServiceStub();

        TestBed.configureTestingModule({
          imports: [ManagedCredentialsTabComponent],
          providers: [
            provideRouter([]),
            {
              provide: ActivatedRoute,
              useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
            },
            {
              provide: RotationConfigsService,
              useValue: makeConfigsServiceStub(targetSystemsService, ROWS),
            },
            { provide: TargetSystemsService, useValue: targetSystemsService },
            ...makeCipherCollectionProviders(
              [makeCipher(CIPHER_ID, ["col-1"])],
              [{ id: "col-1", name: "Engineering" } as CollectionAdminView],
            ),
            { provide: ToastService, useValue: { showToast: jest.fn() } },
            { provide: DialogService, useValue: { openSimpleDialog: jest.fn() } },
            { provide: I18nService, useValue: i18nFake },
          ],
        });

        fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;

        expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem", "collection"]);
      });

      it.each<[string, { search?: string; status?: string; targetSystem?: unknown }, string[]]>([
        ["the status chip", { status: "pamRotationConfigStatusPaused" }, ["Staging admin login"]],
        [
          "the target-system chip",
          { targetSystem: sysId("2") },
          ["Staging admin login", "Mainframe operator"],
        ],
        ["search on a credential name", { search: "mainframe" }, ["Mainframe operator"]],
        [
          "search on a target-system name",
          { search: "staging" },
          ["Staging admin login", "Mainframe operator"],
        ],
        [
          "every control at once",
          { search: "staging", status: "pamRotationConfigRotationDueBadge" },
          ["Mainframe operator"],
        ],
      ])("narrows the rows by %s", (_, filters, expected) => {
        const el = render();
        if (filters.search !== undefined) {
          component.searchControl.setValue(filters.search);
        }
        if (filters.status !== undefined) {
          chip("status").toggle(filters.status);
        }
        if (filters.targetSystem !== undefined) {
          chip("targetSystem").toggle(filters.targetSystem);
        }
        fixture.detectChanges();

        expect(rowNames(el)).toEqual(expected);
      });

      it("keeps the toolbar in place when the filters empty the table", () => {
        const el = render();
        chip("status").toggle("pamRotationConfigStatusPaused");
        chip("targetSystem").toggle(sysId("1"));
        fixture.detectChanges();

        expect(bodyRows(el)).toHaveLength(0);
        expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
        expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem"]);
      });

      it("keeps the row actions reachable from a row the toolbar narrowed to", () => {
        const el = render();
        component.searchControl.setValue("mainframe");
        fixture.detectChanges();

        expect(rowNames(el)).toEqual(["Mainframe operator"]);
        expect(menuItems(el, 0)).toContain("pamRotationConfigMarkRotated");
      });
    });
  });
});

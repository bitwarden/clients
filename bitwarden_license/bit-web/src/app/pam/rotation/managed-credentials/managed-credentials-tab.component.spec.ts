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

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { OrgCiphersService } from "../org-ciphers.service";
import { TargetSystemMethod } from "../rotation";
import type { RotationConfigView } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import {
  ORGANIZATION_ID,
  configId,
  id,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfigSealedFields,
  rotationConfig,
  sysId,
} from "../testing/rotation-builders";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string, ...args: (string | number | undefined)[]) =>
    args.some((arg) => arg != null) ? `${id}:${args.filter((arg) => arg != null).join(",")}` : id,
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

function makeAccessConnectorsProvider() {
  return {
    provide: AccessConnectorsService,
    useValue: { load: jest.fn().mockResolvedValue(undefined) },
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

function bodyRows(el: HTMLElement): Element[] {
  return Array.from(el.querySelectorAll("bit-table-v2 bit-row"));
}

function rowNames(el: HTMLElement): string[] {
  return bodyRows(el).map((row) => text(row.querySelector("button[bitLink]")!));
}

describe("ManagedCredentialsTabComponent", () => {
  let fixture: ComponentFixture<ManagedCredentialsTabComponent>;
  let component: any;
  let configsService: ReturnType<typeof makeConfigsServiceStub>;
  let targetSystemsService: ReturnType<typeof makeTargetSystemsServiceStub>;
  let toastService: { showToast: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock };
  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
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
        makeAccessConnectorsProvider(),
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
          makeAccessConnectorsProvider(),
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
        "not-connected",
        "rotation-due",
        "rotating",
        "paused",
        "manual-rotation",
        "active",
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
          makeAccessConnectorsProvider(),
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
});

describe("ManagedCredentialsTabComponent table", () => {
  let fixture: ComponentFixture<ManagedCredentialsTabComponent>;
  let configsService: ReturnType<typeof makeConfigsServiceStub>;
  let dialogService: { openSimpleDialog: jest.Mock };
  let toastService: { showToast: jest.Mock };
  let dialogResult = false;
  let router: Router;

  beforeEach(() => {
    dialogResult = false;
  });

  const NOW = Date.now();
  const DAY = 86_400_000;
  const isoFromNow = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
  const cipherOf = (label: string) => asUuid<CipherId>(id(label));

  const active = buildRotationConfigRow(
    rotationConfig({
      id: configId("1"),
      cipherId: cipherOf("c1"),
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      scheduleCron: "0 0 0 * * ?",
      rotateOnAccessEnd: true,
      sealed: rotationConfigSealedFields({ accountIdentity: "sf-integration-svc" }),
      lastRotationAt: isoFromNow(-5 * DAY),
      nextRotationAt: isoFromNow(14 * DAY + 3_600_000),
    }),
    undefined,
    "Prod DB service account",
    rotationConfigDescription(),
  );
  const paused = buildRotationConfigRow(
    rotationConfig({
      id: configId("2"),
      cipherId: cipherOf("c2"),
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      enabled: false,
      sealed: rotationConfigSealedFields({ accountIdentity: "root-rotator@meridian-prod" }),
      lastRotationAt: isoFromNow(-95 * DAY),
      nextRotationAt: isoFromNow(DAY),
    }),
    undefined,
    "Staging admin login",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, canPause: false, canResume: true }),
    }),
  );
  const rotating = buildRotationConfigRow(
    rotationConfig({ id: configId("3"), cipherId: cipherOf("c3"), hasActiveJob: true }),
    undefined,
    "CI pipeline token",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
    }),
  );
  const manualDue = buildRotationConfigRow(
    rotationConfig({
      id: configId("4"),
      cipherId: cipherOf("c4"),
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      targetSystemMethod: TargetSystemMethod.Manual,
      awaitingManualRotation: true,
      nextRotationAt: isoFromNow(-3 * DAY - 3_600_000),
    }),
    undefined,
    "Mainframe operator",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
    }),
  );
  const manualIdle = buildRotationConfigRow(
    rotationConfig({
      id: configId("5"),
      cipherId: cipherOf("c5"),
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      targetSystemMethod: TargetSystemMethod.Manual,
    }),
    undefined,
    "Legacy ledger",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
    }),
  );
  const notConnected = buildRotationConfigRow(
    rotationConfig({
      id: configId("6"),
      cipherId: cipherOf("c6"),
      targetSystemId: sysId("3"),
      targetSystemName: "Edge",
    }),
    undefined,
    "Edge firewall",
    rotationConfigDescription(),
    [],
  );
  const ROWS = [active, paused, rotating, manualDue, manualIdle, notConnected];
  const URGENCY_ORDER = [
    "Edge firewall",
    "Mainframe operator",
    "CI pipeline token",
    "Staging admin login",
    "Legacy ledger",
    "Prod DB service account",
  ];

  function render(
    rows: RotationConfigRow[] = ROWS,
    {
      ciphers = [],
      collections = [],
    }: { ciphers?: CipherView[]; collections?: CollectionAdminView[] } = {},
  ): HTMLElement {
    TestBed.resetTestingModule();
    const targetSystemsService = makeTargetSystemsServiceStub();
    configsService = makeConfigsServiceStub(targetSystemsService, rows);
    dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(dialogResult) };
    toastService = { showToast: jest.fn() };

    TestBed.configureTestingModule({
      imports: [ManagedCredentialsTabComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ organizationId: ORGANIZATION_ID }) } },
        { provide: RotationConfigsService, useValue: configsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        makeAccessConnectorsProvider(),
        ...makeCipherCollectionProviders(ciphers, collections),
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ManagedCredentialsTabComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(el: Element): string {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function isV2(el: HTMLElement): boolean {
    return el.querySelector("bit-table-v2") != null;
  }

  function headings(el: HTMLElement): string[] {
    const cells = isV2(el)
      ? el.querySelectorAll('bit-table-v2 [role="columnheader"]')
      : el.querySelectorAll("bit-table thead th");
    return Array.from(cells).map(text);
  }

  function bodyRows(el: HTMLElement): Element[] {
    return Array.from(
      isV2(el)
        ? el.querySelectorAll("bit-table-v2 bit-row")
        : el.querySelectorAll("bit-table tbody tr"),
    );
  }

  function cellTexts(el: HTMLElement): string[][] {
    const cellSelector = isV2(el) ? '[role="cell"]' : "td";
    return bodyRows(el).map((row) => Array.from(row.querySelectorAll(cellSelector)).map(text));
  }

  function rowNames(el: HTMLElement): string[] {
    return bodyRows(el).map((row) => text(row.querySelector("button[bitLink]")!));
  }

  function sortButtonLabels(el: HTMLElement): string[] {
    return isV2(el)
      ? Array.from(el.querySelectorAll('bit-table-v2 [role="columnheader"] button')).map(text)
      : Array.from(el.querySelectorAll("bit-table thead th[bitsortable]")).map(text);
  }

  function clickSort(el: HTMLElement, label: string): void {
    const headers = isV2(el)
      ? el.querySelectorAll<HTMLElement>('bit-table-v2 [role="columnheader"]')
      : el.querySelectorAll<HTMLElement>("bit-table thead th");
    Array.from(headers)
      .find((header) => text(header) === label)!
      .querySelector("button")!
      .click();
    fixture.detectChanges();
  }

  function renderedStatuses(el: HTMLElement): string[] {
    return Array.from(
      el.querySelectorAll<HTMLElement>('[id^="managed-credentials-tab_status_"]'),
    ).map((cell) => cell.querySelector("span[bitbadge]")!.textContent!.trim());
  }

  function menuItems(el: HTMLElement, rowIndex: number): string[] {
    el.querySelectorAll<HTMLButtonElement>('button[id^="managed-credentials-tab_menu-trigger_"]')[
      rowIndex
    ].click();
    fixture.detectChanges();
    const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
    return Array.from(panels[panels.length - 1].querySelectorAll("[bitmenuitem]")).map(text);
  }

  function chip(key: string): FilterMenuComponent {
    return fixture.debugElement.query(By.css(`bit-filter-menu[key="${key}"]`)).componentInstance;
  }

  it("renders the six columns of the design, in order", () => {
    expect(headings(render())).toEqual([
      "pamRotationConfigColumnItem",
      "status",
      "pamRotationConfigColumnAccount",
      "pamRotationConfigColumnLastRotated",
      "pamRotationConfigColumnNextRotation",
      "options",
    ]);
  });

  it("drops the target-system method badge and the rotate-on-access-end text", () => {
    const el = render();

    expect(el.querySelectorAll("bit-table-v2 [bitBadge]")).toHaveLength(ROWS.length);
    expect(cellTexts(el).flat().join(" ")).not.toContain("pamTargetSystemMethod");
    expect(el.querySelector('[id^="managed-credentials-tab_rotate-on-access-end_"]')).toBeNull();
  });

  it("sorts only on the item, status, last rotated and next rotation columns", () => {
    expect(sortButtonLabels(render())).toEqual([
      "pamRotationConfigColumnItem",
      "status",
      "pamRotationConfigColumnLastRotated",
      "pamRotationConfigColumnNextRotation",
    ]);
  });

  describe("item cell", () => {
    const folderRender = (rows: RotationConfigRow[] = [active]): HTMLElement =>
      render(rows, {
        ciphers: [makeCipher(cipherOf("c1"), ["col-1", "col-2"]), makeCipher(cipherOf("c2"), [])],
        collections: [
          { id: "col-1", name: "Data" } as CollectionAdminView,
          { id: "col-2", name: "Finance" } as CollectionAdminView,
        ],
      });

    it("names the credential in neutral text rather than link blue", () => {
      const link = render().querySelector<HTMLButtonElement>(
        "bit-table-v2 bit-row button[bitLink]",
      )!;

      expect(link.classList).not.toContain("tw-text-fg-brand");
      expect(link.getAttribute("tabindex")).not.toBe("-1");
    });

    it("puts the shared folders under the name, muted", async () => {
      const el = folderRender();
      await fixture.whenStable();
      fixture.detectChanges();

      const folders = el.querySelector('[id^="managed-credentials-tab_folders_"]')!;
      expect(text(folders)).toBe("Data, Finance");
      expect(folders.classList).toContain("tw-text-fg-body-subtle");
    });

    it("draws no second line for a credential outside every shared folder", async () => {
      const el = folderRender([paused]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.querySelector('[id^="managed-credentials-tab_folders_"]')).toBeNull();
    });
  });

  describe("status cell", () => {
    it("shows exactly one badge per row, in urgency order by default", () => {
      const el = render();

      expect(rowNames(el)).toEqual(URGENCY_ORDER);
      expect(renderedStatuses(el)).toEqual([
        "pamRotationConfigStatusNotConnected",
        "pamRotationConfigRotationDueBadge",
        "pamRotationConfigRotatingBadge",
        "pamRotationConfigStatusPaused",
        "pamRotationConfigStatusManualRotation",
        "active",
      ]);
      for (const cell of Array.from(
        el.querySelectorAll('[id^="managed-credentials-tab_status_"]'),
      )) {
        expect(cell.querySelectorAll("span[bitbadge]")).toHaveLength(1);
      }
    });

    it("shows a paused credential mid-rotation as rotating alone", () => {
      const pausedWhileRotating = buildRotationConfigRow(
        rotationConfig({ id: configId("8"), enabled: false, hasActiveJob: true }),
        undefined,
        "Paused mid-flight",
        rotationConfigDescription(),
      );
      const el = render([pausedWhileRotating]);

      expect(renderedStatuses(el)).toEqual(["pamRotationConfigRotatingBadge"]);
      expect(el.querySelector('[id^="managed-credentials-tab_status-paused_"]')).toBeNull();
    });

    it("opens sorted by status", () => {
      const header = Array.from(
        render().querySelectorAll<HTMLElement>('bit-table-v2 [role="columnheader"]'),
      ).find((cell) => text(cell) === "status")!;

      expect(header.getAttribute("aria-sort")).toBe("ascending");
    });
  });

  describe("account cell", () => {
    it("shows the sealed account identity", () => {
      const el = render([active]);

      expect(cellTexts(el)[0][2]).toBe("sf-integration-svc");
    });

    it("shows a dash when the sealed fields failed verification", () => {
      const unverified = buildRotationConfigRow(
        rotationConfig({ id: configId("9"), sealed: undefined }),
        undefined,
        "Unverified",
        rotationConfigDescription(),
      );

      expect(cellTexts(render([unverified]))[0][2]).toBe("—");
    });
  });

  describe("last rotated and next rotation cells", () => {
    const cellsOf = (name: string): string[] => {
      const el = render();
      return cellTexts(el)[rowNames(el).indexOf(name)];
    };

    it("reads relative to now, with the absolute date-time on hover", () => {
      const el = render([active]);
      const [last, next] = Array.from(el.querySelectorAll<HTMLElement>("bit-row [title]"));

      expect(cellTexts(el)[0].slice(3)).toEqual([
        "pamRotationRelativeDaysAgo:5",
        "pamRotationRelativeInWeeks:2",
        "",
      ]);
      expect(last.getAttribute("title")).not.toBe("");
      expect(next.getAttribute("title")).not.toBe("");
    });

    it("says never for a credential that has not rotated", () => {
      expect(cellsOf("Mainframe operator")[3]).toBe("never");
    });

    it("says a rotating credential's next rotation is in progress", () => {
      expect(cellsOf("CI pipeline token")[4]).toBe("pamRotationNextInProgress");
    });

    it("says a paused credential has no next rotation, whatever is scheduled", () => {
      expect(cellsOf("Staging admin login")[4]).toBe("pamRotationNextNone");
    });

    it("says nothing is scheduled when there is no next time", () => {
      expect(cellsOf("Legacy ledger")[4]).toBe("pamRotationNextNone");
    });

    it("reports an overdue manual rotation as due", () => {
      expect(cellsOf("Mainframe operator")[4]).toBe("pamRotationRelativeDueDaysAgo:3");
    });

    it("falls back to a date where the design shows no wording", () => {
      const sparse = buildRotationConfigRow(
        rotationConfig({
          id: configId("9"),
          lastRotationAt: isoFromNow(-3 * 3_600_000),
          nextRotationAt: isoFromNow(3 * DAY),
        }),
        undefined,
        "Sparse",
        rotationConfigDescription(),
      );
      const [, , , last, next] = cellTexts(render([sparse]))[0];

      expect(last).toMatch(/\w{3} \d{1,2}, \d{4}/);
      expect(next).toMatch(/\w{3} \d{1,2}, \d{4}/);
    });
  });

  describe("sorting", () => {
    it("reverses the status order on a second click", () => {
      const el = render();

      clickSort(el, "status");

      expect(rowNames(el)).toEqual([...URGENCY_ORDER].reverse());
    });

    it("sorts last rotated oldest first with never on top, ties by name", () => {
      const el = render();

      clickSort(el, "pamRotationConfigColumnLastRotated");

      expect(rowNames(el)).toEqual([
        "CI pipeline token",
        "Edge firewall",
        "Legacy ledger",
        "Mainframe operator",
        "Staging admin login",
        "Prod DB service account",
      ]);
    });

    it("keeps ties in name order when the direction reverses", () => {
      const el = render();

      clickSort(el, "pamRotationConfigColumnLastRotated");
      clickSort(el, "pamRotationConfigColumnLastRotated");

      expect(rowNames(el)).toEqual([
        "Prod DB service account",
        "Staging admin login",
        "CI pipeline token",
        "Edge firewall",
        "Legacy ledger",
        "Mainframe operator",
      ]);
    });

    it("sorts next rotation overdue first, then soonest, then in progress, then none", () => {
      const el = render();

      clickSort(el, "pamRotationConfigColumnNextRotation");

      expect(rowNames(el)).toEqual([
        "Mainframe operator",
        "Prod DB service account",
        "CI pipeline token",
        "Edge firewall",
        "Legacy ledger",
        "Staging admin login",
      ]);
    });

    it("breaks status ties by item name, A to Z in both directions", () => {
      const named = (name: string, n: string) =>
        buildRotationConfigRow(
          rotationConfig({ id: configId(n) }),
          undefined,
          name,
          rotationConfigDescription(),
        );
      const el = render([named("Bravo", "a"), named("Alpha", "b"), named("Charlie", "c")]);

      expect(rowNames(el)).toEqual(["Alpha", "Bravo", "Charlie"]);
      clickSort(el, "status");
      expect(rowNames(el)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });
  });

  describe("row menu", () => {
    const menuFor = (name: string): string[] => {
      const el = render();
      return menuItems(el, rowNames(el).indexOf(name));
    };

    function item(idPrefix: string): HTMLButtonElement {
      return document.querySelector<HTMLButtonElement>(`.bit-menu-panel [id^="${idPrefix}"]`)!;
    }

    it("lists rotate now, pause, edit settings, history, then remove for an active credential", () => {
      expect(menuFor("Prod DB service account")).toEqual([
        "pamRotationConfigRotateNow",
        "pamRotationConfigPauseRotation",
        "pamRotationConfigEditSettings",
        "pamRotationConfigViewHistory",
        "pamRotationConfigRemoveFromRotation",
      ]);
      expect(document.querySelectorAll(".bit-menu-panel bit-menu-divider")).toHaveLength(1);
    });

    it("offers mark as rotated first, and no rotate now, for a manual credential", () => {
      for (const name of ["Mainframe operator", "Legacy ledger"]) {
        expect(menuFor(name)).toEqual([
          "pamRotationConfigMarkRotated",
          "pamRotationConfigPauseRotation",
          "pamRotationConfigEditSettings",
          "pamRotationConfigViewHistory",
          "pamRotationConfigRemoveFromRotation",
        ]);
      }
    });

    it("explains in the item itself why a paused credential can't rotate now", () => {
      expect(menuFor("Staging admin login")).toEqual([
        "pamRotationConfigRotateNowpamRotationConfigRotateNowPaused",
        "pamRotationConfigResumeRotation",
        "pamRotationConfigEditSettings",
        "pamRotationConfigViewHistory",
        "pamRotationConfigRemoveFromRotation",
      ]);
      const locked = item("managed-credentials-tab_button_rotate-now-locked_");
      expect(locked.getAttribute("aria-disabled")).toBe("true");
      expect(locked.hasAttribute("disabled")).toBe(false);
      const reason = locked.getAttribute("aria-describedby")!;
      expect(text(document.getElementById(reason)!)).toBe("pamRotationConfigRotateNowPaused");
    });

    it("explains a rotation in progress and the locked removal, leaving pause available", () => {
      expect(menuFor("CI pipeline token")).toEqual([
        "pamRotationConfigRotateNowpamRotationConfigRotateNowInProgress",
        "pamRotationConfigPauseRotation",
        "pamRotationConfigEditSettings",
        "pamRotationConfigViewHistory",
        "pamRotationConfigRemoveFromRotationpamRotationConfigRemoveLockedReason",
      ]);
      expect(
        item("managed-credentials-tab_button_delete-locked_").getAttribute("aria-disabled"),
      ).toBe("true");
      expect(item("managed-credentials-tab_button_pause_").hasAttribute("disabled")).toBe(false);
    });

    it("explains a missing access connector even though the SDK would allow rotating", () => {
      expect(menuFor("Edge firewall")).toEqual([
        "pamRotationConfigRotateNowpamRotationConfigRotateNowNotConnected",
        "pamRotationConfigPauseRotation",
        "pamRotationConfigEditSettings",
        "pamRotationConfigViewHistory",
        "pamRotationConfigRemoveFromRotation",
      ]);
    });

    it("uses no tooltip for any reason", () => {
      menuFor("CI pipeline token");

      for (const locked of Array.from(
        document.querySelectorAll<HTMLElement>(".bit-menu-panel [aria-disabled='true']"),
      )) {
        expect(locked.getAttribute("aria-describedby")).not.toMatch(/^bit-tooltip-/);
      }
    });

    it("offers resume to a paused credential whose job is still running, under a rotating badge", () => {
      const pausedWhileRotating = buildRotationConfigRow(
        rotationConfig({ id: configId("8"), enabled: false, hasActiveJob: true }),
        undefined,
        "Paused mid-flight",
        rotationConfigDescription({
          actions: rotationConfigActions({
            canRotateNow: false,
            mutationsLocked: true,
            canPause: false,
            canResume: true,
          }),
        }),
      );
      const el = render([pausedWhileRotating]);

      expect(menuItems(el, 0)[1]).toBe("pamRotationConfigResumeRotation");
    });

    it("does not rotate when a disabled rotate now is clicked", () => {
      const el = render();
      menuItems(el, rowNames(el).indexOf("Staging admin login"));

      item("managed-credentials-tab_button_rotate-now-locked_").click();

      expect(configsService.rotateNow).not.toHaveBeenCalled();
    });

    it("opens the settings and the history from the menu", () => {
      const el = render([active]);
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
      menuItems(el, 0);

      item("managed-credentials-tab_button_edit_").click();
      expect(navigateSpy).toHaveBeenCalledWith(
        ["..", "managed-credentials", active.id],
        expect.objectContaining({ relativeTo: expect.anything() }),
      );

      menuItems(el, 0);
      item("managed-credentials-tab_button_history_").click();
      expect(navigateSpy).toHaveBeenCalledWith(
        ["..", "managed-credentials", active.id, "history"],
        expect.objectContaining({ relativeTo: expect.anything() }),
      );
    });

    it("names the row menu trigger", () => {
      const trigger = render().querySelector<HTMLButtonElement>(
        'bit-table-v2 button[id^="managed-credentials-tab_menu-trigger_"]',
      )!;

      expect(trigger.getAttribute("aria-label")).toBe("options");
    });
  });

  describe("row actions", () => {
    function menuItem(el: HTMLElement, name: string, idPrefix: string): HTMLButtonElement {
      menuItems(el, rowNames(el).indexOf(name));
      const panels = document.querySelectorAll<HTMLElement>(".bit-menu-panel");
      return panels[panels.length - 1].querySelector<HTMLButtonElement>(`[id^="${idPrefix}"]`)!;
    }

    it("rotates now and toasts that the rotation started", async () => {
      const el = render();

      menuItem(el, "Prod DB service account", "managed-credentials-tab_button_rotate-now_").click();
      await fixture.whenStable();

      expect(configsService.rotateNow).toHaveBeenCalledWith(active.config);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigRotateNowStarted",
      });
    });

    it("confirms before pausing, and pauses once confirmed", async () => {
      dialogResult = true;
      const el = render();

      menuItem(el, "Prod DB service account", "managed-credentials-tab_button_pause_").click();
      await fixture.whenStable();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamRotationConfigPauseRotation" },
          content: { key: "pamRotationConfigPauseContent" },
          acceptButtonText: { key: "pamRotationConfigPauseRotation" },
        }),
      );
      expect(configsService.pause).toHaveBeenCalledWith(active.config);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigPauseSuccess",
      });
    });

    it("says the running rotation will finish when pausing mid-rotation", async () => {
      dialogResult = true;
      const el = render();

      menuItem(el, "CI pipeline token", "managed-credentials-tab_button_pause_").click();
      await fixture.whenStable();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigPauseWhileRotatingSuccess",
      });
    });

    it("does not pause when the dialog is dismissed", async () => {
      const el = render();

      menuItem(el, "Prod DB service account", "managed-credentials-tab_button_pause_").click();
      await fixture.whenStable();

      expect(configsService.pause).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("resumes and toasts", async () => {
      const el = render();

      menuItem(el, "Staging admin login", "managed-credentials-tab_button_resume_").click();
      await fixture.whenStable();

      expect(configsService.resume).toHaveBeenCalledWith(paused.config);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigResumeSuccess",
      });
    });

    it("marks as rotated through the redesigned dialog, then toasts", async () => {
      dialogResult = true;
      const el = render();

      menuItem(el, "Mainframe operator", "managed-credentials-tab_button_record-manual_").click();
      await fixture.whenStable();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamRotationConfigMarkRotatedTitle" },
          content: { key: "pamRotationConfigMarkRotatedContent" },
          acceptButtonText: { key: "pamRotationConfigMarkRotated" },
          cancelButtonText: { key: "cancel" },
          type: "info",
        }),
      );
      expect(configsService.recordManual).toHaveBeenCalledWith(manualDue.config);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigMarkedRotated",
      });
    });

    it("keeps the removal dialog and toast as the decisions recorded them", async () => {
      dialogResult = true;
      const el = render();

      menuItem(el, "Prod DB service account", "managed-credentials-tab_button_delete_").click();
      await fixture.whenStable();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamRotationConfigDeleteConfirmTitle" },
          acceptButtonText: { key: "remove" },
        }),
      );
      expect(configsService.delete).toHaveBeenCalledWith(active.config);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamRotationConfigDeleteSuccess",
      });
    });
  });

  it("opens the edit page through the shared openEdit", () => {
    const el = render();
    const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>("bit-table-v2 bit-row button[bitLink]")!.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ["..", "managed-credentials", notConnected.id],
      expect.objectContaining({ relativeTo: expect.anything() }),
    );
  });

  it("shows the generic no-results message when the filters empty the table", () => {
    const el = render();
    chip("status").toggle("paused");
    chip("targetSystem").toggle(sysId("1"));
    fixture.detectChanges();

    expect(bodyRows(el)).toHaveLength(0);
    expect(text(el.querySelector("bit-table-v2")!)).toContain("pamRotationConfigNoResultsFiltered");
  });

  it("keeps the empty-state lockup, not an empty table, when there are no credentials", () => {
    const el = render([]);

    expect(el.querySelector("bit-table-v2")).toBeNull();
    expect(el.textContent).toContain("pamRotationConfigEmptyState");
  });

  describe("create action placement", () => {
    const BUTTON_ID = "#rotation-shell_button_new-managed-credential";

    it("leaves the create action to the rotation shell's Add menu, not the toolbar", () => {
      const el = render();

      expect(el.querySelector("bit-table-toolbar")).not.toBeNull();
      expect(el.querySelector(BUTTON_ID)).toBeNull();
      expect(text(el.querySelector("bit-table-toolbar")!)).not.toContain("pamRotationConfigNew");
    });

    it("leaves the create action to the empty state when there are no credentials", () => {
      const el = render([]);

      expect(el.querySelector("bit-table-toolbar")).toBeNull();
      expect(el.querySelector(BUTTON_ID)).toBeNull();
      expect(el.querySelector("#managed-credentials-tab_button_new-empty")).not.toBeNull();
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

    function chipValues(key: string): unknown[] {
      return fixture.debugElement
        .queryAll(By.css(`bit-filter-menu[key="${key}"] bit-filter-option`))
        .map((option) => option.componentInstance.value());
    }

    const withFolders = async (): Promise<HTMLElement> => {
      const el = render(ROWS, {
        ciphers: [
          makeCipher(cipherOf("c1"), ["col-1"]),
          makeCipher(cipherOf("c2"), ["col-2"]),
          makeCipher(cipherOf("c3"), []),
          makeCipher(cipherOf("c4"), ["col-1"]),
          makeCipher(cipherOf("c5"), []),
          makeCipher(cipherOf("c6"), []),
        ],
        collections: [
          { id: "col-1", name: "Data" } as CollectionAdminView,
          { id: "col-2", name: "Finance" } as CollectionAdminView,
        ],
      });
      await fixture.whenStable();
      fixture.detectChanges();
      return el;
    };

    it("puts the search and the chips in the design's order inside the table's toolbar", () => {
      const el = render();

      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem", "method", "trigger"]);
      expect(el.querySelectorAll("bit-filter-menu")).toHaveLength(4);
    });

    it("puts shared folders third when a credential's cipher is in one", async () => {
      const el = await withFolders();

      expect(chipKeys(toolbar(el))).toEqual([
        "status",
        "targetSystem",
        "collection",
        "method",
        "trigger",
      ]);
    });

    it("labels the chips with their names alone, with no unset label", () => {
      render();
      const chips = fixture.debugElement.queryAll(By.css("bit-filter-menu"));
      const labels = chips.map((debug) => debug.componentInstance.placeholderText());

      expect(labels).toEqual([
        "status",
        "pamRotationConfigColumnTargetSystem",
        "pamTargetSystemMethodLabel",
        "pamRotationFilterTrigger",
      ]);
      expect(chips.map((debug) => debug.componentInstance.unsetLabel())).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
    });

    it("labels the folders chip 'shared folders'", async () => {
      await withFolders();

      expect(chip("collection").placeholderText()).toBe("sharedFolders");
    });

    it("multi-selects every chip except the rotation method", async () => {
      await withFolders();

      for (const key of ["status", "targetSystem", "collection", "trigger"]) {
        expect(chip(key).multiple()).toBe(true);
      }
      expect(chip("method").multiple()).toBe(false);
    });

    it("offers the statuses in urgency order, without Failed", () => {
      render();

      expect(chipValues("status")).toEqual([
        "not-connected",
        "rotation-due",
        "rotating",
        "paused",
        "manual-rotation",
        "active",
      ]);
    });

    it("offers automatic and manual as the rotation methods", () => {
      render();

      expect(chipValues("method")).toEqual(["automatic", "manual"]);
    });

    it("offers the three rotation triggers", () => {
      render();

      expect(chipValues("trigger")).toEqual(["schedule", "access-end", "on-demand"]);
    });

    it("keeps the search placeholder", () => {
      const input = toolbar(render()).querySelector("bit-search input")!;

      expect(input.getAttribute("placeholder")).toBe("search");
      expect(input.hasAttribute("disabled")).toBe(false);
    });

    it("counts the rows, and the filtered rows", () => {
      const el = render();
      expect(text(toolbar(el))).toContain("itemCount:6");

      chip("status").toggle("paused");
      fixture.detectChanges();

      expect(text(toolbar(el))).toContain("itemCount:1");
    });

    it("matches rows with any of the selected values within one filter", () => {
      const el = render();

      chip("status").toggle("paused");
      chip("status").toggle("rotating");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(["CI pipeline token", "Staging admin login"]);
    });

    it("requires every filter at once across filters", () => {
      const el = render();

      chip("status").toggle("paused");
      chip("status").toggle("manual-rotation");
      chip("method").toggle("manual");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(["Legacy ledger"]);
    });

    it("filters on the rotation method", () => {
      const el = render();

      chip("method").toggle("manual");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(["Mainframe operator", "Legacy ledger"]);
    });

    it.each([
      ["schedule", ["Prod DB service account"]],
      ["access-end", ["Prod DB service account"]],
      [
        "on-demand",
        [
          "Edge firewall",
          "Mainframe operator",
          "CI pipeline token",
          "Staging admin login",
          "Legacy ledger",
        ],
      ],
    ])("filters on the %s rotation trigger", (trigger, expected) => {
      const el = render();

      chip("trigger").toggle(trigger);
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(expected);
    });

    it("matches a credential with both triggers under each of them", () => {
      const el = render();

      chip("trigger").toggle("schedule");
      chip("trigger").toggle("on-demand");
      fixture.detectChanges();

      expect(rowNames(el)).toHaveLength(6);
    });

    it("filters on several shared folders at once", async () => {
      const el = await withFolders();

      chip("collection").toggle("col-1");
      fixture.detectChanges();
      expect(rowNames(el)).toEqual(["Mainframe operator", "Prod DB service account"]);

      chip("collection").toggle("col-2");
      fixture.detectChanges();
      expect(rowNames(el)).toContain("Staging admin login");
    });

    it("searches the item name, the account and the shared folder", async () => {
      const el = await withFolders();
      const search = (term: string): string[] => {
        fixture.componentInstance["searchControl"].setValue(term);
        fixture.detectChanges();
        return rowNames(el);
      };

      expect(search("mainframe")).toEqual(["Mainframe operator"]);
      expect(search("SF-INTEGRATION")).toEqual(["Prod DB service account"]);
      expect(search("meridian-prod")).toEqual(["Staging admin login"]);
      expect(search("finance")).toEqual(["Staging admin login"]);
    });

    it("no longer searches the target system's name", () => {
      const el = render();

      fixture.componentInstance["searchControl"].setValue("Prod Entra");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual([]);
      expect(text(el.querySelector("bit-table-v2")!)).toContain(
        "pamRotationConfigNoResultsFiltered",
      );
    });

    it("keeps the toolbar in place when the filters empty the table", () => {
      const el = render();
      chip("status").toggle("paused");
      chip("targetSystem").toggle(sysId("1"));
      fixture.detectChanges();

      expect(bodyRows(el)).toHaveLength(0);
      expect(toolbar(el).querySelector("bit-search")).not.toBeNull();
      expect(chipKeys(toolbar(el))).toEqual(["status", "targetSystem", "method", "trigger"]);
    });

    it("keeps the row actions reachable from a row the toolbar narrowed to", () => {
      const el = render();
      fixture.componentInstance["searchControl"].setValue("mainframe");
      fixture.detectChanges();

      expect(rowNames(el)).toEqual(["Mainframe operator"]);
      expect(menuItems(el, 0)).toContain("pamRotationConfigMarkRotated");
    });
  });

  describe("loading skeleton", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    });

    afterEach(() => jest.useRealTimers());

    function renderSkeleton(): HTMLElement {
      const el = render();
      configsService.loading$.next(true);
      fixture.detectChanges();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();
      return el;
    }

    it("stands a hidden v2 skeleton table in for the list, carrying the real columns", () => {
      const loading = renderSkeleton().querySelector(
        '[data-testid="managed-credentials-loading"]',
      )!;

      expect(loading.getAttribute("aria-hidden")).toBe("true");
      expect(loading.querySelector("bit-table-v2")).not.toBeNull();
      expect(loading.querySelector("bit-table")).toBeNull();
      expect(headings(loading as HTMLElement)).toEqual([
        "pamRotationConfigColumnItem",
        "status",
        "pamRotationConfigColumnAccount",
        "pamRotationConfigColumnLastRotated",
        "pamRotationConfigColumnNextRotation",
        "options",
      ]);
      expect(loading.querySelectorAll("bit-table-v2 bit-row")).toHaveLength(5);
    });

    it("replaces the skeleton with the real rows", () => {
      const el = renderSkeleton();

      configsService.loading$.next(false);
      fixture.detectChanges();
      jest.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="managed-credentials-loading"]')).toBeNull();
      expect(rowNames(el)).toEqual(URGENCY_ORDER);
    });

    // The placeholder strip holds the toolbar's height, so the table doesn't shift when rows land.
    it("reserves the toolbar row while loading", () => {
      const placeholders = renderSkeleton().querySelectorAll(
        '[data-testid="managed-credentials-loading"] > div:first-child bit-skeleton',
      ).length;

      expect(placeholders).toBeGreaterThan(0);
    });
  });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, FilterMenuComponent, ToastService } from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";

import { OrgCiphersService } from "../org-ciphers.service";
import type { RotationConfig } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  ORGANIZATION_ID,
  id,
  rotationConfigDescription,
  rotationConfig,
} from "../testing/rotation-builders";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
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

function makeConfigsServiceStub(rows: RotationConfigRow[] = [makeRow()]) {
  return {
    loading$: new BehaviorSubject(false),
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

describe("ManagedCredentialsTabComponent", () => {
  let fixture: ComponentFixture<ManagedCredentialsTabComponent>;
  let component: any;
  let configsService: ReturnType<typeof makeConfigsServiceStub>;
  let targetSystemsService: { systems$: BehaviorSubject<unknown[]>; load: jest.Mock };
  let toastService: { showToast: jest.Mock };
  let dialogService: { openSimpleDialog: jest.Mock };

  function setupTestBed(dialogResult = true, targetSystems: unknown[] = [{ id: "ts-1" }]) {
    configsService = makeConfigsServiceStub();
    targetSystemsService = {
      systems$: new BehaviorSubject<unknown[]>(targetSystems),
      load: jest.fn().mockResolvedValue(undefined),
    };
    toastService = { showToast: jest.fn() };
    dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(dialogResult) };

    TestBed.overrideComponent(ManagedCredentialsTabComponent, {
      set: { template: "<div>stub</div>", imports: [] },
    });

    TestBed.configureTestingModule({
      imports: [ManagedCredentialsTabComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ organizationId: ORGANIZATION_ID }) } },
        { provide: RotationConfigsService, useValue: configsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        {
          provide: OrgCiphersService,
          useValue: {
            ciphers$: new BehaviorSubject([]),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of([]) },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" }) },
        },
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

    it("also loads target systems so the empty state can gate on them", () => {
      setupTestBed();
      expect(targetSystemsService.load).toHaveBeenCalledWith(ORGANIZATION_ID);
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

    it("goToTargetSystems navigates to the sibling target-systems tab", async () => {
      setupTestBed();
      const router = TestBed.inject(Router);
      const nav = jest.spyOn(router, "navigate").mockResolvedValue(true);
      await component.goToTargetSystems();
      expect(nav).toHaveBeenCalledWith(
        ["..", "target-systems"],
        expect.objectContaining({ relativeTo: expect.anything() }),
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

  describe("confirmDelete (cancelled)", () => {
    beforeEach(() => setupTestBed(false));

    it("does not delete when the dialog is cancelled", async () => {
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

  describe("confirmRecordManual (cancelled)", () => {
    beforeEach(() => setupTestBed(false));

    it("does not call recordManual when the dialog is cancelled", async () => {
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

    const rowA = makeRow({
      cipherId: cipherA,
      targetSystemName: "Prod Entra",
      enabled: true,
    });
    const rowB = makeRow({
      cipherId: cipherB,
      targetSystemName: "Staging AD",
      enabled: false,
    });
    const rowC = makeRow({
      cipherId: cipherC,
      targetSystemName: "Prod Entra",
      enabled: true,
    });

    function setupWithData(
      rows: RotationConfigRow[],
      ciphers: CipherView[],
      collections: CollectionAdminView[] = [],
    ) {
      configsService = makeConfigsServiceStub(rows);
      targetSystemsService = {
        systems$: new BehaviorSubject<unknown[]>([{ id: "ts-1" }]),
        load: jest.fn().mockResolvedValue(undefined),
      };
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
          {
            provide: OrgCiphersService,
            useValue: {
              ciphers$: new BehaviorSubject(ciphers),
              load: jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: CollectionAdminService,
            useValue: { collectionAdminViews$: () => of(collections) },
          },
          { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
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
      expect(component.targetSystemNames()).toEqual(["Prod Entra", "Staging AD"]);
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
        { id: "col-1", name: "Engineering" },
        { id: "col-2", name: "Finance" },
      ]);
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
      chip("targetSystem").toggle("Staging AD");
      fixture.detectChanges();
      expect(component.processedRows()).toHaveLength(1);
      expect(component.processedRows()[0].config.cipherId).toBe(cipherB);
    });

    it("narrows rows to the selected collection", () => {
      setupWithData(
        [rowA, rowB, rowC],
        [makeCipher(cipherA, ["col-1"]), makeCipher(cipherB, ["col-2"])],
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

    it("ANDs the chips with each other and with the search text", () => {
      setupWithData([rowA, rowB, rowC], []);
      component.searchControl.setValue("prod");
      chip("status").toggle("pamRotationConfigStatusActive");
      fixture.detectChanges();
      const ids = component.processedRows().map((r: RotationConfigRow) => r.config.cipherId);
      expect(ids.sort()).toEqual([cipherA, cipherC].sort());
    });
  });
});

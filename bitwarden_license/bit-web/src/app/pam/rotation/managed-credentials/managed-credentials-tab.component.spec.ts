import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { RotationConfigResponse } from "../responses/rotation-config.response";
import { TargetSystemMethod } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function makeConfigRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: "cfg-1",
    CipherId: "cipher-1",
    TargetSystemId: "ts-1",
    TargetSystemName: "Target",
    TargetSystemMethod: TargetSystemMethod.Automatic,
    AccountIdentity: "admin@example.com",
    TerminateSessions: false,
    ScheduleCron: null,
    RotateOnAccessEnd: false,
    Enabled: true,
    LastRotationAt: null,
    NextRotationAt: null,
    HasActiveJob: false,
    AwaitingManualRotation: false,
    ...overrides,
  };
}

function makeRow(configOverrides: Record<string, unknown> = {}): RotationConfigRow {
  const config = new RotationConfigResponse(makeConfigRaw(configOverrides));
  return buildRotationConfigRow(config, undefined, "My Cipher");
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
        { provide: ActivatedRoute, useValue: { params: of({ organizationId: "org-1" }) } },
        { provide: RotationConfigsService, useValue: configsService },
        { provide: TargetSystemsService, useValue: targetSystemsService },
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
      expect(configsService.load).toHaveBeenCalledWith("org-1");
    });

    it("also loads target systems so the empty state can gate on them", () => {
      setupTestBed();
      expect(targetSystemsService.load).toHaveBeenCalledWith("org-1");
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
      const row = makeRow({ Enabled: false });
      await component.resume(row);
      expect(configsService.resume).toHaveBeenCalledWith(row.config);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });
});

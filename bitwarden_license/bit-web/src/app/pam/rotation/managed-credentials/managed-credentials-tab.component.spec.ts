import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import type { RotationConfig } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import {
  ORGANIZATION_ID,
  configId,
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

function makeConfigsServiceStub(rows: RotationConfigRow[] = [makeRow()]) {
  return {
    loading$: new BehaviorSubject(false),
    loadError$: new BehaviorSubject<unknown | null>(null),
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

  function setupTestBed(
    dialogResult = true,
    targetSystems: unknown[] = [{ id: "ts-1" }],
    renderTemplate = false,
  ) {
    configsService = makeConfigsServiceStub();
    targetSystemsService = {
      systems$: new BehaviorSubject<unknown[]>(targetSystems),
      load: jest.fn().mockResolvedValue(undefined),
    };
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

  describe("load error state", () => {
    it("renders the load-error state instead of the empty state", () => {
      setupTestBed(true, [], true);
      configsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-rotation-load-error")).not.toBeNull();
      expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
      expect(el.textContent).not.toContain("pamNoTargetSystemsYetTitle");
      expect(el.textContent).not.toContain("pamRotationConfigEmptyState");
    });

    it("retries both loads from the error state", async () => {
      setupTestBed(true, [], true);
      configsService.loadError$.next(new Error("boom"));
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>("#rotation-load-error_button_retry")!
        .click();
      await fixture.whenStable();

      expect(configsService.load).toHaveBeenCalledTimes(2);
      expect(targetSystemsService.load).toHaveBeenCalledTimes(2);
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
});

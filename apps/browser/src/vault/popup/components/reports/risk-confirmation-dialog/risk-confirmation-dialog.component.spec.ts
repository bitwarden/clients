import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

import {
  RiskConfirmationDialogComponent,
  RiskConfirmationDialogData,
  RiskConfirmationDialogResult,
} from "./risk-confirmation-dialog.component";

type RiskRow = {
  icon: string;
  variant: string;
  labelKey: string;
  valueLabel: string;
};

async function createComponent(
  data: RiskConfirmationDialogData,
  locale = "en",
): Promise<{
  component: RiskConfirmationDialogComponent;
  dialogRef: { close: jest.Mock };
  i18n: { t: jest.Mock; translationLocale: string };
}> {
  const dialogRef = { close: jest.fn() } as unknown as DialogRef<RiskConfirmationDialogResult>;
  const i18n = {
    t: jest.fn((key: string, ...args: string[]) =>
      args.length > 0 ? `${key}:${args.join(",")}` : key,
    ),
    translate: (key: string) => key,
    translationLocale: locale,
  };

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [RiskConfirmationDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: dialogRef },
      { provide: I18nService, useValue: i18n },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(RiskConfirmationDialogComponent);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    dialogRef: dialogRef as unknown as { close: jest.Mock },
    i18n,
  };
}

function baseData(overrides: Partial<RiskConfirmationDialogData> = {}): RiskConfirmationDialogData {
  return {
    titleKey: "dismissThisRisk",
    descriptionKey: "dismissThisRiskDesc",
    acceptButtonKey: "yesDismissRisk",
    acceptButtonType: "primary",
    risks: { exposedBreaches: 0, reuseCount: 1, weak: false },
    ...overrides,
  };
}

describe("RiskConfirmationDialogComponent", () => {
  describe("button actions", () => {
    it("accept() closes the dialog with Accepted", async () => {
      const { component, dialogRef } = await createComponent(baseData());

      (component as any).accept();

      expect(dialogRef.close).toHaveBeenCalledWith(RiskConfirmationDialogResult.Accepted);
    });

    it("cancel() closes the dialog with Canceled", async () => {
      const { component, dialogRef } = await createComponent(baseData());

      (component as any).cancel();

      expect(dialogRef.close).toHaveBeenCalledWith(RiskConfirmationDialogResult.Canceled);
    });
  });

  describe("riskRows", () => {
    it("is empty when all risks are zero/false", async () => {
      const { component } = await createComponent(baseData());

      expect((component as any).riskRows as RiskRow[]).toEqual([]);
    });

    it("includes a danger exposed row when exposedBreaches > 0", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 3, reuseCount: 1, weak: false } }),
      );

      expect((component as any).riskRows as RiskRow[]).toEqual([
        {
          icon: "bwi-error",
          variant: "danger",
          labelKey: "riskExposedLabel",
          valueLabel: "riskNTimes:3",
        },
      ]);
    });

    it("includes a warning weak row when weak is true", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 0, reuseCount: 1, weak: true } }),
      );

      expect((component as any).riskRows as RiskRow[]).toEqual([
        { icon: "bwi-warning", variant: "warning", labelKey: "weak", valueLabel: "yes" },
      ]);
    });

    it("does NOT include a reused row when reuseCount === 1", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 0, reuseCount: 1, weak: false } }),
      );

      expect((component as any).riskRows as RiskRow[]).toEqual([]);
    });

    it("includes a primary reused row when reuseCount > 1", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 0, reuseCount: 4, weak: false } }),
      );

      expect((component as any).riskRows as RiskRow[]).toEqual([
        {
          icon: "bwi-refresh",
          variant: "primary",
          labelKey: "riskReusedLabel",
          valueLabel: "riskNTimes:4",
        },
      ]);
    });

    it("emits rows in order exposed → weak → reused when all conditions apply", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 2, reuseCount: 5, weak: true } }),
      );

      expect((component as any).riskRows as RiskRow[]).toEqual([
        {
          icon: "bwi-error",
          variant: "danger",
          labelKey: "riskExposedLabel",
          valueLabel: "riskNTimes:2",
        },
        { icon: "bwi-warning", variant: "warning", labelKey: "weak", valueLabel: "yes" },
        {
          icon: "bwi-refresh",
          variant: "primary",
          labelKey: "riskReusedLabel",
          valueLabel: "riskNTimes:5",
        },
      ]);
    });

    it("formats large counts using the i18nService translation locale", async () => {
      const { component } = await createComponent(
        baseData({ risks: { exposedBreaches: 1234, reuseCount: 1, weak: false } }),
        "de-DE",
      );

      const rows = (component as any).riskRows as RiskRow[];
      // German locale uses a period as thousands separator.
      expect(rows[0].valueLabel).toBe("riskNTimes:1.234");
    });
  });

  describe("open()", () => {
    it("calls dialogService.open with the component, data, and a CenterPositionStrategy", () => {
      const dialogService = { open: jest.fn() } as unknown as DialogService;
      const data = baseData();

      RiskConfirmationDialogComponent.open(dialogService, data);

      expect(dialogService.open).toHaveBeenCalledWith(
        RiskConfirmationDialogComponent,
        expect.objectContaining({
          data,
          positionStrategy: expect.any(CenterPositionStrategy),
        }),
      );
    });
  });
});

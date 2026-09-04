import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SelectComponent } from "@bitwarden/components";

import { QuartzSchedulePreset } from "./rotation";
import {
  RotationScheduleInputComponent,
  ScheduleIntervalUnit,
  ScheduleMode,
  SCHEDULE_INTERVAL_MODE,
} from "./rotation-schedule-input.component";
import { RotationSdkService } from "./rotation-sdk.service";

/**
 * The preset table as the SDK defines it.
 *
 * Duplicated here deliberately: these tests are about the component's wiring — that it asks the
 * SDK, awaits, and lands the answer on the right control — not about the mapping itself, which is
 * covered by `preset_for_cron` in bitwarden-pam. Stubbing keeps them synchronous-ish and off WASM.
 */
const PRESET_CRONS: Record<string, string> = {
  hourly: "0 0 * * * ?",
  every6_hours: "0 0 */6 * * ?",
  daily: "0 0 0 * * ?",
  weekly: "0 0 0 ? * SUN",
  monthly: "0 0 0 1 * ?",
};

function scheduleStub(): Pick<
  RotationSdkService,
  "presetForCron" | "cronForPreset" | "isLikelyQuartzCron"
> {
  return {
    presetForCron: jest.fn(async (cron: string | null) => {
      if (cron == null || cron.trim() === "") {
        return QuartzSchedulePreset.None;
      }
      const match = Object.entries(PRESET_CRONS).find(([, expr]) => expr === cron.trim());
      return (match?.[0] as QuartzSchedulePreset) ?? QuartzSchedulePreset.Custom;
    }),
    cronForPreset: jest.fn(async (preset: QuartzSchedulePreset) => PRESET_CRONS[preset] ?? null),
    // 6- or 7-field, Quartz's character set — enough for the component's error branch.
    isLikelyQuartzCron: jest.fn(async (value: string) => {
      const fields = value.trim().split(/\s+/);
      return (
        fields.length >= 6 &&
        fields.length <= 7 &&
        fields.every((f) => /^[0-9A-Za-z*/,\-?#LW]+$/.test(f))
      );
    }),
  };
}

describe("RotationScheduleInputComponent", () => {
  let fixture: ComponentFixture<RotationScheduleInputComponent>;
  let component: RotationScheduleInputComponent;

  /** Outer FormControl wired into the CVA. */
  let outerControl: FormControl<string | null>;

  const i18nService = {
    t: (key: string, p1?: string, p2?: string, p3?: string) =>
      [key, p1, p2, p3].filter((part) => part != null).join(":"),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationScheduleInputComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: RotationSdkService, useValue: scheduleStub() },
      ],
    })
      .overrideComponent(RotationScheduleInputComponent, {
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RotationScheduleInputComponent);
    component = fixture.componentInstance;

    // Wire the CVA manually instead of using a host component.
    outerControl = new FormControl<string | null>(null);
    component.registerOnChange((v) => outerControl.setValue(v));
    component.registerOnTouched(() => {});

    fixture.detectChanges();
    // The component resolves its preset table from the SDK on construction.
    await fixture.whenStable();
  });

  /** Convenience access to the protected preset form control. */
  function presetCtrl(): {
    value: ScheduleMode;
    setValue: (v: ScheduleMode, opts?: { emitEvent?: boolean }) => void;
  } {
    return (
      component as unknown as { presetControl: typeof presetCtrl extends () => infer R ? R : never }
    ).presetControl as ReturnType<typeof presetCtrl>;
  }

  /** Convenience access to the protected custom form control. */
  function customCtrl(): {
    value: string;
    setValue: (v: string, opts?: { emitEvent?: boolean }) => void;
  } {
    return (
      component as unknown as { customControl: typeof customCtrl extends () => infer R ? R : never }
    ).customControl as ReturnType<typeof customCtrl>;
  }

  /** Convenience access to the protected interval builder controls. */
  function protectedControl<T>(name: string): FormControl<T> {
    return (component as unknown as Record<string, FormControl<T>>)[name];
  }

  const intervalCountCtrl = () => protectedControl<number | null>("intervalCountControl");
  const intervalUnitCtrl = () => protectedControl<ScheduleIntervalUnit>("intervalUnitControl");
  const intervalTimeCtrl = () => protectedControl<string>("intervalTimeControl");

  function buildInterval(unit: ScheduleIntervalUnit, count: number | null, time: string): void {
    presetCtrl().setValue(SCHEDULE_INTERVAL_MODE);
    intervalUnitCtrl().setValue(unit);
    intervalCountCtrl().setValue(count);
    intervalTimeCtrl().setValue(time);
    fixture.detectChanges();
  }

  function hintTexts(): (string | undefined)[] {
    return [...fixture.nativeElement.querySelectorAll("bit-hint")].map((hint: HTMLElement) =>
      hint.textContent?.trim(),
    );
  }

  // ---- writeValue (reverse-map) ----

  it("maps null to None preset", async () => {
    component.writeValue(null);
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.None);
  });

  it("maps the hourly cron to Hourly preset", async () => {
    component.writeValue(PRESET_CRONS.hourly);
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Hourly);
  });

  it("maps the daily cron to Daily preset", async () => {
    component.writeValue(PRESET_CRONS.daily);
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Daily);
  });

  it("maps a custom cron to Custom preset", async () => {
    component.writeValue("0 */15 * * * ?");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Custom);
  });

  it("stores the custom cron text in the custom control on writeValue", async () => {
    component.writeValue("0 0 */2 * * ?");
    await fixture.whenStable();
    expect(customCtrl().value).toBe("0 0 */2 * * ?");
  });

  // ---- preset selection emits preset cron ----

  it("selecting the Daily preset emits the daily cron", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Daily);
    fixture.detectChanges();
    expect(outerControl.value).toBe(PRESET_CRONS.daily);
  });

  it("selecting the None preset emits null", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Daily);
    presetCtrl().setValue(QuartzSchedulePreset.None);
    fixture.detectChanges();
    expect(outerControl.value).toBeNull();
  });

  it("selecting Weekly emits the weekly cron", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Weekly);
    fixture.detectChanges();
    expect(outerControl.value).toBe(PRESET_CRONS.weekly);
  });

  // ---- custom preset emits raw text ----

  it("custom cron text is emitted to the outer control", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("0 0 */2 * * ?");
    await fixture.whenStable();
    fixture.detectChanges();
    expect(outerControl.value).toBe("0 0 */2 * * ?");
  });

  it("empty custom text emits null", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("   ");
    await fixture.whenStable();
    fixture.detectChanges();
    expect(outerControl.value).toBeNull();
  });

  // ---- validation ----

  it("valid preset (non-custom) returns no validation error", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Weekly);
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("None preset returns no validation error", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.None);
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("invalid custom cron produces invalidCron validation error", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("not-a-cron");
    await fixture.whenStable();
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toMatchObject({
      invalidCron: { message: "pamRotationScheduleInvalidCron" },
    });
  });

  it("valid 6-field custom cron returns no validation error", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("0 0 */2 * * ?");
    await fixture.whenStable();
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("empty custom field (Custom preset) returns no validation error", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("");
    await fixture.whenStable();
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  // ---- timezone hint ----

  it("renders the timezone hint under the preset select", () => {
    expect(hintTexts()).toContain("pamRotationScheduleTimezoneHint");
  });

  it("keeps the timezone hint when the Custom preset is selected", async () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    await fixture.whenStable();
    fixture.detectChanges();
    const hints = hintTexts();
    expect(hints).toContain("pamRotationScheduleTimezoneHint");
    expect(hints).toContain("pamRotationScheduleCustomHint");
  });

  // ---- interval builder: composition ----

  it("every 1 day at 00:00 emits the midnight daily expression", () => {
    buildInterval(ScheduleIntervalUnit.Days, 1, "00:00");
    expect(outerControl.value).toBe("0 0 0 * * ?");
  });

  it("every 1 day at 02:30 emits an unstepped day-of-month expression", () => {
    buildInterval(ScheduleIntervalUnit.Days, 1, "02:30");
    expect(outerControl.value).toBe("0 30 2 * * ?");
  });

  it("every 7 days at 02:00 emits a stepped day-of-month expression", () => {
    buildInterval(ScheduleIntervalUnit.Days, 7, "02:00");
    expect(outerControl.value).toBe("0 0 2 1/7 * ?");
  });

  it("every 30 days at 23:15 emits a stepped day-of-month expression", () => {
    buildInterval(ScheduleIntervalUnit.Days, 30, "23:15");
    expect(outerControl.value).toBe("0 15 23 1/30 * ?");
  });

  it("every 1 month at 00:00 emits the monthly expression", () => {
    buildInterval(ScheduleIntervalUnit.Months, 1, "00:00");
    expect(outerControl.value).toBe("0 0 0 1 * ?");
  });

  it("every 3 months at 02:00 emits a stepped month expression", () => {
    buildInterval(ScheduleIntervalUnit.Months, 3, "02:00");
    expect(outerControl.value).toBe("0 0 2 1 1/3 ?");
  });

  it("every 12 months at 06:45 emits a stepped month expression", () => {
    buildInterval(ScheduleIntervalUnit.Months, 12, "06:45");
    expect(outerControl.value).toBe("0 45 6 1 1/12 ?");
  });

  // ---- interval builder: round-trip ----

  it("maps a stepped day-of-month cron back into the day builder", async () => {
    component.writeValue("0 0 2 1/7 * ?");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(SCHEDULE_INTERVAL_MODE);
    expect(intervalUnitCtrl().value).toBe(ScheduleIntervalUnit.Days);
    expect(intervalCountCtrl().value).toBe(7);
    expect(intervalTimeCtrl().value).toBe("02:00");
  });

  it("maps a stepped month cron back into the month builder", async () => {
    component.writeValue("0 0 2 1 1/3 ?");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(SCHEDULE_INTERVAL_MODE);
    expect(intervalUnitCtrl().value).toBe(ScheduleIntervalUnit.Months);
    expect(intervalCountCtrl().value).toBe(3);
    expect(intervalTimeCtrl().value).toBe("02:00");
  });

  it("maps an unstepped daily cron at a non-midnight time back into the day builder", async () => {
    component.writeValue("0 30 2 * * ?");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(SCHEDULE_INTERVAL_MODE);
    expect(intervalUnitCtrl().value).toBe(ScheduleIntervalUnit.Days);
    expect(intervalCountCtrl().value).toBe(1);
    expect(intervalTimeCtrl().value).toBe("02:30");
  });

  it("keeps the daily preset rather than opening the builder", async () => {
    component.writeValue(PRESET_CRONS.daily);
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Daily);
  });

  it("keeps the monthly preset rather than opening the builder", async () => {
    component.writeValue(PRESET_CRONS.monthly);
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Monthly);
  });

  it("leaves the interval controls at their defaults for a custom cron", async () => {
    component.writeValue("0 0 */4 * * ?");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Custom);
    expect(customCtrl().value).toBe("0 0 */4 * * ?");
    expect(intervalUnitCtrl().value).toBe(ScheduleIntervalUnit.Days);
    expect(intervalCountCtrl().value).toBe(1);
    expect(intervalTimeCtrl().value).toBe("00:00");
  });

  it("falls through to Custom for a weekday cron the builder cannot represent", async () => {
    component.writeValue("0 0 2 ? * MON-FRI");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Custom);
    expect(customCtrl().value).toBe("0 0 2 ? * MON-FRI");
  });

  it("falls through to Custom for a seven-field cron", async () => {
    component.writeValue("0 0 2 1/7 * ? 2027");
    await fixture.whenStable();
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Custom);
    expect(customCtrl().value).toBe("0 0 2 1/7 * ? 2027");
  });

  // ---- interval builder: validation ----

  it("a complete interval returns no validation error", () => {
    buildInterval(ScheduleIntervalUnit.Days, 7, "02:00");
    expect(component.validate({ value: outerControl.value } as never)).toBeNull();
  });

  it("a cleared count produces invalidInterval and emits null", () => {
    buildInterval(ScheduleIntervalUnit.Days, null, "02:00");
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
    expect(outerControl.value).toBeNull();
  });

  it("a day count beyond 31 produces invalidInterval", () => {
    buildInterval(ScheduleIntervalUnit.Days, 32, "02:00");
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
  });

  it("a month count beyond 12 produces invalidInterval", () => {
    buildInterval(ScheduleIntervalUnit.Months, 13, "02:00");
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
  });

  it("a cleared time produces invalidInterval", () => {
    buildInterval(ScheduleIntervalUnit.Days, 7, "");
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
  });

  it("switching from days to months puts an out-of-range count in error", () => {
    buildInterval(ScheduleIntervalUnit.Days, 20, "02:00");
    intervalUnitCtrl().setValue(ScheduleIntervalUnit.Months);
    fixture.detectChanges();
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
  });

  // ---- interval builder: rendering ----

  it("offers the interval option alongside the seven presets", () => {
    const select: SelectComponent<ScheduleMode> = fixture.debugElement.query(
      By.directive(SelectComponent),
    ).componentInstance;
    expect(select.items()?.map((option) => option.value)).toEqual([
      QuartzSchedulePreset.None,
      QuartzSchedulePreset.Hourly,
      QuartzSchedulePreset.Every6Hours,
      QuartzSchedulePreset.Daily,
      QuartzSchedulePreset.Weekly,
      QuartzSchedulePreset.Monthly,
      SCHEDULE_INTERVAL_MODE,
      QuartzSchedulePreset.Custom,
    ]);
  });

  it("renders the builder fields only once the interval mode is selected", () => {
    const ids = [
      "#rotation-schedule-input_input_interval-count",
      "#rotation-schedule-input_select_interval-unit",
      "#rotation-schedule-input_input_interval-time",
    ];
    ids.forEach((id) => expect(fixture.nativeElement.querySelector(id)).toBeNull());

    presetCtrl().setValue(SCHEDULE_INTERVAL_MODE);
    fixture.detectChanges();

    ids.forEach((id) => expect(fixture.nativeElement.querySelector(id)).not.toBeNull());
  });

  it("puts a fractional count in error on the count field itself", () => {
    buildInterval(ScheduleIntervalUnit.Days, 1.5, "02:00");
    expect(intervalCountCtrl().errors).toMatchObject({
      notWholeNumber: { message: "pamRotationScheduleIntervalCountWholeNumber" },
    });
    expect(component.validate({ value: outerControl.value } as never)).toMatchObject({
      invalidInterval: { message: "pamRotationScheduleInvalidInterval" },
    });
  });

  it("renders the count error once the field is blurred", () => {
    buildInterval(ScheduleIntervalUnit.Days, 50, "02:00");
    const count: HTMLInputElement = fixture.nativeElement.querySelector(
      "#rotation-schedule-input_input_interval-count",
    );
    count.dispatchEvent(new Event("blur"));
    fixture.detectChanges();

    expect(count.closest("bit-form-field")?.querySelector("bit-error")).not.toBeNull();
  });

  it("renders the time error once the field is blurred", () => {
    buildInterval(ScheduleIntervalUnit.Days, 7, "");
    const time: HTMLInputElement = fixture.nativeElement.querySelector(
      "#rotation-schedule-input_input_interval-time",
    );
    time.dispatchEvent(new Event("blur"));
    fixture.detectChanges();

    expect(time.closest("bit-form-field")?.querySelector("bit-error")).not.toBeNull();
  });

  // ---- plain-English echo ----

  function echoElement(): HTMLElement {
    return fixture.nativeElement.querySelector("#rotation-schedule-input_status_echo");
  }

  function echoText(): string {
    return echoElement().textContent?.trim() ?? "";
  }

  async function selectCustom(cron: string): Promise<void> {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue(cron);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("renders the echo as a polite live region", () => {
    const echo = echoElement();
    expect(echo).not.toBeNull();
    expect(echo.getAttribute("role")).toBe("status");
    expect(echo.getAttribute("aria-live")).toBe("polite");
  });

  it("describes the None preset", () => {
    presetCtrl().setValue(QuartzSchedulePreset.None);
    fixture.detectChanges();
    expect(echoText()).toBe("pamRotationScheduleEchoNone");
  });

  it("describes the Daily preset", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Daily);
    fixture.detectChanges();
    expect(echoText()).toBe("pamRotationScheduleEchoDaily");
  });

  it("describes the Weekly preset", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Weekly);
    fixture.detectChanges();
    expect(echoText()).toBe("pamRotationScheduleEchoWeekly");
  });

  it("describes an interval with its count, its unit label and its time", () => {
    buildInterval(ScheduleIntervalUnit.Days, 7, "02:00");
    expect(echoText()).toBe(
      "pamRotationScheduleEchoInterval:7:pamRotationScheduleIntervalUnitDays:02:00",
    );
  });

  it("says nothing about an incomplete interval", () => {
    buildInterval(ScheduleIntervalUnit.Days, null, "02:00");
    expect(echoText()).toBe("");
  });

  it("echoes a well-shaped custom expression verbatim", async () => {
    await selectCustom("0 0 */4 * * ?");
    expect(echoText()).toBe("pamRotationScheduleEchoCustom:0 0 */4 * * ?");
  });

  it("says nothing about a malformed custom expression", async () => {
    await selectCustom("not-a-cron");
    expect(echoElement()).not.toBeNull();
    expect(echoText()).toBe("");
  });

  it("says nothing about an empty custom expression", async () => {
    await selectCustom("   ");
    expect(echoText()).toBe("");
  });

  // An OnPush component with no inputs only repaints what it marks, so auto-detection is the
  // assertion here: without markForCheck the saved schedule never reaches the view.
  it("shows the saved schedule's sentence without the control being touched", async () => {
    fixture.autoDetectChanges();
    component.writeValue(PRESET_CRONS.monthly);
    await fixture.whenStable();
    expect(echoText()).toBe("pamRotationScheduleEchoMonthly");
  });

  it("shows a saved custom expression without the control being touched", async () => {
    fixture.autoDetectChanges();
    component.writeValue("0 0 */4 * * ?");
    await fixture.whenStable();
    expect(echoText()).toBe("pamRotationScheduleEchoCustom:0 0 */4 * * ?");
  });
});

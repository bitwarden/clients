import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { QuartzSchedulePreset } from "./rotation";
import { RotationScheduleInputComponent } from "./rotation-schedule-input.component";
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

  const i18nService = { t: (key: string) => key };

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
    value: QuartzSchedulePreset;
    setValue: (v: QuartzSchedulePreset, opts?: { emitEvent?: boolean }) => void;
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
});

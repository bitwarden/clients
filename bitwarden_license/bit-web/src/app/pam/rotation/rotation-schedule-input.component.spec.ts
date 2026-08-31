import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RotationScheduleInputComponent } from "./rotation-schedule-input.component";

describe("RotationScheduleInputComponent", () => {
  let fixture: ComponentFixture<RotationScheduleInputComponent>;
  let component: RotationScheduleInputComponent;

  /** Outer FormControl wired into the CVA. */
  let outerControl: FormControl<string | null>;

  const i18nService = { t: (key: string) => key };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationScheduleInputComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
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

  // ---- writeValue (reverse-map) ----

  it("maps null to None preset", () => {
    component.writeValue(null);
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.None);
  });

  it("maps the hourly cron to Hourly preset", () => {
    component.writeValue(PRESET_CRONS.hourly);
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Hourly);
  });

  it("maps the daily cron to Daily preset", () => {
    component.writeValue(PRESET_CRONS.daily);
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Daily);
  });

  it("maps a custom cron to Custom preset", () => {
    component.writeValue("0 */15 * * * ?");
    expect(presetCtrl().value).toBe(QuartzSchedulePreset.Custom);
  });

  it("stores the custom cron text in the custom control on writeValue", () => {
    component.writeValue("0 0 */2 * * ?");
    expect(customCtrl().value).toBe("0 0 */2 * * ?");
  });

  // ---- preset selection emits preset cron ----

  it("selecting the Daily preset emits the daily cron", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Daily);
    fixture.detectChanges();
    expect(outerControl.value).toBe(PRESET_CRONS.daily);
  });

  it("selecting the None preset emits null", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Daily);
    presetCtrl().setValue(QuartzSchedulePreset.None);
    fixture.detectChanges();
    expect(outerControl.value).toBeNull();
  });

  it("selecting Weekly emits the weekly cron", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Weekly);
    fixture.detectChanges();
    expect(outerControl.value).toBe(PRESET_CRONS.weekly);
  });

  // ---- custom preset emits raw text ----

  it("custom cron text is emitted to the outer control", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("0 0 */2 * * ?");
    fixture.detectChanges();
    expect(outerControl.value).toBe("0 0 */2 * * ?");
  });

  it("empty custom text emits null", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("   ");
    fixture.detectChanges();
    expect(outerControl.value).toBeNull();
  });

  // ---- validation ----

  it("valid preset (non-custom) returns no validation error", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Weekly);
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("None preset returns no validation error", () => {
    presetCtrl().setValue(QuartzSchedulePreset.None);
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("invalid custom cron produces invalidCron validation error", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("not-a-cron");
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toMatchObject({
      invalidCron: { message: "pamRotationScheduleInvalidCron" },
    });
  });

  it("valid 6-field custom cron returns no validation error", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("0 0 */2 * * ?");
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });

  it("empty custom field (Custom preset) returns no validation error", () => {
    presetCtrl().setValue(QuartzSchedulePreset.Custom);
    customCtrl().setValue("");
    fixture.detectChanges();
    const errors = component.validate({ value: outerControl.value } as never);
    expect(errors).toBeNull();
  });
});

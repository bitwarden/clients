import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import {
  type RequestDurationOption,
  type RequestWindowFormValue,
  composeRequestWindow,
  defaultRequestWindow,
  formatDuration,
  requestDurationOptions,
  toDateInputValue,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { REQUEST_WINDOW_ERROR_KEY } from "./request-access-window.validators";
import { RequestWindowFieldsComponent } from "./request-window-fields.component";

/** Tomorrow, anchored to the real clock, since the window validator rejects an ended window. */
const futureDate = toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RequestWindowFieldsComponent],
  template: `
    <app-pam-request-window-fields
      [formControl]="window"
      [durationOptions]="durationOptions"
      [defaultSeconds]="defaultSeconds"
      [maxWindowSeconds]="maxWindowSeconds"
      [openedAt]="openedAt"
    />
  `,
})
class HostComponent {
  readonly window = new FormControl<RequestWindowFormValue | null>(null);
  durationOptions: readonly RequestDurationOption[] = [];
  defaultSeconds = 3600;
  maxWindowSeconds: number | null = null;
  openedAt = new Date();
}

describe("RequestWindowFieldsComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let fields: RequestWindowFieldsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  /** Seeds the window the way the sheet does: from now, for the rule's default duration. */
  async function create({ defaultSeconds = 3600, maxSeconds = 3 * 86400 } = {}): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.durationOptions = requestDurationOptions(maxSeconds, defaultSeconds);
    host.defaultSeconds = defaultSeconds;
    host.maxWindowSeconds = maxSeconds;
    host.window.setValue(defaultRequestWindow(host.openedAt, defaultSeconds));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fields = fixture.debugElement.query(By.directive(RequestWindowFieldsComponent))
      .componentInstance as RequestWindowFieldsComponent;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function useCustomEnd(): Promise<void> {
    fields["endDuration"].setValue("custom");
    await settle();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function endFieldError(): HTMLElement | null {
    return (query("#pam-cipher-view-banner_input_end")
      ?.closest("bit-form-field")
      ?.querySelector("bit-error") ?? null) as HTMLElement | null;
  }

  function spanSeconds(): number {
    const window = composeRequestWindow(host.window.value!);
    return (window!.end.getTime() - window!.start.getTime()) / 1000;
  }

  describe("the presets", () => {
    it("opens on the now slot and the rule's default duration", async () => {
      await create();

      expect(fields["startSlot"].value).toBe(fields["form"].controls.startTime.value);
      expect(fields["endDuration"].value).toBe("3600");
      expect(spanSeconds()).toBe(3600);
      expect(query("#pam-cipher-view-banner_select_end")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_input_end")).toBeNull();
      expect(query("[data-testid='request-window-summary']")?.textContent).toContain(
        "requestAccessModalWindowSummary",
      );
    });

    it("moves the end when another duration is picked", async () => {
      await create();

      fields["endDuration"].setValue(String(86400));

      expect(spanSeconds()).toBe(86400);
    });

    it("keeps the duration when the start date moves, snapping the start to the next slot", async () => {
      await create();
      fields["endDuration"].setValue(String(4 * 3600));
      fields["form"].controls.startTime.setValue("10:10");

      fields["form"].controls.startDate.setValue(futureDate);

      expect(fields["form"].controls.startTime.value).toBe("10:30");
      expect(fields["startSlot"].value).toBe("10:30");
      expect(spanSeconds()).toBe(4 * 3600);
    });

    it("leaves a custom end alone when the start moves", async () => {
      await create();
      fields["endDuration"].setValue("custom");
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "17:00",
      });

      fields["form"].controls.startTime.setValue("11:00");

      expect(fields["form"].controls.endTime.value).toBe("17:00");
    });

    it("returns from a custom end to the nearest duration", async () => {
      await create();
      fields["endDuration"].setValue("custom");
      const [year, month, day] = futureDate.split("-").map(Number);
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: toDateInputValue(new Date(year, month - 1, day + 1)),
        endTime: "05:00",
      });

      fields["showEndPresets"]();

      expect(fields["customEnd"]()).toBe(false);
      expect(fields["endDuration"].value).toBe(String(86400));
      expect(spanSeconds()).toBe(86400);
    });

    it("swaps the start slot for a time input and back", async () => {
      await create();

      fields["startSlot"].setValue("custom");
      fixture.detectChanges();
      expect(query("#pam-cipher-view-banner_input_start")).not.toBeNull();
      expect(query("#pam-cipher-view-banner_select_start")).toBeNull();

      fields["showStartPresets"]();
      fixture.detectChanges();
      expect(query("#pam-cipher-view-banner_select_start")).not.toBeNull();
      expect(fields["startSlot"].value).toBe(fields["form"].controls.startTime.value);
    });
  });

  describe("the date pickers' floors", () => {
    it("floors the start date picker at the day the sheet opened", async () => {
      // `min` is only an affordance; reactive forms never read ValidityState.rangeUnderflow.
      await create();

      const date = query("#pam-cipher-view-banner_input_start-date") as HTMLInputElement | null;
      expect(date?.getAttribute("min")).toBe(toDateInputValue(host.openedAt));
      expect(fields["form"].controls.startDate.value).toBe(date?.getAttribute("min"));
    });

    it("floors the end date picker at the chosen start date", async () => {
      await create();
      await useCustomEnd();

      fields["form"].controls.startDate.setValue(futureDate);
      fixture.detectChanges();

      const endDate = query("#pam-cipher-view-banner_input_end-date") as HTMLInputElement | null;
      expect(endDate?.getAttribute("min")).toBe(futureDate);
    });
  });

  describe("validation", () => {
    it("validates the window against the rule's maximum", async () => {
      await create({ defaultSeconds: 900, maxSeconds: 1800 });
      await useCustomEnd();

      // A 2h window is well inside the global 24h ceiling but past this rule's 30m cap.
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "11:00",
      });
      fields["form"].controls.endTime.markAsTouched();
      await settle();

      expect(host.window.invalid).toBe(true);
      expect(endFieldError()?.textContent).toContain(formatDuration("en-US", 1800, "long"));
    });

    it("rejects a window that has already ended", async () => {
      await create();
      await useCustomEnd();

      const pastDate = toDateInputValue(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
      fields["form"].patchValue({
        startDate: pastDate,
        startTime: "09:00",
        endDate: pastDate,
        endTime: "10:00",
      });
      fields["form"].controls.endTime.markAsTouched();
      await settle();

      expect(host.window.invalid).toBe(true);
      expect(endFieldError()?.textContent).toContain("requestAccessModalWindowInPast");
    });

    it("rejects an end date before the start date", async () => {
      await create();
      await useCustomEnd();

      const [year, month, day] = futureDate.split("-").map(Number);
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: toDateInputValue(new Date(year, month - 1, day - 1)),
        endTime: "10:00",
      });
      await settle();

      expect(fields["form"].controls.endTime.touched).toBe(true);
      expect(endFieldError()?.textContent).toContain("requestAccessModalEndNotAfterStart");
    });

    it("shows the window error once the requester zeroes the window", async () => {
      await create();
      await useCustomEnd();

      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "10:00",
        endDate: futureDate,
        endTime: "10:00",
      });
      fields["form"].controls.endTime.markAsTouched();
      await settle();

      const error = endFieldError();
      expect(error?.textContent).toContain("requestAccessModalEndNotAfterStart");
      expect(error?.getAttribute("aria-live")).toBe("assertive");
      expect(query("#pam-cipher-view-banner_input_end")?.getAttribute("aria-invalid")).toBe("true");
    });

    it("reveals the window error when a start edit breaks a window the requester never touched", async () => {
      await create();
      await useCustomEnd();

      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "10:00",
      });
      fields["form"].controls.startTime.setValue("10:00");
      await settle();

      expect(fields["form"].controls.endTime.touched).toBe(true);
      expect(endFieldError()?.textContent).toContain("requestAccessModalEndNotAfterStart");
    });

    it("clears the window error once the window is valid again", async () => {
      await create();
      await useCustomEnd();

      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "10:00",
        endDate: futureDate,
        endTime: "10:00",
      });
      fields["form"].controls.endTime.markAsTouched();
      await settle();

      fields["form"].controls.startTime.setValue("09:00");
      await settle();

      expect(fields["form"].controls.endTime.errors).toBeNull();
      expect(endFieldError()).toBeNull();
    });

    it("shows the window error under the duration while the end field is hidden", async () => {
      await create();
      fields["startSlot"].setValue("custom");

      fields["form"].patchValue({
        startDate: toDateInputValue(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
        startTime: "09:00",
      });
      fixture.detectChanges();

      expect(query("[data-testid='request-window-error']")?.textContent).toContain(
        "requestAccessModalWindowInPast",
      );
      expect(query("[data-testid='request-window-summary']")).toBeNull();
    });
  });

  describe("as a form control", () => {
    it("hands the parent the window's error", async () => {
      await create();

      await useCustomEnd();
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "10:00",
        endDate: futureDate,
        endTime: "10:00",
      });

      expect(host.window.errors?.[REQUEST_WINDOW_ERROR_KEY]).toEqual(
        expect.objectContaining({ problem: "endNotAfterStart" }),
      );
    });

    it("shows an untouched field's error once the parent's submit marks it", async () => {
      await create();
      await useCustomEnd();
      fields["form"].patchValue({
        startDate: futureDate,
        startTime: "09:00",
        endDate: futureDate,
        endTime: "10:00",
      });
      // An edit to End itself, not a sibling, so nothing marks it touched.
      fields["form"].controls.endTime.markAsUntouched();
      fields["form"].controls.endTime.setValue("08:00");
      await settle();
      expect(endFieldError()).toBeNull();

      fields.markAllAsTouched();
      await settle();

      expect(endFieldError()?.textContent).toContain("requestAccessModalEndNotAfterStart");
    });
  });
});

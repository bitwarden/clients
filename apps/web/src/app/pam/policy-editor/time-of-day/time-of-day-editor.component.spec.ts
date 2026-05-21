import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TimeWindow } from "@bitwarden/pam";

import { TimeOfDayEditorComponent } from "./time-of-day-editor.component";

describe("TimeOfDayEditorComponent", () => {
  let fixture: ComponentFixture<TimeOfDayEditorComponent>;
  let component: TimeOfDayEditorComponent;
  let i18nService: ReturnType<typeof mock<I18nService>>;
  let emitted: Array<{ tz: string; windows: TimeWindow[] } | null>;

  async function setup(opts: {
    initialTz?: string;
    initialWindows?: TimeWindow[] | null;
    disabled?: boolean;
  } = {}) {
    emitted = [];
    fixture = TestBed.createComponent(TimeOfDayEditorComponent);
    component = fixture.componentInstance;
    if (opts.initialTz !== undefined) {
      fixture.componentRef.setInput("initialTz", opts.initialTz);
    }
    if (opts.initialWindows !== undefined) {
      fixture.componentRef.setInput("initialWindows", opts.initialWindows);
    }
    if (opts.disabled !== undefined) {
      fixture.componentRef.setInput("disabled", opts.disabled);
    }
    component.policyChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      imports: [TimeOfDayEditorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    });
  });

  describe("default window", () => {
    it("starts with Mon–Fri 09:00–18:00 when no initialWindows provided", async () => {
      await setup();

      const wins = component["windows"]();
      expect(wins).toHaveLength(1);
      expect(wins[0].daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(wins[0].from).toBe("09:00");
      expect(wins[0].to).toBe("18:00");
    });

    it("uses supplied initialWindows when provided", async () => {
      const custom: TimeWindow[] = [
        { daysOfWeek: [0, 6], from: "08:00", to: "12:00" },
      ];
      await setup({ initialWindows: custom });

      expect(component["windows"]()).toEqual(custom);
    });

    it("uses supplied initialTz when provided", async () => {
      await setup({ initialTz: "Europe/London" });

      expect(component["tz"]()).toBe("Europe/London");
    });
  });

  describe("validation — at least one window required", () => {
    it("emits null when all windows are removed", async () => {
      await setup();

      component["removeWindow"](0);
      fixture.detectChanges();

      expect(component["isValid"]()).toBe(false);
      const last = emitted[emitted.length - 1];
      expect(last).toBeNull();
    });

    it("isValid returns false when windows array is empty", async () => {
      await setup({ initialWindows: [] });

      expect(component["isValid"]()).toBe(false);
    });
  });

  describe("validation — from < to enforced", () => {
    it("isValid is false when from equals to", async () => {
      await setup({
        initialWindows: [{ daysOfWeek: [1], from: "09:00", to: "09:00" }],
      });

      expect(component["isValid"]()).toBe(false);
    });

    it("isValid is false when from is after to", async () => {
      await setup({
        initialWindows: [{ daysOfWeek: [1], from: "18:00", to: "09:00" }],
      });

      expect(component["isValid"]()).toBe(false);
    });

    it("isValid is true when from is strictly before to", async () => {
      await setup({
        initialWindows: [{ daysOfWeek: [1], from: "09:00", to: "17:00" }],
      });

      expect(component["isValid"]()).toBe(true);
    });
  });

  describe("serialization shape", () => {
    it("emits the correct shape on init with a valid default window", async () => {
      await setup({ initialTz: "America/New_York" });

      const last = emitted[emitted.length - 1];
      expect(last).not.toBeNull();
      expect(last!.tz).toBe("America/New_York");
      expect(last!.windows).toHaveLength(1);
      expect(last!.windows[0]).toEqual({ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" });
    });

    it("serializes multiple windows correctly", async () => {
      const windows: TimeWindow[] = [
        { daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" },
        { daysOfWeek: [0, 6], from: "10:00", to: "14:00" },
      ];
      await setup({ initialTz: "UTC", initialWindows: windows });

      const last = emitted[emitted.length - 1];
      expect(last).not.toBeNull();
      expect(last!.tz).toBe("UTC");
      expect(last!.windows).toHaveLength(2);
    });
  });

  describe("removeWindow behaviour", () => {
    it("canRemove is false when only one window remains, preventing the remove button", async () => {
      await setup();

      expect(component["windows"]()).toHaveLength(1);
      const nativeEl: HTMLElement = fixture.nativeElement;
      const removeBtn = nativeEl.querySelector("[data-testid='remove-window']");
      expect(removeBtn).toBeTruthy();
      expect(removeBtn?.hasAttribute("disabled")).toBe(true);
    });

    it("allows removal when two or more windows are present", async () => {
      await setup();
      component["addWindow"]();
      fixture.detectChanges();

      expect(component["windows"]()).toHaveLength(2);
      const nativeEl: HTMLElement = fixture.nativeElement;
      const removeBtns = nativeEl.querySelectorAll("[data-testid='remove-window']");
      expect(removeBtns.length).toBe(2);
      removeBtns.forEach((btn) => expect(btn.hasAttribute("disabled")).toBe(false));
    });

    it("removes the correct window by index", async () => {
      const windows: TimeWindow[] = [
        { daysOfWeek: [1], from: "09:00", to: "12:00" },
        { daysOfWeek: [2], from: "13:00", to: "17:00" },
      ];
      await setup({ initialWindows: windows });

      component["removeWindow"](0);
      fixture.detectChanges();

      const remaining = component["windows"]();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].daysOfWeek).toEqual([2]);
    });
  });

  describe("addWindow", () => {
    it("appends a Mon–Fri 09:00–18:00 default", async () => {
      await setup();
      component["addWindow"]();
      fixture.detectChanges();

      const wins = component["windows"]();
      expect(wins).toHaveLength(2);
      expect(wins[1]).toEqual({ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" });
    });
  });

  describe("timezone change", () => {
    it("re-emits with the updated tz", async () => {
      await setup({ initialTz: "UTC" });
      component["onTzChange"]("Asia/Tokyo");
      fixture.detectChanges();

      const last = emitted[emitted.length - 1];
      expect(last?.tz).toBe("Asia/Tokyo");
    });
  });
});

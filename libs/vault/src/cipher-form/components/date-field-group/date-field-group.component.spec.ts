import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DateFieldGroupComponent } from "./date-field-group.component";

describe("DateFieldGroupComponent", () => {
  let component: DateFieldGroupComponent;
  let fixture: ComponentFixture<DateFieldGroupComponent>;

  beforeEach(async () => {
    const i18nService = {
      t: (key: string) => key,
    };

    await TestBed.configureTestingModule({
      imports: [DateFieldGroupComponent, ReactiveFormsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DateFieldGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("writeValue", () => {
    it("parses YYYY-MM-DD format", () => {
      component.writeValue("2025-04-05");
      expect(component.internalForm.value).toEqual({
        month: "4",
        day: "5",
        year: "2025",
      });
    });

    it("parses old YYYY-M-D format (backward compat)", () => {
      component.writeValue("2025-4-5");
      expect(component.internalForm.value).toEqual({
        month: "4",
        day: "5",
        year: "2025",
      });
    });

    it("handles empty string", () => {
      component.writeValue("");
      expect(component.internalForm.value).toEqual({
        month: "",
        day: "",
        year: "",
      });
    });

    it("handles null", () => {
      component.writeValue(null);
      expect(component.internalForm.value).toEqual({
        month: "",
        day: "",
        year: "",
      });
    });

    it("handles undefined", () => {
      component.writeValue(undefined);
      expect(component.internalForm.value).toEqual({
        month: "",
        day: "",
        year: "",
      });
    });
  });

  describe("all-or-nothing validation", () => {
    it("sets crossFieldRequired on day and year when only month is filled", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      monthCtrl.setValue("4");
      tick();

      component.onGroupBlur(new FocusEvent("blur", { relatedTarget: document.body as any }));

      expect(dayCtrl.hasError("crossFieldRequired")).toBe(true);
      expect(yearCtrl.hasError("crossFieldRequired")).toBe(true);
    }));

    it("sets crossFieldRequired on month and year when only day is filled", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      dayCtrl.setValue("15");
      tick();

      component.onGroupBlur(new FocusEvent("blur", { relatedTarget: document.body as any }));

      expect(monthCtrl.hasError("crossFieldRequired")).toBe(true);
      expect(yearCtrl.hasError("crossFieldRequired")).toBe(true);
    }));

    it("sets crossFieldRequired on month and day when only year is filled", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      yearCtrl.setValue("2025");
      tick();

      component.onGroupBlur(new FocusEvent("blur", { relatedTarget: document.body as any }));

      expect(monthCtrl.hasError("crossFieldRequired")).toBe(true);
      expect(dayCtrl.hasError("crossFieldRequired")).toBe(true);
    }));

    it("clears crossFieldRequired errors when all fields are filled", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      monthCtrl.markAsTouched();
      monthCtrl.setValue("4");
      dayCtrl.setValue("15");
      yearCtrl.setValue("2025");
      tick();

      expect(monthCtrl.hasError("crossFieldRequired")).toBe(false);
      expect(dayCtrl.hasError("crossFieldRequired")).toBe(false);
      expect(yearCtrl.hasError("crossFieldRequired")).toBe(false);
    }));

    it("clears crossFieldRequired errors when all fields are empty", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      monthCtrl.setValue("4");
      monthCtrl.markAsTouched();
      dayCtrl.setValue("15");
      yearCtrl.setValue("2025");
      tick();

      monthCtrl.setValue("");
      dayCtrl.setValue("");
      yearCtrl.setValue("");
      tick();

      expect(monthCtrl.hasError("crossFieldRequired")).toBe(false);
      expect(dayCtrl.hasError("crossFieldRequired")).toBe(false);
      expect(yearCtrl.hasError("crossFieldRequired")).toBe(false);
    }));
  });

  describe("day range validation", () => {
    it("rejects Feb 31", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "2", day: "31", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(true);
    }));

    it("accepts Feb 29 on leap year 2024", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "2", day: "29", year: "2024" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(false);
    }));

    it("rejects Feb 29 on non-leap year 2023", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "2", day: "29", year: "2023" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(true);
    }));

    it("accepts Apr 30", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "4", day: "30", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(false);
    }));

    it("rejects Apr 31", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "4", day: "31", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(true);
    }));

    it("does not validate day when not all fields are filled", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "2", day: "31", year: "" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(false);
    }));

    it("rejects year with less than 4 digits", fakeAsync(() => {
      const yearCtrl = component.internalForm.get("year")!;
      component.internalForm.patchValue({ month: "4", day: "15", year: "25" });
      tick();

      expect(yearCtrl.hasError("invalidYear")).toBe(true);
    }));

    it("accepts year with exactly 4 digits", fakeAsync(() => {
      const yearCtrl = component.internalForm.get("year")!;
      component.internalForm.patchValue({ month: "4", day: "15", year: "2025" });
      tick();

      expect(yearCtrl.hasError("invalidYear")).toBe(false);
    }));

    it("accepts day 31 for Jan", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "1", day: "31", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(false);
    }));
  });

  describe("numeric filter", () => {
    it("strips non-digits from day field", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      dayCtrl.setValue("1a5b9");
      tick();

      expect(dayCtrl.value).toBe("159");
    }));

    it("strips non-digits from year field", fakeAsync(() => {
      const yearCtrl = component.internalForm.get("year")!;
      yearCtrl.setValue("2a0b2c5");
      tick();

      expect(yearCtrl.value).toBe("2025");
    }));

    it("allows empty values in numeric filters", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      dayCtrl.setValue("");
      tick();

      expect(dayCtrl.value).toBe("");
    }));

    it("handles day 0 as invalid", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "4", day: "0", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(true);
    }));

    it("handles large day values as invalid", fakeAsync(() => {
      const dayCtrl = component.internalForm.get("day")!;
      component.internalForm.patchValue({ month: "4", day: "32", year: "2025" });
      tick();

      expect(dayCtrl.hasError("invalidDay")).toBe(true);
    }));
  });

  describe("combineDate", () => {
    it("produces YYYY-MM-DD zero-padded format", () => {
      const onChangeSpy = jest.fn();
      component.registerOnChange(onChangeSpy);

      component.internalForm.patchValue({ month: "4", day: "5", year: "2025" });

      expect(onChangeSpy).toHaveBeenCalledWith("2025-04-05");
    });

    it("returns empty string when all fields are empty", () => {
      const onChangeSpy = jest.fn();
      component.registerOnChange(onChangeSpy);

      component.internalForm.patchValue({ month: "", day: "", year: "" });

      expect(onChangeSpy).toHaveBeenCalledWith("");
    });
  });
  describe("validate", () => {
    it("returns errors when day is missing", fakeAsync(() => {
      component.internalForm.patchValue({ month: "4", day: "", year: "2025" });
      tick();

      component.onGroupBlur(new FocusEvent("blur", { relatedTarget: document.body as any }));

      const dayCtrl = component.internalForm.get("day")!;
      expect(dayCtrl.hasError("crossFieldRequired")).toBe(true);
    }));

    it("returns null when form is valid", fakeAsync(() => {
      component.internalForm.patchValue({ month: "4", day: "5", year: "2025" });
      tick();

      expect(component.internalForm.valid).toBe(true);
    }));
  });

  describe("onGroupBlur", () => {
    it("marks all fields as touched when focus leaves the group", () => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      component.internalForm.patchValue({ month: "4", day: "", year: "2025" });

      const blurEvent = new FocusEvent("blur", {
        relatedTarget: document.body as any,
      });

      component.onGroupBlur(blurEvent);

      expect(monthCtrl.touched).toBe(true);
      expect(dayCtrl.touched).toBe(true);
      expect(yearCtrl.touched).toBe(true);
    });

    it("does not mark fields as touched if focus stays within the group", () => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      // Create a mock element inside the date field group
      const mockElement = document.createElement("div");
      const mockGroup = document.createElement("div");
      mockGroup.appendChild(mockElement);

      const blurEvent = new FocusEvent("blur", {
        relatedTarget: mockElement as any,
      });

      // Mock the viewChild to return the mock group
      jest.spyOn(component, "dateFieldGroup").mockReturnValue({ nativeElement: mockGroup } as any);

      component.onGroupBlur(blurEvent);

      expect(monthCtrl.touched).toBe(false);
      expect(dayCtrl.touched).toBe(false);
      expect(yearCtrl.touched).toBe(false);
    });

    it("marks all fields as touched when focus leaves and has partial values", fakeAsync(() => {
      const monthCtrl = component.internalForm.get("month")!;
      const dayCtrl = component.internalForm.get("day")!;
      const yearCtrl = component.internalForm.get("year")!;

      monthCtrl.setValue("4");
      monthCtrl.markAsTouched();
      dayCtrl.setValue("");
      yearCtrl.setValue("2025");
      tick();

      const blurEvent = new FocusEvent("blur", {
        relatedTarget: document.body as any,
      });

      // Reset touched to verify onGroupBlur marks them
      monthCtrl.markAsUntouched();
      dayCtrl.markAsUntouched();
      yearCtrl.markAsUntouched();

      component.onGroupBlur(blurEvent);

      expect(monthCtrl.touched).toBe(true);
      expect(dayCtrl.touched).toBe(true);
      expect(yearCtrl.touched).toBe(true);
    }));
  });
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  CustomRangeDialogComponent,
  CustomRangeDialogParams,
} from "./custom-range-dialog.component";

describe("CustomRangeDialogComponent", () => {
  let fixture: ComponentFixture<CustomRangeDialogComponent>;
  let component: CustomRangeDialogComponent;
  const close = jest.fn();

  async function create(params: CustomRangeDialogParams = { from: "", to: "" }): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CustomRangeDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            timePeriod: "Time period",
            from: "From",
            to: "To",
            startDate: "Start date",
            endDate: "End date",
            invalidDateRange: "Invalid date range.",
            save: "Save",
            cancel: "Cancel",
            close: "Close",
            submenu: "Submenu",
            toggleVisibility: "Toggle visibility",
            required: "required",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomRangeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const input = (which: "from" | "to") =>
    fixture.nativeElement.querySelector(
      `#pam-custom-range-dialog_input_${which}`,
    ) as HTMLInputElement;

  const errorFor = (which: "from" | "to") =>
    input(which).closest("bit-form-field")!.querySelector("bit-error");

  const confirmButton = () =>
    fixture.nativeElement.querySelector(
      "#pam-custom-range-dialog_button_confirm",
    ) as HTMLButtonElement;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  // Reopening on blank fields would ask the auditor to retype bounds the table is already filtered to.
  it("opens on the range in force", async () => {
    await create({ from: "2026-08-18T09:00", to: "2026-08-18T17:00" });

    expect(input("from").value).toBe("2026-08-18T09:00");
    expect(input("to").value).toBe("2026-08-18T17:00");
  });

  it("closes with the confirmed bounds", async () => {
    await create();
    component["formGroup"].patchValue({ from: "2026-08-18T09:00", to: "2026-08-18T17:00" });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ from: "2026-08-18T09:00", to: "2026-08-18T17:00" });
  });

  // A blank bound is unbounded on that side, not an error — one-sided ranges are ordinary.
  it("confirms a range bounded on one side only", async () => {
    await create();
    component["formGroup"].patchValue({ from: "2026-08-18T09:00", to: "" });

    await component["confirm"]();

    expect(close).toHaveBeenCalledWith({ from: "2026-08-18T09:00", to: "" });
  });

  // An inverted range matches nothing, and a table emptied by it reads as a trail with no events.
  it("reports an inverted range on the To field and blocks confirmation", async () => {
    await create();
    component["formGroup"].patchValue({ from: "2026-08-18T18:00", to: "2026-08-18T09:00" });
    fixture.detectChanges();

    expect(component["invertedRange"]()).toBe(true);
    expect(errorFor("to")!.textContent).toContain("Invalid date range.");
    expect(input("to").getAttribute("aria-invalid")).toBe("true");
    expect(input("from").getAttribute("aria-invalid")).not.toBe("true");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");

    await component["confirm"]();

    expect(close).not.toHaveBeenCalled();
  });

  it("clears the inverted-range error once the bounds are the right way round", async () => {
    await create();
    component["formGroup"].patchValue({ from: "2026-08-18T18:00", to: "2026-08-18T09:00" });
    fixture.detectChanges();

    component["formGroup"].patchValue({ to: "2026-08-19T09:00" });
    fixture.detectChanges();

    expect(errorFor("to")).toBeNull();
    expect(component["formGroup"].controls.to.errors).toBeNull();
    expect(confirmButton().getAttribute("aria-disabled")).toBeNull();
  });

  // Cancel closes without a result, so the caller keeps whatever range it already had in force.
  it("closes without a result when cancelled, even over an edited range", async () => {
    await create({ from: "2026-08-18T09:00", to: "2026-08-18T17:00" });
    component["formGroup"].patchValue({ from: "2026-01-01T00:00" });
    fixture.detectChanges();

    fixture.nativeElement.querySelector("#pam-custom-range-dialog_button_cancel").click();

    expect(close).toHaveBeenCalledWith(undefined);
  });
});

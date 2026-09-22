import { FormBuilder, FormControl, Validators } from "@angular/forms";

import {
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  requestWindowEndValidator,
} from "./request-access-window.validators";

describe("requestWindowEndValidator", () => {
  const now = new Date("2026-09-22T09:00:00");
  const oneHour = 3600;

  function group(
    values: { date: string; start: string; end: string },
    maxSeconds: number | null = oneHour,
  ) {
    const form = new FormBuilder().nonNullable.group({
      date: [values.date],
      start: [values.start],
      end: [
        values.end,
        [
          Validators.required,
          requestWindowEndValidator(
            () => maxSeconds,
            (problem, max) => `${problem}:${max}`,
            () => now,
          ),
        ],
      ],
    });
    // A child's validators run before the group adopts it, so the first pass sees no siblings at
    // all. The real form revalidates on every edit; this stands in for the first one.
    form.controls.end.updateValueAndValidity();
    return form;
  }

  function errorOn(control: FormControl<string>): RequestWindowError | undefined {
    return control.errors?.[REQUEST_WINDOW_ERROR_KEY];
  }

  it("accepts a window inside the cap", () => {
    const form = group({ date: "2026-09-22", start: "10:00", end: "10:30" });

    expect(form.controls.end.errors).toBeNull();
  });

  it("rejects an end equal to the start", () => {
    const form = group({ date: "2026-09-22", start: "10:00", end: "10:00" });

    expect(errorOn(form.controls.end)?.problem).toBe("zeroLengthWindow");
  });

  it("rejects a window that has already elapsed", () => {
    const form = group({ date: "2026-09-21", start: "10:00", end: "10:30" });

    expect(errorOn(form.controls.end)?.problem).toBe("endInPast");
  });

  it("rejects a span past the governing cap, naming the cap in the message", () => {
    const form = group({ date: "2026-09-22", start: "10:00", end: "12:00" }, oneHour);

    expect(errorOn(form.controls.end)).toEqual({
      problem: "exceedsMaxWindow",
      message: `exceedsMaxWindow:${oneHour}`,
    });
  });

  it("reads the cap through the callback on every run, so a later pre-check narrows it", () => {
    let max = 4 * oneHour;
    const form = new FormBuilder().nonNullable.group({
      date: ["2026-09-22"],
      start: ["10:00"],
      end: [
        "12:00",
        requestWindowEndValidator(
          () => max,
          (problem) => problem,
          () => now,
        ),
      ],
    });
    expect(form.controls.end.errors).toBeNull();

    max = oneHour;
    form.controls.end.updateValueAndValidity();

    expect(errorOn(form.controls.end)?.problem).toBe("exceedsMaxWindow");
  });

  it("accepts a window that crosses midnight, which composes onto the next day", () => {
    const form = group({ date: "2026-09-22", start: "23:30", end: "00:15" }, 4 * oneHour);

    expect(form.controls.end.errors).toBeNull();
  });

  it("passes an incomplete window, leaving it to the required validators", () => {
    const form = group({ date: "2026-09-22", start: "", end: "10:30" });

    expect(form.controls.end.errors).toBeNull();
  });

  it("passes a control with no parent, which cannot see its siblings", () => {
    const control = new FormControl("10:30", {
      nonNullable: true,
      validators: requestWindowEndValidator(
        () => oneHour,
        (problem) => problem,
        () => now,
      ),
    });

    expect(control.errors).toBeNull();
  });

  it("reads the sibling values live off the controls", () => {
    const form = group({ date: "2026-09-22", start: "10:00", end: "10:30" }, oneHour);
    expect(form.controls.end.errors).toBeNull();

    form.controls.start.setValue("08:00");
    form.controls.end.updateValueAndValidity();

    expect(errorOn(form.controls.end)?.problem).toBe("exceedsMaxWindow");
  });

  it("passes every window until the cap is known", () => {
    const form = group({ date: "2026-09-22", start: "10:00", end: "10:00" }, null);

    expect(form.controls.end.errors).toBeNull();
  });
});

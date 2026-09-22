import { FormBuilder, FormControl, Validators } from "@angular/forms";

import {
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  requestWindowEndValidator,
} from "./request-access-window.validators";

describe("requestWindowEndValidator", () => {
  const now = new Date("2026-09-22T09:00:00");
  const oneHour = 3600;

  type Window = { startDate: string; startTime: string; endDate: string; endTime: string };

  function window(overrides: Partial<Window> = {}): Window {
    return {
      startDate: "2026-09-22",
      startTime: "10:00",
      endDate: "2026-09-22",
      endTime: "10:30",
      ...overrides,
    };
  }

  function group(values: Window, maxSeconds: number | null = oneHour) {
    const form = new FormBuilder().nonNullable.group({
      startDate: [values.startDate],
      startTime: [values.startTime],
      endDate: [values.endDate],
      endTime: [
        values.endTime,
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
    form.controls.endTime.updateValueAndValidity();
    return form;
  }

  function errorOn(control: FormControl<string>): RequestWindowError | undefined {
    return control.errors?.[REQUEST_WINDOW_ERROR_KEY];
  }

  it("accepts a window inside the cap", () => {
    const form = group(window());

    expect(form.controls.endTime.errors).toBeNull();
  });

  it("rejects an end equal to the start", () => {
    const form = group(window({ endTime: "10:00" }));

    expect(errorOn(form.controls.endTime)?.problem).toBe("endNotAfterStart");
  });

  it("rejects an end before the start on the same date", () => {
    const form = group(window({ startTime: "10:00", endTime: "09:30" }));

    expect(errorOn(form.controls.endTime)?.problem).toBe("endNotAfterStart");
  });

  it("rejects a window that has already elapsed", () => {
    const form = group(window({ startDate: "2026-09-21", endDate: "2026-09-21" }));

    expect(errorOn(form.controls.endTime)?.problem).toBe("endInPast");
  });

  it("rejects a span past the governing cap, naming the cap in the message", () => {
    const form = group(window({ endTime: "12:00" }), oneHour);

    expect(errorOn(form.controls.endTime)).toEqual({
      problem: "exceedsMaxWindow",
      message: `exceedsMaxWindow:${oneHour}`,
    });
  });

  it("reads the cap through the callback on every run, so a later pre-check narrows it", () => {
    let max = 4 * oneHour;
    const form = new FormBuilder().nonNullable.group({
      startDate: ["2026-09-22"],
      startTime: ["10:00"],
      endDate: ["2026-09-22"],
      endTime: [
        "12:00",
        requestWindowEndValidator(
          () => max,
          (problem) => problem,
          () => now,
        ),
      ],
    });
    expect(form.controls.endTime.errors).toBeNull();

    max = oneHour;
    form.controls.endTime.updateValueAndValidity();

    expect(errorOn(form.controls.endTime)?.problem).toBe("exceedsMaxWindow");
  });

  it("accepts a window that ends on a later date than it starts", () => {
    const form = group(
      window({ startTime: "23:30", endDate: "2026-09-23", endTime: "00:15" }),
      4 * oneHour,
    );

    expect(form.controls.endTime.errors).toBeNull();
  });

  it("passes an incomplete window, leaving it to the required validators", () => {
    const form = group(window({ startTime: "" }));

    expect(form.controls.endTime.errors).toBeNull();
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
    const form = group(window(), oneHour);
    expect(form.controls.endTime.errors).toBeNull();

    form.controls.startTime.setValue("08:00");
    form.controls.endTime.updateValueAndValidity();

    expect(errorOn(form.controls.endTime)?.problem).toBe("exceedsMaxWindow");
  });

  it("passes every window until the cap is known", () => {
    const form = group(window({ endTime: "10:00" }), null);

    expect(form.controls.endTime.errors).toBeNull();
  });
});

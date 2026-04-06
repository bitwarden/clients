import { AbstractControl, FormControl, ValidatorFn } from "@angular/forms";

/**
 * Automatically trims FormControl value. Errors if value only contains whitespace.
 *
 * Should be used with `updateOn: "submit"`
 */
export const trimValidator: ValidatorFn = (control: AbstractControl<string>) => {
  if (!(control instanceof FormControl)) {
    throw new Error("trimValidator only supports validating FormControls");
  }
  const value = control.value;
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (!value.trim().length) {
    return {
      trim: {
        message: "input is only whitespace",
      },
    };
  }
  if (value !== value.trim()) {
    control.setValue(value.trim());
  }
  return null;
};

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from "@angular/forms";

export function notAllowedValueAsync(
  valueGetter: () => Promise<string>,
  caseInsensitive = false,
): AsyncValidatorFn {
  return async (control: AbstractControl): Promise<ValidationErrors | null> => {
    let notAllowedValue = await valueGetter();
    let controlValue = control.value;
    if (caseInsensitive) {
      notAllowedValue = notAllowedValue.toLowerCase();
      controlValue = controlValue.toLowerCase();
    }

    if (controlValue === notAllowedValue) {
      return {
        notAllowedValue: true,
      };
    }
  };
}

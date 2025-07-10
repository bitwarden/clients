import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
export function uniqueInArrayValidator(values: Array<string>, errorMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    const lowerTrimmedValue = value.toLowerCase().trim();

    // check if the entered value is unique
    if (values.some((val) => val.toLowerCase().trim() === lowerTrimmedValue)) {
      return {
        nonUniqueValue: {
          message: errorMessage,
        },
      };
    }

    return null;
  };
}

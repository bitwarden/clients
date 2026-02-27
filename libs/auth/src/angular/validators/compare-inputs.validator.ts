import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from "@angular/forms";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ValidationGoal {
  InputsShouldMatch,
  InputsShouldNotMatch,
}

/**
 * A cross-field validator that evaluates whether two form controls do or do
 * not have the same input value (except for empty string values). This validator
 * gets added to the entire FormGroup, not to an individual FormControl, like so:
 *
 * > ```
 * > formGroup = new FormGroup({
 * >   password: new FormControl(),
 * >   confirmPassword: new FormControl(),
 * > },
 * > {
 * >   validators: compareInputs(...),
 * > });
 * > ```
 *
 * Notes:
 * - Validation is controlled from either form control.
 * - The error message is displayed under controlB by default, but can be set to controlA.
 * - For more info on custom validators and cross-field validation:
 *   - https://v18.angular.dev/guide/forms/form-validation#defining-custom-validators
 *   - https://v18.angular.dev/guide/forms/form-validation#cross-field-validation
 *
 * @param validationGoal Whether you want to verify that the form controls do or do not have matching input values.
 * @param controlNameA The name of the first form control to compare.
 * @param controlNameB The name of the second form control to compare.
 * @param errorMessage The error message to display if there is an error. This will probably
 *                     be an i18n translated string.
 * @param showErrorOn The control under which you want to display the error (default is controlB).
 *
 * @returns A validator function that can be used on a FormGroup.
 */
export function compareInputs(
  validationGoal: ValidationGoal,
  controlNameA: string,
  controlNameB: string,
  errorMessage: string,
  showErrorOn: "controlA" | "controlB" = "controlB",
): ValidatorFn {
  /**
   * Documentation for the inner ValidatorFn that gets returned:
   *
   * @param formGroup The AbstractControl that we want to perform validation on. In this case we
   *                  perform validation on the FormGroup, which is a subclass of AbstractControl.
   *                  The reason we validate at the FormGroup level and not at the FormControl level
   *                  is because we want to compare two child FormControls in a single validator, so
   *                  we use the FormGroup as the common ancestor.
   *
   * @returns A ValidationErrors object if the validation fails, or null if the validation passes.
   */
  return (formGroup: AbstractControl): ValidationErrors | null => {
    if (!(formGroup instanceof FormGroup)) {
      throw new Error("compareInputs only supports validation at the FormGroup level");
    }

    const controlA = formGroup.get(controlNameA);
    const controlB = formGroup.get(controlNameB);

    if (!controlA || !controlB) {
      throw new Error(
        "[compareInputs validator] one or both of the specified controls could not be found in the form group",
      );
    }

    const controlThatShowsError = showErrorOn === "controlA" ? controlA : controlB;

    // Don't compare empty strings
    if (controlA.value === "" && controlB.value === "") {
      return pass();
    }

    const controlValuesMatch = controlA.value === controlB.value;

    if (validationGoal === ValidationGoal.InputsShouldMatch) {
      if (controlValuesMatch) {
        return pass();
      } else {
        return fail();
      }
    }

    if (validationGoal === ValidationGoal.InputsShouldNotMatch) {
      if (!controlValuesMatch) {
        return pass();
      } else {
        return fail();
      }
    }

    return null; // default return

    function fail() {
      controlThatShowsError.setErrors({
        // Preserve any pre-existing errors
        ...(controlThatShowsError.errors || {}),
        // Add new compareInputsError
        compareInputsError: {
          message: errorMessage,
        },
      });

      return {
        compareInputsError: {
          message: errorMessage,
        },
      };
    }

    function pass(): null {
      // Get the current errors object
      const errorsObj = controlThatShowsError?.errors;

      if (errorsObj != null) {
        // Remove any compareInputsError if it exists, since that is the sole error we are targeting with this validator
        if (errorsObj?.compareInputsError) {
          delete errorsObj.compareInputsError;
        }

        // Check if the errorsObj is now empty
        const isEmptyObj = Object.keys(errorsObj).length === 0;

        // If the errorsObj is empty, set errors to null, otherwise set the errors to an object of pre-existing errors (other than compareInputsError)
        controlThatShowsError.setErrors(isEmptyObj ? null : errorsObj);
      }

      // Return null for this validator
      return null;
    }
  };
}

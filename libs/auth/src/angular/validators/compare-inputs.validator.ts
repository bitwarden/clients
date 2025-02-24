import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

/**
 * Checks whether two form controls do or do not have the same input value (except for empty string values).
 *
 * - Validation is controlled from either form control.
 * - The error message is displayed under controlB by default, but can be set to controlA.
 *
 * @param validationGoal Whether you want to verify that the form control input values match or do not match
 * @param controlNameA The name of the first form control to compare.
 * @param controlNameB The name of the second form control to compare.
 * @param errorMessage The error message to display if there is an error. This will probably
 *                     be an i18n translated string.
 * @param showErrorOn The control under which you want to display the error (default is controlB).
 */
export function compareInputs(
  validationGoal: "match" | "doNotMatch",
  controlNameA: string,
  controlNameB: string,
  errorMessage: string,
  showErrorOn: "controlA" | "controlB" = "controlB",
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const controlA = control.get(controlNameA);
    const controlB = control.get(controlNameB);

    if (!controlA || !controlB) {
      return null;
    }

    const controlThatShowsError = showErrorOn === "controlA" ? controlA : controlB;

    // Don't compare empty strings
    if (controlA.value === "" && controlB.value === "") {
      return pass();
    }

    const controlValuesMatch = controlA.value === controlB.value;

    if (validationGoal === "match") {
      if (controlValuesMatch) {
        return pass();
      } else {
        return fail();
      }
    }

    if (validationGoal === "doNotMatch") {
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
        ...controlThatShowsError.errors,
        // Add new inputMatchError
        inputMatchError: {
          message: errorMessage,
        },
      });

      return {
        inputMatchError: {
          message: errorMessage,
        },
      };
    }

    function pass(): null {
      // Get the current errors object
      const errorsObj = controlThatShowsError?.errors;

      if (errorsObj != null) {
        // Remove any inputMatchError if it exists, since that is the sole error we are targeting with this validator
        if (errorsObj?.inputMatchError) {
          delete errorsObj.inputMatchError;
        }

        // Check if the errorsObj is now empty
        const isEmptyObj = Object.keys(errorsObj).length === 0;

        // If the errorsObj is empty, set errors to null, otherwise set the errors to an object of pre-existing errors (other than inputMatchError)
        controlThatShowsError.setErrors(isEmptyObj ? null : errorsObj);
      }

      // Return null for this validator
      return null;
    }
  };
}

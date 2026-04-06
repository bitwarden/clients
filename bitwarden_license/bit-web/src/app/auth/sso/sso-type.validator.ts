import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { SsoType } from "@bitwarden/common/auth/enums/sso";

export function ssoTypeValidator(errorMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === SsoType.None) {
      return {
        validSsoTypeRequired: {
          message: errorMessage,
        },
      };
    }

    return null;
  };
}

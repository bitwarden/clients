import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function forbiddenCharacters(characters: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormControl)) {
      throw new Error("forbiddenCharacters only supports validating FormControls");
    }

    if (control.value === null || control.value === undefined) {
      return null;
    }

    const value = String(control.value);

    for (const char of value) {
      if (characters.includes(char)) {
        return { forbiddenCharacters: { value: control.value, characters } };
      }
    }

    return null;
  };
}

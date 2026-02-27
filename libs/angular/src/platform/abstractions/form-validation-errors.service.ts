import { AbstractControl } from "@angular/forms";
export interface AllValidationErrors {
  controlName: string;
  errorName: string;
}

export interface FormGroupControls {
  [key: string]: AbstractControl;
}

export abstract class FormValidationErrorsService {
  abstract getFormValidationErrors(controls: FormGroupControls): AllValidationErrors[];
}

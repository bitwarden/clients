import { FormControl, FormGroup } from "@angular/forms";

/**
 * Helper type to map a model to a strictly typed from group. Allows specifying a formGroup's
 * type explicitly using an existing model/interface instead of a type being inferred
 * indirectly by control structure.
 * Source: https://netbasal.com/typed-reactive-forms-in-angular-no-longer-a-type-dream-bf6982b0af28
 * @example
 * interface UserData {
 *  name: string;
 *  age: number;
 * }
 * const strictlyTypedForm = this.formBuilder.group<Controls<UserData>>({
 *  name: new FormControl("John"),
 *  age: new FormControl(24),
 * });
 */
export type ControlsOf<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Record<any, any> ? FormGroup<ControlsOf<T[K]>> : FormControl<T[K]>;
};

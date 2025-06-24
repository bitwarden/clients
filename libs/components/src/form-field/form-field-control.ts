// FIXME: Update this file to be type safe and remove this and next line

import { Signal } from "@angular/core";

// @ts-strict-ignore
export type InputTypes =
  | "text"
  | "password"
  | "number"
  | "datetime-local"
  | "email"
  | "checkbox"
  | "search"
  | "file"
  | "date"
  | "time";

export abstract class BitFormFieldControl {
  ariaDescribedBy: string;
  id: Signal<string>;
  labelForId: string;
  required: boolean;
  hasError: boolean;
  error: [string, any];
  type?: Signal<InputTypes>;
  spellcheck?: Signal<boolean>;
  readOnly?: boolean;
  focus?: () => void;
}

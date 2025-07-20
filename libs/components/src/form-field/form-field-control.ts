// FIXME: Update this file to be type safe and remove this and next line

import { ModelSignal, Signal } from "@angular/core";

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
  type?: ModelSignal<InputTypes>;
  spellcheck?: ModelSignal<boolean | undefined>;
  readOnly?: boolean;
  focus?: () => void;
}

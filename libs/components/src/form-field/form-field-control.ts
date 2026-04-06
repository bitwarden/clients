import { ModelSignal, Signal } from "@angular/core";

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
  abstract ariaDescribedBy?: string;
  abstract id: Signal<string>;
  abstract labelForId: string;
  abstract required: boolean;
  abstract hasError: boolean;
  abstract error: [string, any];
  abstract type?: ModelSignal<InputTypes | undefined>;
  abstract spellcheck?: ModelSignal<boolean | undefined>;
  abstract readOnly?: boolean;
  abstract focus?: () => void;
}

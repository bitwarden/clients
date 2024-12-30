// FIXME: Update this file to be type safe and remove this and next line
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
  id: string;
  labelForId: string;
  required: boolean;
  hasError: boolean;
  error: [string, any];
  type?: InputTypes;
  spellcheck?: boolean;
  readOnly?: boolean;
  focus?: () => void;
}

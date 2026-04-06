import { ElementRef } from "@angular/core";

export abstract class BitFormControlAbstraction {
  abstract disabled: boolean;
  abstract required: boolean;
  abstract hasError: boolean;
  abstract error: [string, any];
  inputId?: string;
  inputEl?: ElementRef<HTMLInputElement>;
}

import { Signal } from "@angular/core";

export abstract class BitFormControlAbstraction {
  abstract disabled: Signal<boolean | null>;
  abstract required: boolean;
  abstract hasError: boolean;
  abstract error: [string, any];
}

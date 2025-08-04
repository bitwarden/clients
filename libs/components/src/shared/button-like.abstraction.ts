// FIXME: Update this file to be type safe and remove this and next line
import { ModelSignal } from "@angular/core";

// @ts-strict-ignore
export type ButtonType = "primary" | "secondary" | "danger" | "unstyled";

export type ButtonSize = "default" | "small";

export abstract class ButtonLikeAbstraction {
  loading: ModelSignal<boolean>;
  disabled: ModelSignal<boolean>;
}

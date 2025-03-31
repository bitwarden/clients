// FIXME: Update this file to be type safe and remove this and next line
import { ModelSignal } from "@angular/core";

// @ts-strict-ignore
export type ButtonType = "primary" | "secondary" | "danger" | "unstyled";

export abstract class ButtonLikeAbstraction {
  loading: ModelSignal<boolean>;
  disabled: ModelSignal<boolean>;
}

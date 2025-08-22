import { ModelSignal } from "@angular/core";

export type ButtonType = "primary" | "secondary" | "danger" | "unstyled";

export type ButtonSize = "default" | "small";

export abstract class ButtonLikeAbstraction {
  abstract loading: ModelSignal<boolean>;
  abstract disabled: ModelSignal<boolean>;
}

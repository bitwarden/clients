import { ModelSignal } from "@angular/core";

export type ButtonType =
  | "primary"
  | "primaryOutline"
  | "primaryGhost"
  | "secondary"
  | "subtle"
  | "subtleOutline"
  | "subtleGhost"
  | "danger"
  | "dangerOutline"
  | "dangerGhost"
  | "warning"
  | "warningOutline"
  | "warningGhost"
  | "success"
  | "successOutline"
  | "successGhost"
  | "unstyled";

export type ButtonSize = "default" | "small" | "large";

export abstract class ButtonLikeAbstraction {
  abstract loading: ModelSignal<boolean>;
  abstract disabled: ModelSignal<boolean>;
}

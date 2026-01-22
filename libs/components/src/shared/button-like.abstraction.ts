import { ModelSignal } from "@angular/core";

export const ButtonTypes = {
  Primary: "primary",
  PrimaryOutline: "primaryOutline",
  PrimaryGhost: "primaryGhost",
  Secondary: "secondary",
  Subtle: "subtle",
  SubtleOutline: "subtleOutline",
  SubtleGhost: "subtleGhost",
  Danger: "danger",
  DangerOutline: "dangerOutline",
  DangerGhost: "dangerGhost",
  Warning: "warning",
  WarningOutline: "warningOutline",
  WarningGhost: "warningGhost",
  Success: "success",
  SuccessOutline: "successOutline",
  SuccessGhost: "successGhost",
  Unstyled: "unstyled",
} as const;

export type ButtonType = (typeof ButtonTypes)[keyof typeof ButtonTypes];

export type ButtonSize = "default" | "small" | "large";

export abstract class ButtonLikeAbstraction {
  abstract loading: ModelSignal<boolean>;
  abstract disabled: ModelSignal<boolean>;
}

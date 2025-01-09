// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export type ButtonType = "primary" | "secondary" | "danger" | "unstyled";

export abstract class ButtonLikeAbstraction {
  loading: boolean;
  disabled: boolean;
}

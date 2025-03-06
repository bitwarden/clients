import { TemplateResult } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

export type IconProps = {
  color?: string;
  disabled?: boolean;
  theme: Theme;
};

export type Option = {
  default?: boolean;
  icon?: (props: IconProps) => TemplateResult;
  text?: string;
  value: any;
};

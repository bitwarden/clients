import { TemplateResult } from "lit";

import { ProductTierType } from "@bitwarden/common/billing/enums";
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

export type FolderView = {
  id: string;
  name: string;
};

export type OrgView = {
  id: string;
  name: string;
  productTierType?: ProductTierType;
};

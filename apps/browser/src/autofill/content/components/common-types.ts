import { TemplateResult } from "lit";

import { CollectionView } from "@bitwarden/admin-console/common";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Theme } from "@bitwarden/common/platform/enums";
import { OrganizationId } from "@bitwarden/common/types/guid";

export type I18n = {
  [key: string]: string;
};

export type IconProps = {
  color?: string;
  disabled?: boolean;
  theme: Theme;
  ariaHidden?: boolean;
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
  id: OrganizationId;
  name: string;
  productTierType?: ProductTierType;
};

export type CollectionNotificationView = Pick<CollectionView, "id" | "organizationId" | "name">;

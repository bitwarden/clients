import { html } from "lit";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Theme } from "@bitwarden/common/platform/enums";

import { Option, OrgView, FolderView } from "../common-types";
import { Business, Family, Folder, User } from "../icons";
import { ButtonRow } from "../rows/button-row";

function getVaultIconByProductTier(productTierType?: ProductTierType): Option["icon"] {
  switch (productTierType) {
    case ProductTierType.Free:
    case ProductTierType.Families:
      return Family;
    case ProductTierType.Teams:
    case ProductTierType.Enterprise:
    case ProductTierType.TeamsStarter:
      return Business;
    default:
      return User;
  }
}

export type NotificationButtonRowProps = {
  theme: Theme;
  primaryButton: {
    text: string;
    handlePrimaryButtonClick: (args: any) => void;
  };
  folders?: FolderView[];
  organizations?: OrgView[];
};

export function NotificationButtonRow({
  folders,
  organizations,
  primaryButton,
  theme,
}: NotificationButtonRowProps) {
  const currentUserVaultOption: Option = {
    icon: User,
    default: true,
    text: "My vault", // @TODO localize
    value: "0",
  };
  const organizationOptions: Option[] = organizations?.length
    ? organizations.reduce(
        (options, { id, name, productTierType }: OrgView) => {
          const icon = getVaultIconByProductTier(productTierType);
          return [
            ...options,
            {
              icon,
              text: name,
              value: id,
            },
          ];
        },
        [currentUserVaultOption],
      )
    : ([] as Option[]);

  const folderOptions: Option[] = folders?.length
    ? folders.reduce<Option[]>(
        (options, { id, name }: FolderView) => [
          ...options,
          {
            icon: Folder,
            text: name,
            value: id === null ? "0" : id,
            default: id === null,
          },
        ],
        [],
      )
    : [];

  return html`
    ${ButtonRow({
      theme,
      primaryButton,
      selectButtons: [
        ...(organizationOptions.length > 1
          ? [
              {
                id: "organization",
                label: "Vault", // @TODO localize
                options: organizationOptions,
              },
            ]
          : []),
        ...(folderOptions.length > 1
          ? [
              {
                id: "folder",
                label: "Folder", // @TODO localize
                options: folderOptions,
              },
            ]
          : []),
      ],
    })}
  `;
}

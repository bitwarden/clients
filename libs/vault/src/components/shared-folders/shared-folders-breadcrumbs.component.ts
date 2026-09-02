import { ChangeDetectionStrategy, Component, computed } from "@angular/core";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { BreadcrumbsModule, IconTileComponent, IconTileOptions } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { orgIconTile } from "../../models/vault-icon-tile";
import { vaultScopeCommands, VaultScopeType } from "../../models/vault-scope";

import { injectVaultOrganization } from "./inject-vault-organization";

interface VaultCrumb {
  name: string;
  tile: IconTileOptions;
  /** Route commands for the organization's All vault items page. */
  route: string[];
}

@Component({
  selector: "vault-shared-folders-breadcrumbs",
  templateUrl: "./shared-folders-breadcrumbs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, IconTileComponent, I18nPipe],
  host: {
    // `bit-breadcrumbs` sizes itself to its container, so this wrapper has to be one.
    class: "tw-flex tw-w-full tw-min-w-0",
  },
})
export class SharedFoldersBreadcrumbsComponent {
  private readonly organization = injectVaultOrganization();

  protected readonly vaultCrumb = computed<VaultCrumb | undefined>(() => {
    const organization = this.organization();

    if (organization == null) {
      return undefined;
    }

    return {
      name: organization.name,
      tile: orgIconTile(organization.productTierType),
      route: vaultScopeCommands({
        type: VaultScopeType.Organization,
        organizationId: organization.id as OrganizationId,
      }),
    };
  });
}

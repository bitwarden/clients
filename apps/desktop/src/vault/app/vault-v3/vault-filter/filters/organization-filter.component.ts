// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, computed, input, inject } from "@angular/core";

import { DisplayMode } from "@bitwarden/angular/vault/vault-filter/models/display-mode";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ToastService, NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { OrganizationFilter, VaultFilter, VaultFilterServiceAbstraction } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-filter",
  templateUrl: "organization-filter.component.html",
  imports: [A11yTitleDirective, NavigationModule, I18nPipe],
})
export class OrganizationFilterComponent {
  private toastService: ToastService = inject(ToastService);
  private i18nService: I18nService = inject(I18nService);
  private vaultFilterService: VaultFilterServiceAbstraction = inject(VaultFilterServiceAbstraction);

  protected readonly hide = input(false);
  protected readonly organizations = input.required<TreeNode<OrganizationFilter>>();
  protected readonly activeFilter = input<VaultFilter>();
  protected readonly activeOrganizationDataOwnership = input<boolean>(false);
  protected readonly activeSingleOrganizationPolicy = input<boolean>(false);

  protected readonly show = computed(() => {
    const hiddenDisplayModes: DisplayMode[] = [
      "singleOrganizationAndOrganizatonDataOwnershipPolicies",
    ];
    return (
      !this.hide() &&
      this.organizations()?.children.length > 0 &&
      hiddenDisplayModes.indexOf(this.displayMode()) === -1
    );
  });

  protected readonly displayMode = computed<DisplayMode>(() => {
    let displayMode: DisplayMode = "organizationMember";
    if (this.organizations() == null || this.organizations().children.length < 1) {
      displayMode = "noOrganizations";
    } else if (this.activeOrganizationDataOwnership() && !this.activeSingleOrganizationPolicy()) {
      displayMode = "organizationDataOwnershipPolicy";
    } else if (!this.activeOrganizationDataOwnership() && this.activeSingleOrganizationPolicy()) {
      displayMode = "singleOrganizationPolicy";
    } else if (this.activeOrganizationDataOwnership() && this.activeSingleOrganizationPolicy()) {
      displayMode = "singleOrganizationAndOrganizatonDataOwnershipPolicies";
    }

    return displayMode;
  });

  protected applyFilter(event: Event, organization: TreeNode<OrganizationFilter>) {
    event.stopPropagation();

    this.vaultFilterService.setOrganizationFilter(organization.node);
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedOrganizationNode = organization;
    }
  }

  protected applyAllVaultsFilter() {
    this.vaultFilterService.clearOrganizationFilter();
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedOrganizationNode = null;
    }
  }
}

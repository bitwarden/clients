import { Component, computed, input, inject } from "@angular/core";

import { DisplayMode } from "@bitwarden/angular/vault/vault-filter/models/display-mode";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ToastService, NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { OrganizationFilter, VaultFilter, CollectionFilter } from "@bitwarden/vault";

import { CollectionFilterComponent } from "./collection-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-filter",
  templateUrl: "organization-filter.component.html",
  imports: [A11yTitleDirective, NavigationModule, CollectionFilterComponent],
})
export class OrganizationFilterComponent {
  private toastService: ToastService = inject(ToastService);
  private i18nService: I18nService = inject(I18nService);

  protected readonly hide = input(false);
  protected readonly organizations = input<TreeNode<OrganizationFilter>>();
  protected readonly activeFilter = input<VaultFilter>();
  protected readonly activeOrganizationDataOwnership = input<boolean>(false);
  protected readonly activeSingleOrganizationPolicy = input<boolean>(false);
  protected readonly hideCollections = input(false);
  protected readonly collections = input<TreeNode<CollectionFilter>>();

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

  protected applyFilter(organization: TreeNode<OrganizationFilter>) {
    if (!organization.node.enabled) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("disabledOrganizationFilterError"),
      });
      return;
    }

    const filter = this.activeFilter();

    if (filter) {
      filter.selectedOrganizationNode = organization;
    }
  }

  private readonly collectionsByOrganization = computed(() => {
    const collections = this.collections();
    const map = new Map<OrganizationId, TreeNode<CollectionFilter>>();
    const orgs = this.organizations()?.children;

    if (!collections || !orgs) {
      return map;
    }

    for (const org of orgs) {
      const filteredCollections = collections.children.filter(
        (node) => node.node.organizationId === org.node.id,
      );

      const headNode = new TreeNode<CollectionFilter>(collections.node, null);
      headNode.children = filteredCollections;
      map.set(org.node.id, headNode);
    }

    return map;
  });

  protected getOrgCollections(organizationId: OrganizationId): TreeNode<CollectionFilter> {
    return this.collectionsByOrganization().get(organizationId) ?? null;
  }
}

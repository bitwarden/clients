// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { DisplayMode } from "../models/display-mode";
import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class OrganizationFilterComponent {
  @Input() hide = false;
  @Input() collapsedFilterNodes: Set<string>;
  @Input() organizations: Organization[];
  @Input() activeFilter: VaultFilter;
  @Input() activePersonalOwnershipPolicy: boolean;
  @Input() activeSingleOrganizationPolicy: boolean;

  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();

  get displayMode(): DisplayMode {
    let displayMode: DisplayMode = "organizationMember";
    if (this.organizations == null || this.organizations.length < 1) {
      displayMode = "noOrganizations";
    } else if (this.activePersonalOwnershipPolicy && !this.activeSingleOrganizationPolicy) {
      displayMode = "personalOwnershipPolicy";
    } else if (!this.activePersonalOwnershipPolicy && this.activeSingleOrganizationPolicy) {
      displayMode = "singleOrganizationPolicy";
    } else if (this.activePersonalOwnershipPolicy && this.activeSingleOrganizationPolicy) {
      displayMode = "singleOrganizationAndPersonalOwnershipPolicies";
    }

    return displayMode;
  }

  get hasActiveFilter() {
    return this.activeFilter.myVaultOnly || this.activeFilter.selectedOrganizationId != null;
  }

  readonly organizationGrouping: TopLevelTreeNode = {
    id: "vaults",
    name: "allVaults",
  };

  async applyOrganizationFilter(organization: Organization) {
    this.activeFilter.selectedOrganizationId = organization.id;
    this.activeFilter.myVaultOnly = false;
    this.activeFilter.refreshCollectionsAndFolders = true;
    this.applyFilter(this.activeFilter);
  }

  async applyMyVaultFilter() {
    this.activeFilter.selectedOrganizationId = null;
    this.activeFilter.myVaultOnly = true;
    this.activeFilter.refreshCollectionsAndFolders = true;
    this.applyFilter(this.activeFilter);
  }

  clearFilter() {
    this.activeFilter.myVaultOnly = false;
    this.activeFilter.selectedOrganizationId = null;
    this.applyFilter(new VaultFilter(this.activeFilter));
  }

  private applyFilter(filter: VaultFilter) {
    this.onFilterChange.emit(filter);
  }

  async toggleCollapse() {
    this.onNodeCollapseStateChange.emit(this.organizationGrouping);
  }

  get isCollapsed() {
    return this.collapsedFilterNodes.has(this.organizationGrouping.id);
  }
}

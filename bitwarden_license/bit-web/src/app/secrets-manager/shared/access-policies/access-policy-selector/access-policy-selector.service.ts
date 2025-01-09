import { Injectable } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { ApItemValueType } from "./models/ap-item-value.type";
import { ApItemViewType } from "./models/ap-item-view.type";
import { ApItemEnum } from "./models/enums/ap-item.enum";
import { ApPermissionEnum } from "./models/enums/ap-permission.enum";

@Injectable({
  providedIn: "root",
})
export class AccessPolicySelectorService {
  constructor(private organizationService: OrganizationService) {}

  async showAccessRemovalWarning(
    organizationId: string,
    selectedPoliciesValues: ApItemValueType[],
  ): Promise<boolean> {
    const organization = await this.organizationService.get(organizationId);
    if (organization.isOwner || organization.isAdmin) {
      return false;
    }

    if (!this.userHasReadWriteAccess(selectedPoliciesValues)) {
      return true;
    }

    return false;
  }

  async showSecretAccessRemovalWarning(
    organizationId: string,
    current: ApItemViewType[],
    selectedPoliciesValues: ApItemValueType[],
  ): Promise<boolean> {
    if (current.length === 0) {
      return false;
    }

    const organization = await this.organizationService.get(organizationId);
    if (organization.isOwner || organization.isAdmin || !this.userHasReadWriteAccess(current)) {
      return false;
    }

    if (!this.userHasReadWriteAccess(selectedPoliciesValues)) {
      return true;
    }

    return false;
  }

  isAccessRemoval(current: ApItemViewType[], selected: ApItemValueType[]): boolean {
    if (current?.length === 0) {
      return false;
    }

    if (selected?.length === 0) {
      return true;
    }

    return this.isAnyCurrentIdNotInSelectedIds(current, selected);
  }

  private isAnyCurrentIdNotInSelectedIds(
    current: ApItemViewType[],
    selected: ApItemValueType[],
  ): boolean {
    const currentIds = current.map((x) => x.id);
    const selectedIds = selected.map((x) => x.id);
    return !currentIds.every((id) => selectedIds.includes(id));
  }

  private userHasReadWriteAccess(policies: ApItemValueType[] | ApItemViewType[]): boolean {
    const userReadWritePolicy = (policies as Array<ApItemValueType | ApItemViewType>).find(
      (s) =>
        s.type === ApItemEnum.User &&
        s.currentUser &&
        s.permission === ApPermissionEnum.CanReadWrite,
    );

    const groupReadWritePolicies = (policies as Array<ApItemValueType | ApItemViewType>).filter(
      (s) =>
        s.type === ApItemEnum.Group &&
        s.permission === ApPermissionEnum.CanReadWrite &&
        s.currentUserInGroup,
    );

    if (groupReadWritePolicies.length > 0 || userReadWritePolicy !== undefined) {
      return true;
    }
    return false;
  }
}

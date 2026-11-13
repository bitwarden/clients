import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { hasApproverPrivileges } from "./approver-privileges";

/**
 * Reads the organizations and decrypted collections from the synced vault, as the web's
 * `ApprovalPrivilegeService` does, and applies {@link hasApproverPrivileges}. It never calls the
 * SDK or the network, so it needs an unlocked vault and a recent `bw sync`.
 */
export class ApproverPrivilegeService {
  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private accountService: AccountService,
  ) {}

  async canApprove(userId?: UserId): Promise<boolean> {
    const id = userId ?? (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (id == null) {
      return false;
    }
    const organizations = await firstValueFrom(this.organizationService.organizations$(id));
    const collections = await firstValueFrom(this.collectionService.decryptedCollections$(id));
    return hasApproverPrivileges(organizations, collections);
  }
}

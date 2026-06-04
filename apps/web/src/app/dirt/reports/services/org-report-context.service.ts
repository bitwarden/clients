import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/** The organization-scoped data an organization report page needs before loading its ciphers. */
export interface OrgReportContext {
  organization: Organization;
  manageableCipherIds: Set<string>;
  sharedCollectionIds: Set<string>;
}

/**
 * Loads the shared organization context (organization, the user's manageable cipher IDs, and the
 * org's shared non-default collection IDs) used by every organization report page. Extracting this
 * keeps the report components thin and removes the per-step error-logging that was previously
 * duplicated across each org report, in line with composition-over-inheritance (ADR-0009).
 *
 * This is observability/structure only — it performs the same loads, in the same order, that the
 * report components did inline.
 */
@Injectable({ providedIn: "root" })
export class OrgReportContextService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly logService = inject(LogService);

  /**
   * Loads the organization report context. Each step logs its failure (with the error object) under
   * `logContext` and re-throws, so failures still surface to the caller rather than being swallowed.
   *
   * @param organizationId Organization whose report context to load.
   * @param logContext Bracketed log prefix, e.g. `"[ExposedPasswordsReport] [Enterprise]"`.
   */
  async load(organizationId: string, logContext: string): Promise<OrgReportContext> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const organization = await this.step(logContext, "load organization", () =>
      firstValueFrom(this.organizationService.organizations$(userId).pipe(getById(organizationId))),
    );

    const manageableCipherIds = await this.step(logContext, "load manageable ciphers", async () => {
      const ciphers = await this.cipherService.getAll(userId);
      return new Set(ciphers.map((c) => c.id));
    });

    const sharedCollectionIds = await this.step(logContext, "load collections", async () => {
      const collections = await firstValueFrom(
        this.collectionService.decryptedCollections$(userId),
      );
      return new Set(
        collections
          .filter((c) => !c.isDefaultCollection && c.organizationId === organization?.id)
          .map((c) => c.id as string),
      );
    });

    return { organization, manageableCipherIds, sharedCollectionIds };
  }

  private async step<T>(logContext: string, action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      this.logService.error(`${logContext} Failed to ${action}`, e);
      throw e;
    }
  }
}

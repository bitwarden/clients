import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, map } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherId } from "@bitwarden/sdk-internal";

/**
 * Page-scoped service that loads the organization's decrypted vault ciphers.
 *
 * Provided at the shell route (alongside {@link RotationConfigsService}) so both the
 * configs tab list and the config-edit page share one loaded instance per navigation.
 *
 * Only Login-type, non-deleted ciphers are exposed (the credential-rotation use-case
 * only manages login credentials).
 *
 * Cipher names are decrypted locally via the org key — no unencrypted vault data is
 * ever sent to the server (zero-knowledge invariant).
 */
@Injectable()
export class OrgCiphersService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly cipherService = inject(CipherService);

  private readonly _ciphers$ = new BehaviorSubject<CipherView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);

  /** Whether a load is in progress. */
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /**
   * Login-type, non-deleted org ciphers as decrypted views.
   * Empty array until {@link load} resolves.
   */
  readonly ciphers$: Observable<CipherView[]> = this._ciphers$.asObservable();

  /**
   * Convenience map of cipher id → decrypted name.
   * Used by the configs list to resolve cipher display names.
   */
  readonly cipherNameById$: Observable<Map<CipherId, string>> = this._ciphers$.pipe(
    map((ciphers) => new Map(ciphers.map((c) => [c.id as CipherId, c.name]))),
  );

  /**
   * Fetch the org's ciphers and store them locally.
   *
   * Uses `cipherService.getAllFromApiForOrganization` when the current user can
   * edit all ciphers (admin/owner scope), and `getManyFromApiForOrganization`
   * otherwise — mirroring the admin-console org-vault page.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this._loading$.next(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const organization = await firstValueFrom(
        combineLatest([
          this.organizationService.organizations$(userId).pipe(getById(organizationId)),
        ]).pipe(map(([org]) => org)),
      );

      let ciphers: CipherView[];
      if (organization?.canEditAllCiphers) {
        ciphers = await this.cipherService.getAllFromApiForOrganization(organizationId);
      } else {
        ciphers = await this.cipherService.getManyFromApiForOrganization(organizationId);
      }

      // Keep only Login-type, non-deleted ciphers (rotation targets credentials only).
      const filtered = ciphers.filter((c) => c.type === CipherType.Login && !c.isDeleted);

      this._ciphers$.next(filtered);
    } finally {
      this._loading$.next(false);
    }
  }
}

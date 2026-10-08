import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, map } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherId } from "@bitwarden/sdk-internal";

/**
 * The organization's decrypted login ciphers. Provided at the shell route for its tabs; the
 * detail pages, siblings of the shell, provide their own.
 */
@Injectable()
export class OrgCiphersService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly cipherService = inject(CipherService);

  private readonly _ciphers$ = new BehaviorSubject<CipherView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);

  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** Empty until {@link load} resolves. */
  readonly ciphers$: Observable<CipherView[]> = this._ciphers$.asObservable();

  readonly cipherNameById$: Observable<Map<CipherId, string>> = this._ciphers$.pipe(
    map((ciphers) => new Map(ciphers.map((c) => [asUuid<CipherId>(c.id), c.name]))),
  );

  /** Picks the API read by `canEditAllCiphers`, as the Admin Console org-vault page does. */
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

      // Rotation manages login credentials only.
      const filtered = ciphers.filter((c) => c.type === CipherType.Login && !c.isDeleted);

      this._ciphers$.next(filtered);
    } finally {
      this._loading$.next(false);
    }
  }
}

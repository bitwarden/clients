import { inject, Injectable } from "@angular/core";
import {
  catchError,
  combineLatest,
  forkJoin,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  ControlledAccessFilterOption,
  VaultControlledAccessFilter,
} from "@bitwarden/web-vault/app/vault/individual-vault/vault-controlled-access-filter.token";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { cipherAccessBadgeState } from "../access-state-badge/access-badge-state";

/**
 * The id of the "Privileged" child, as it appears in the vault's URL. Stable: it is written into
 * links users bookmark and share, so it is not derived from the copy.
 */
export const PRIVILEGED_FILTER_ID = "privileged";

/**
 * Binds `VAULT_CONTROLLED_ACCESS_FILTER`: the vault sidebar's "Controlled access" group and the
 * narrowing its children apply to the item list. Encapsulates every PAM dependency so the vault
 * stays PAM-free.
 *
 * The group's children partition {@link AccessBadgeState}. Only "Privileged" — the resting state
 * of a gated item nobody has requested — ships here; "My requests" (`pending`/`ready`/`active`)
 * follows, and "Unavailable" cannot be built at all because `cipherAccessBadgeState` never
 * produces that kind (see `access-badge-state.ts`).
 *
 * Narrowing costs one `getCipherAccessState` call per gated row, the same read the row's own
 * badge makes, and is issued only for rows that are gated AND belong to an organization carrying
 * Privileged Access — no other row can be in any of these states.
 */
@Injectable()
export class ControlledAccessVaultFilterService implements VaultControlledAccessFilter {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly i18nService = inject(I18nService);

  private readonly pamOrganizationIds$: Observable<Set<string>> =
    this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      // `getUserId` throws on a signed-out account, which would tear down the whole stream.
      switchMap((userId) =>
        userId == null ? of([]) : this.organizationService.organizations$(userId),
      ),
      map(
        (organizations) => new Set<string>(organizations.filter((o) => o.usePam).map((o) => o.id)),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  readonly options$: Observable<ControlledAccessFilterOption[]> = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
    this.pamOrganizationIds$,
  ]).pipe(
    map(([enabled, pamOrganizationIds]) =>
      enabled && pamOrganizationIds.size > 0
        ? [
            {
              id: PRIVILEGED_FILTER_ID,
              name: this.i18nService.t("pamAccessBadgePrivileged"),
              icon: "bwi-key" as const,
            },
          ]
        : [],
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]> {
    return this.options$.pipe(
      switchMap((options) =>
        options.some((option) => option.id === optionId)
          ? this.narrowToPrivileged$(ciphers)
          : of(ciphers),
      ),
    );
  }

  private narrowToPrivileged$<C extends CipherViewLike>(ciphers: C[]): Observable<C[]> {
    return this.pamOrganizationIds$.pipe(
      switchMap((pamOrganizationIds) => {
        const candidates = ciphers.filter(
          (cipher) =>
            CipherViewLikeUtils.isPartial(cipher) &&
            cipher.id != null &&
            cipher.organizationId != null &&
            pamOrganizationIds.has(String(cipher.organizationId)),
        );
        if (candidates.length === 0) {
          return of([] as C[]);
        }
        return forkJoin(candidates.map((cipher) => this.privileged$(cipher))).pipe(
          map((privileged) => candidates.filter((_, index) => privileged[index])),
        );
      }),
    );
  }

  private privileged$(cipher: CipherViewLike): Observable<boolean> {
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state) => cipherAccessBadgeState(state)?.kind === "privileged"),
      // A failed read is not evidence that the row is privileged, and listing it anyway would
      // make the filter overstate what it is showing.
      catchError(() => of(false)),
    );
  }
}

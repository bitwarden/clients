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
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";

/**
 * The ids of the group's children, as they appear in the vault's URL. Stable: they are written
 * into links users bookmark and share, so they are not derived from the copy.
 */
export const PRIVILEGED_FILTER_ID = "privileged";
export const MY_REQUESTS_FILTER_ID = "my-requests";

type ControlledAccessFilterDefinition = Omit<ControlledAccessFilterOption, "name"> & {
  readonly nameKey: string;
  readonly kinds: readonly AccessBadgeState["kind"][];
};

const CONTROLLED_ACCESS_FILTERS: readonly ControlledAccessFilterDefinition[] = [
  {
    id: MY_REQUESTS_FILTER_ID,
    nameKey: "pamTabMyRequests",
    icon: "bwi-lock-encrypted",
    kinds: ["pending", "ready", "active"],
  },
  {
    id: PRIVILEGED_FILTER_ID,
    nameKey: "pamAccessBadgePrivileged",
    icon: "bwi-key",
    kinds: ["privileged"],
  },
];

/**
 * Binds `VAULT_CONTROLLED_ACCESS_FILTER`: the vault sidebar's "Controlled access" group and the
 * narrowing its children apply to the item list. Encapsulates every PAM dependency so the vault
 * stays PAM-free.
 *
 * The group's children partition {@link AccessBadgeState}: "Privileged" is the resting state of a
 * gated item nobody has requested, and "My requests" covers the three states a request of this
 * user's own passes through (`pending`/`ready`/`active`). "Unavailable" cannot be built at all
 * because `cipherAccessBadgeState` never produces that kind (see `access-badge-state.ts`).
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
        ? CONTROLLED_ACCESS_FILTERS.map(({ id, nameKey, icon }) => ({
            id,
            name: this.i18nService.t(nameKey),
            icon,
          }))
        : [],
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]> {
    const definition = CONTROLLED_ACCESS_FILTERS.find((candidate) => candidate.id === optionId);
    return this.options$.pipe(
      switchMap((options) =>
        definition != null && options.some((option) => option.id === optionId)
          ? this.narrowTo$(definition, ciphers)
          : of(ciphers),
      ),
    );
  }

  private narrowTo$<C extends CipherViewLike>(
    definition: ControlledAccessFilterDefinition,
    ciphers: C[],
  ): Observable<C[]> {
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
        return forkJoin(candidates.map((cipher) => this.matches$(definition, cipher))).pipe(
          map((matched) => candidates.filter((_, index) => matched[index])),
        );
      }),
    );
  }

  private matches$(
    definition: ControlledAccessFilterDefinition,
    cipher: CipherViewLike,
  ): Observable<boolean> {
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state) => {
        const kind = cipherAccessBadgeState(state)?.kind;
        return kind != null && definition.kinds.includes(kind);
      }),
      // A failed read is not evidence of any particular state, and listing the row anyway would
      // make the filter overstate what it is showing.
      catchError(() => of(false)),
    );
  }
}

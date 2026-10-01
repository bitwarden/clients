import { inject, Injectable } from "@angular/core";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { AccountLock, BitSvg } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { compareValues } from "@bitwarden/common/platform/misc/compare-values";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  ControlledAccessEmptyState,
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

type ControlledAccessFilterDefinition = Omit<
  ControlledAccessFilterOption,
  "name" | "emptyState"
> & {
  readonly nameKey: string;
  readonly kinds: readonly AccessBadgeState["kind"][];
  readonly emptyState?: {
    readonly titleKey: string;
    readonly descriptionKey: string;
    readonly genericDescriptionKey: string;
    readonly icon: BitSvg;
  };
};

const CONTROLLED_ACCESS_FILTERS: readonly ControlledAccessFilterDefinition[] = [
  {
    id: MY_REQUESTS_FILTER_ID,
    nameKey: "pamTabMyRequests",
    icon: "bwi-lock-encrypted",
    kinds: ["pending", "ready", "active"],
    emptyState: {
      titleKey: "pamMyRequestsEmptyTitle",
      descriptionKey: "pamMyRequestsEmptyDescription",
      genericDescriptionKey: "pamMyRequestsEmptyDescriptionGeneric",
      icon: AccountLock,
    },
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
 * narrowing its children apply to the item list.
 *
 * The group's children partition {@link AccessBadgeState}: "Privileged" is a gated item nobody
 * has requested, "My requests" covers `pending`/`ready`/`active`, and "Unavailable" can't be
 * built at all, since `cipherAccessBadgeState` never produces that kind.
 *
 * Narrowing costs one `getCipherAccessState` call per gated row, issued only for rows that are
 * gated and belong to an organization carrying Privileged Access.
 */
@Injectable()
export class ControlledAccessVaultFilterService implements VaultControlledAccessFilter {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly i18nService = inject(I18nService);

  private readonly pamOrganizations$: Observable<{ id: string; name: string }[]> =
    this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      // `getUserId` throws on a signed-out account, which would tear down the whole stream.
      switchMap((userId) =>
        userId == null ? of([]) : this.organizationService.organizations$(userId),
      ),
      map((organizations) =>
        organizations
          .filter((o) => o.usePam)
          .map((o) => ({ id: o.id, name: o.name }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      ),
      // `organizations$` re-emits on every sync, not just PAM changes; dedupe on content so an
      // unrelated sync doesn't re-trigger the fan-out in `narrowTo$`.
      distinctUntilChanged(compareValues),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  readonly options$: Observable<ControlledAccessFilterOption[]> = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.Pam).pipe(distinctUntilChanged()),
    this.pamOrganizations$,
  ]).pipe(
    map(([enabled, pamOrganizations]) =>
      enabled && pamOrganizations.length > 0
        ? CONTROLLED_ACCESS_FILTERS.map(({ id, nameKey, icon, emptyState }) => ({
            id,
            name: this.i18nService.t(nameKey),
            icon,
            emptyState: this.emptyStateFor(emptyState, pamOrganizations),
          }))
        : [],
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private emptyStateFor(
    emptyState: ControlledAccessFilterDefinition["emptyState"],
    pamOrganizations: { id: string; name: string }[],
  ): ControlledAccessEmptyState | undefined {
    if (emptyState == null) {
      return undefined;
    }
    const sole = pamOrganizations.length === 1 ? pamOrganizations[0] : undefined;
    return {
      title: emptyState.titleKey,
      description: sole ? emptyState.descriptionKey : emptyState.genericDescriptionKey,
      descriptionParam: sole?.name,
      icon: emptyState.icon,
    };
  }

  narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]> {
    const definition = CONTROLLED_ACCESS_FILTERS.find((candidate) => candidate.id === optionId);
    if (definition == null) {
      return of(ciphers);
    }
    return this.options$.pipe(
      map((options) => options.some((option) => option.id === optionId)),
      distinctUntilChanged(),
      switchMap((onOffer) => (onOffer ? this.narrowTo$(definition, ciphers) : of(ciphers))),
    );
  }

  private narrowTo$<C extends CipherViewLike>(
    definition: ControlledAccessFilterDefinition,
    ciphers: C[],
  ): Observable<C[]> {
    return this.pamOrganizations$.pipe(
      switchMap((pamOrganizations) => {
        const pamOrganizationIds = new Set(pamOrganizations.map((o) => o.id));
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

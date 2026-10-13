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
  ACTIVE_FILTER_ID,
  MY_REQUESTS_FILTER_ID,
  PENDING_FILTER_ID,
  PRIVILEGED_FILTER_ID,
  READY_FILTER_ID,
  UNAVAILABLE_FILTER_ID,
} from "@bitwarden/vault";
import {
  ControlledAccessFilterOption,
  VaultControlledAccessFilter,
} from "@bitwarden/web-vault/app/vault/individual-vault/vault-controlled-access-filter.token";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";

type ControlledAccessFilterDefinition = Omit<ControlledAccessFilterOption, "name"> & {
  readonly nameKey: string;
  readonly kinds: readonly AccessBadgeState["kind"][];
};

/** The legacy vault sidebar's "Controlled access" children: state groups. */
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
 * The vault table chip's options: one per access state, labelled like the badge each admits, so
 * an option's count matches the badges on screen.
 */
const CONTROLLED_ACCESS_STATE_FILTERS: readonly ControlledAccessFilterDefinition[] = [
  {
    id: PRIVILEGED_FILTER_ID,
    nameKey: "pamAccessBadgePrivileged",
    icon: "bwi-key",
    kinds: ["privileged"],
  },
  {
    id: PENDING_FILTER_ID,
    nameKey: "pamAccessBadgePending",
    icon: "bwi-clock",
    kinds: ["pending"],
  },
  {
    id: READY_FILTER_ID,
    nameKey: "pamAccessBadgeReady",
    icon: "bwi-check",
    kinds: ["ready"],
  },
  {
    id: ACTIVE_FILTER_ID,
    nameKey: "pamControlledAccessFilterActive",
    icon: "bwi-unlock",
    kinds: ["active"],
  },
  {
    id: UNAVAILABLE_FILTER_ID,
    nameKey: "pamAccessBadgeUnavailable",
    icon: "bwi-lock",
    kinds: ["unavailable"],
  },
];

type AccessKind = AccessBadgeState["kind"];

/**
 * The "Controlled access" filter: the sidebar's state groups ({@link options$}) and the vault
 * table chip's one-per-state options ({@link tableOptions$}), over one narrowing. Narrowing costs
 * one `getCipherAccessState` call per gated row in a PAM organization, shared across options.
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
      map((organizations) =>
        organizations
          .filter((o) => o.usePam)
          .map((o) => o.id)
          .sort(),
      ),
      // `organizations$` re-emits on every sync, so dedupe on content to keep an unrelated sync
      // from re-running the `narrowTo$` fan-out.
      distinctUntilChanged((a, b) => a.length === b.length && a.every((id, i) => id === b[i])),
      map((ids) => new Set(ids)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  readonly options$: Observable<ControlledAccessFilterOption[]> =
    this.offered$(CONTROLLED_ACCESS_FILTERS);

  readonly tableOptions$: Observable<ControlledAccessFilterOption[]> = this.offered$(
    CONTROLLED_ACCESS_STATE_FILTERS,
  );

  /**
   * The access state of each gated row in a list, keyed by the list itself so every option
   * narrowed over the same rows shares one read. Weakly held: a superseded list is dropped with it.
   */
  private readonly kindsByRows = new WeakMap<
    readonly CipherViewLike[],
    Observable<Map<string, AccessKind>>
  >();

  narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]> {
    const offered = (options: ControlledAccessFilterOption[]) =>
      options.some((option) => option.id === optionId);
    const definition = [...CONTROLLED_ACCESS_FILTERS, ...CONTROLLED_ACCESS_STATE_FILTERS].find(
      (candidate) => candidate.id === optionId,
    );
    return combineLatest([this.options$, this.tableOptions$]).pipe(
      switchMap(([options, tableOptions]) =>
        definition != null && (offered(options) || offered(tableOptions))
          ? this.narrowTo$(definition, ciphers)
          : of(ciphers),
      ),
    );
  }

  private offered$(
    definitions: readonly ControlledAccessFilterDefinition[],
  ): Observable<ControlledAccessFilterOption[]> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.pamOrganizationIds$,
    ]).pipe(
      map(([enabled, pamOrganizationIds]) =>
        enabled && pamOrganizationIds.size > 0
          ? definitions.map(({ id, nameKey, icon }) => ({
              id,
              name: this.i18nService.t(nameKey),
              icon,
            }))
          : [],
      ),
      // Upstream re-emits on renewal or sync, which would re-run `narrow$`'s fan-out for an
      // identical option list.
      distinctUntilChanged(
        (a, b) => a.length === b.length && a.every((option, i) => option.id === b[i].id),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private narrowTo$<C extends CipherViewLike>(
    definition: ControlledAccessFilterDefinition,
    ciphers: C[],
  ): Observable<C[]> {
    return this.kinds$(ciphers).pipe(
      map((kinds) =>
        ciphers.filter((cipher) => {
          const kind = kinds.get(String(cipher.id));
          return kind != null && definition.kinds.includes(kind);
        }),
      ),
    );
  }

  private kinds$(ciphers: readonly CipherViewLike[]): Observable<Map<string, AccessKind>> {
    const cached = this.kindsByRows.get(ciphers);
    if (cached != null) {
      return cached;
    }

    const kinds$ = this.pamOrganizationIds$.pipe(
      switchMap((pamOrganizationIds) => {
        const candidates = ciphers.filter(
          (cipher) =>
            CipherViewLikeUtils.isPartial(cipher) &&
            cipher.id != null &&
            cipher.organizationId != null &&
            pamOrganizationIds.has(String(cipher.organizationId)),
        );
        if (candidates.length === 0) {
          return of(new Map<string, AccessKind>());
        }
        return forkJoin(candidates.map((cipher) => this.kind$(cipher))).pipe(
          map((kinds) => {
            const byId = new Map<string, AccessKind>();
            candidates.forEach((cipher, index) => {
              const kind = kinds[index];
              if (kind != null) {
                byId.set(String(cipher.id), kind);
              }
            });
            return byId;
          }),
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
    this.kindsByRows.set(ciphers, kinds$);
    return kinds$;
  }

  private kind$(cipher: CipherViewLike): Observable<AccessKind | undefined> {
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state) => cipherAccessBadgeState(state)?.kind),
      // A failed read is not evidence of any particular state, and listing the row anyway would
      // make the filter overstate what it is showing.
      catchError(() => of(undefined)),
    );
  }
}

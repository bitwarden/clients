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
  startWith,
  switchMap,
} from "rxjs";

import {
  AccessRequestSdkService,
  ACCESS_BADGE_LOOK,
  AccessBadgeState,
  cipherAccessBadgeState,
  ENDING_SOON_THRESHOLD_MS,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconTileVariant } from "@bitwarden/components";
import {
  ACTIVE_FILTER_ID,
  ControlledAccessFilterOption,
  MY_REQUESTS_FILTER_ID,
  PENDING_FILTER_ID,
  PRIVILEGED_FILTER_ID,
  READY_FILTER_ID,
  UNAVAILABLE_FILTER_ID,
  VaultControlledAccessFilter,
} from "@bitwarden/vault";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/** Table-chip option for an active lease inside {@link ENDING_SOON_THRESHOLD_MS} of its end. */
export const ENDING_SOON_FILTER_ID = "ending-soon";

/** A filter option, plus the tile colour of the badge it admits. */
export type ControlledAccessStateOption = ControlledAccessFilterOption & {
  readonly tileVariant?: IconTileVariant;
};

type ControlledAccessFilterDefinition = Omit<ControlledAccessFilterOption, "name"> & {
  readonly nameKey: string;
  readonly kinds: readonly AccessBadgeState["kind"][];
  /** The tile colour, matching the badge's colour. */
  readonly tileVariant?: IconTileVariant;
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
    // Single-kind, so it reads the badge's glyph like the state chip's option does. "My
    // requests" above spans three kinds and so has no one badge to follow.
    icon: ACCESS_BADGE_LOOK.privileged.icon,
    kinds: ["privileged"],
  },
  {
    id: UNAVAILABLE_FILTER_ID,
    nameKey: "pamAccessBadgeUnavailable",
    icon: "bwi-lock",
    kinds: ["unavailable"],
  },
];

/**
 * The vault table chip's options: one per access state, labelled and iconed like the badge each
 * admits, so an option's count matches the badges on screen. The icons come off
 * {@link ACCESS_BADGE_LOOK} rather than being restated here, which is how Ready came to offer a
 * plain check beside a badge showing a circled one.
 */
const CONTROLLED_ACCESS_STATE_FILTERS: readonly ControlledAccessFilterDefinition[] = [
  {
    id: PRIVILEGED_FILTER_ID,
    nameKey: "pamAccessBadgePrivileged",
    icon: ACCESS_BADGE_LOOK.privileged.icon,
    kinds: ["privileged"],
    tileVariant: "primary",
  },
  {
    id: READY_FILTER_ID,
    nameKey: "pamAccessBadgeReady",
    icon: ACCESS_BADGE_LOOK.ready.icon,
    kinds: ["ready"],
    tileVariant: "success",
  },
  {
    id: PENDING_FILTER_ID,
    nameKey: "pamAccessBadgePending",
    icon: ACCESS_BADGE_LOOK.pending.icon,
    kinds: ["pending"],
    tileVariant: "warning",
  },
  {
    id: ACTIVE_FILTER_ID,
    nameKey: "pamControlledAccessFilterActive",
    icon: ACCESS_BADGE_LOOK.active.icon,
    kinds: ["active"],
    tileVariant: "teal",
  },
  {
    id: ENDING_SOON_FILTER_ID,
    nameKey: "pamControlledAccessFilterEndingSoon",
    icon: ACCESS_BADGE_LOOK.endingSoon.icon,
    kinds: ["active"],
    tileVariant: "danger",
  },
  {
    id: UNAVAILABLE_FILTER_ID,
    nameKey: "pamAccessBadgeUnavailable",
    icon: ACCESS_BADGE_LOOK.unavailable.icon,
    kinds: ["unavailable"],
    tileVariant: "gray",
  },
];

type AccessKind = AccessBadgeState["kind"];

/**
 * The vault table's Controlled access sort, ascending: the SDK's badge ranking (active → ready →
 * pending → unavailable → privileged), so the rows needing the user's attention lead.
 */
const SORT_ORDER: readonly AccessKind[] = [
  "active",
  "ready",
  "pending",
  "unavailable",
  "privileged",
];

/**
 * Whether a row in `state` belongs under a table option at `now`. A lease past its end belongs
 * to no active option: its badge reads "Session ended".
 */
function admits(
  definition: ControlledAccessFilterDefinition,
  state: AccessBadgeState,
  now: number,
): boolean {
  if (!definition.kinds.includes(state.kind)) {
    return false;
  }
  if (state.kind !== "active") {
    return true;
  }
  const remainingMs = state.expiresAt.getTime() - now;
  if (remainingMs <= 0) {
    return false;
  }
  return remainingMs <= ENDING_SOON_THRESHOLD_MS === (definition.id === ENDING_SOON_FILTER_ID);
}

function sameMatches(
  a: ReadonlyMap<string, ReadonlySet<CipherId>>,
  b: ReadonlyMap<string, ReadonlySet<CipherId>>,
): boolean {
  return (
    a.size === b.size &&
    [...a].every(([option, ids]) => {
      const other = b.get(option);
      return other != null && other.size === ids.size && [...ids].every((id) => other.has(id));
    })
  );
}

/**
 * The "Controlled access" filter: the sidebar's state groups ({@link options$}) and the vault
 * table chip's one-per-state options ({@link stateOptions$}), over one narrowing. Narrowing costs
 * one `getCipherAccessState` call per gated row in a PAM organization, shared across options.
 */
@Injectable()
export class ControlledAccessVaultFilterService implements VaultControlledAccessFilter {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly i18nService = inject(I18nService);
  private readonly ticker = inject(AccessBadgeTickerService);

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

  /** The vault table chip's options (`VAULT_ITEM_FILTER`). */
  readonly stateOptions$: Observable<ControlledAccessStateOption[]> = this.offered$(
    CONTROLLED_ACCESS_STATE_FILTERS,
  );

  /**
   * The access state of each gated row in a list, keyed by the list itself so every option
   * narrowed over the same rows shares one read. Weakly held: a superseded list is dropped with it.
   */
  private readonly statesByRows = new WeakMap<
    readonly CipherViewLike[],
    Observable<Map<string, AccessBadgeState>>
  >();

  narrow$<C extends CipherViewLike>(optionId: string, ciphers: C[]): Observable<C[]> {
    const offered = (options: ControlledAccessFilterOption[]) =>
      options.some((option) => option.id === optionId);
    const definition = [...CONTROLLED_ACCESS_FILTERS, ...CONTROLLED_ACCESS_STATE_FILTERS].find(
      (candidate) => candidate.id === optionId,
    );
    return combineLatest([this.options$, this.stateOptions$]).pipe(
      switchMap(([options, stateOptions]) =>
        definition != null && (offered(options) || offered(stateOptions))
          ? this.narrowTo$(definition, ciphers)
          : of(ciphers),
      ),
    );
  }

  /**
   * The vault table chip's matches: each state option's ID → the IDs of the rows in that state.
   * One read per list, shared across options. "In use" and "Ending soon" split the active leases
   * at {@link ENDING_SOON_THRESHOLD_MS}, as the badge does, and a lease that has lapsed is in
   * neither. While any lease is active the split follows the clock, emitting only when a row
   * crosses it.
   *
   * TODO: the states are read once per list, not live on access events. Re-reading on
   * `AccessRefreshService` is PAM follow-up work.
   */
  matches$(
    ciphers: readonly CipherViewLike[],
  ): Observable<ReadonlyMap<string, ReadonlySet<CipherId>>> {
    return this.accessStates$(ciphers).pipe(
      switchMap((states) => {
        const now = Date.now();
        const hasActive = [...states.values()].some((state) => state.kind === "active");
        if (!hasActive) {
          return of(this.matchesAt(states, now));
        }
        return this.ticker.ticks$.pipe(
          startWith(now),
          map((tick) => this.matchesAt(states, tick)),
          distinctUntilChanged(sameMatches),
        );
      }),
    );
  }

  private matchesAt(
    states: ReadonlyMap<string, AccessBadgeState>,
    now: number,
  ): ReadonlyMap<string, ReadonlySet<CipherId>> {
    const byOption = new Map<string, Set<CipherId>>();
    for (const definition of CONTROLLED_ACCESS_STATE_FILTERS) {
      const ids = new Set<CipherId>();
      for (const [id, state] of states) {
        if (admits(definition, state, now)) {
          ids.add(id as CipherId);
        }
      }
      byOption.set(definition.id, ids);
    }
    return byOption;
  }

  sortRanks$(ciphers: readonly CipherViewLike[]): Observable<Map<string, number>> {
    return this.accessKinds$(ciphers).pipe(
      map((kinds) => {
        const ranks = new Map<string, number>();
        for (const [id, kind] of kinds) {
          const rank = SORT_ORDER.indexOf(kind);
          if (rank !== -1) {
            ranks.set(id, rank);
          }
        }
        return ranks;
      }),
    );
  }

  private offered$(
    definitions: readonly ControlledAccessFilterDefinition[],
  ): Observable<ControlledAccessStateOption[]> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.pamOrganizationIds$,
    ]).pipe(
      map(([enabled, pamOrganizationIds]) =>
        enabled && pamOrganizationIds.size > 0
          ? definitions.map(({ id, nameKey, icon, tileVariant }) => ({
              id,
              name: this.i18nService.t(nameKey),
              icon,
              ...(tileVariant != null ? { tileVariant } : {}),
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
    return this.accessKinds$(ciphers).pipe(
      map((kinds) =>
        ciphers.filter((cipher) => {
          const kind = kinds.get(String(cipher.id));
          return kind != null && definition.kinds.includes(kind);
        }),
      ),
    );
  }

  /** The access kind of each restricted row in a PAM organization, by cipher ID. */
  accessKinds$(ciphers: readonly CipherViewLike[]): Observable<Map<string, AccessKind>> {
    return this.accessStates$(ciphers).pipe(
      map((states) => new Map([...states].map(([id, state]) => [id, state.kind]))),
    );
  }

  /** The badge state of each restricted row in a PAM organization, by cipher ID. */
  private accessStates$(
    ciphers: readonly CipherViewLike[],
  ): Observable<Map<string, AccessBadgeState>> {
    const cached = this.statesByRows.get(ciphers);
    if (cached != null) {
      return cached;
    }

    const states$ = this.pamOrganizationIds$.pipe(
      switchMap((pamOrganizationIds) => {
        const candidates = ciphers.filter(
          (cipher) =>
            CipherViewLikeUtils.isRestricted(cipher) &&
            cipher.id != null &&
            cipher.organizationId != null &&
            pamOrganizationIds.has(String(cipher.organizationId)),
        );
        if (candidates.length === 0) {
          return of(new Map<string, AccessBadgeState>());
        }
        return forkJoin(candidates.map((cipher) => this.state$(cipher))).pipe(
          map((states) => {
            const byId = new Map<string, AccessBadgeState>();
            candidates.forEach((cipher, index) => {
              const state = states[index];
              if (state != null) {
                byId.set(String(cipher.id), state);
              }
            });
            return byId;
          }),
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
    this.statesByRows.set(ciphers, states$);
    return states$;
  }

  private state$(cipher: CipherViewLike): Observable<AccessBadgeState | undefined> {
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state) => cipherAccessBadgeState(state) ?? undefined),
      // A failed read is not evidence of any particular state, and listing the row anyway would
      // make the filter overstate what it is showing.
      catchError(() => of(undefined)),
    );
  }
}

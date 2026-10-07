import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, merge, Observable, of, switchMap } from "rxjs";

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

import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { rereadOnLapse } from "../helpers/lease-liveness";

/**
 * Structural, since the host passes its own `CollectionView`/`CollectionAdminView`, which this
 * component must not import. Optional for the vault's pseudo-collections, which carry no flag.
 */
type BadgeCollection = { hasEnabledAccessRule?: boolean };

/**
 * `"none"` means checked and governed by no rule, which draws the em dash. `null` means nothing to
 * say: the feature is off, there is no row, or the lookup failed.
 */
type LeaseBadgeCell = AccessBadgeState | "none" | null;

/**
 * A cipher row re-reads on {@link AccessRefreshService}, so a cancel from its own menu can't leave
 * the badge stale. A collection row never draws the em dash, since an older server's missing
 * `hasEnabledAccessRule` reads as no rule.
 */
@Component({
  selector: "app-pam-vault-row-lease-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent],
  templateUrl: "./vault-row-lease-badge.component.html",
})
export class VaultRowLeaseBadgeComponent {
  readonly cipher = input<CipherViewLike | null>(null);
  readonly collection = input<BadgeCollection | null>(null);

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  protected readonly noAccessRuleLabel = inject(I18nService).t("pamNoAccessRule");

  /**
   * One PAM organization in view turns the column on for every row, so the em dash narrows to rows
   * whose own organization uses PAM.
   */
  private readonly pamOrganizationIds = toSignal(
    this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      switchMap((userId) =>
        userId == null ? of([]) : this.organizationService.organizations$(userId),
      ),
      map(
        (organizations) => new Set<string>(organizations.filter((o) => o.usePam).map((o) => o.id)),
      ),
    ),
    { initialValue: new Set<string>() },
  );

  private readonly cell$: Observable<LeaseBadgeCell> = combineLatest([
    toObservable(this.cipher),
    toObservable(this.collection),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
  ]).pipe(
    switchMap(([cipher, collection, enabled]) => {
      if (!enabled) {
        return of(null);
      }
      if (cipher != null) {
        return this.cipherCell$(cipher);
      }
      if (collection != null) {
        return this.collectionCell$(collection);
      }
      return of(null);
    }),
  );

  private readonly cell = toSignal(this.cell$, { initialValue: null });

  protected readonly badge = computed<AccessBadgeState | null>(() => {
    const cell = this.cell();
    return cell === "none" ? null : cell;
  });

  protected readonly showNoAccessRule = computed(() => {
    if (this.cell() !== "none") {
      return false;
    }
    const organizationId = this.cipher()?.organizationId;
    return organizationId != null && this.pamOrganizationIds().has(String(organizationId));
  });

  private cipherCell$(cipher: CipherViewLike): Observable<LeaseBadgeCell> {
    // The SDK marks a gated cipher `partial`. Not gated is a real answer; no id means the lookup
    // couldn't run.
    if (!CipherViewLikeUtils.isPartial(cipher)) {
      return of("none");
    }
    if (cipher.id == null) {
      return of(null);
    }
    const cipherId = String(cipher.id);
    const read$ = () =>
      from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
        // A failed read is not evidence of anything, so it must not draw the placeholder.
        catchError(() => of(undefined)),
      );
    return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
      switchMap(() => rereadOnLapse(read$, this.ticker.ticks$)),
      map((state): LeaseBadgeCell =>
        state === undefined ? null : (cipherAccessBadgeState(state) ?? "none"),
      ),
    );
  }

  private collectionCell$({ hasEnabledAccessRule }: BadgeCollection): Observable<LeaseBadgeCell> {
    return of(hasEnabledAccessRule === true ? { kind: "privileged" } : null);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

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

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";

/**
 * The collection field the badge reads, structurally — the host passes its own
 * `CollectionView`/`CollectionAdminView`, which this component must not import. Optional, since
 * the vault list also renders pseudo-collections carrying no server state.
 */
type BadgeCollection = { hasEnabledAccessRule?: boolean };

/**
 * What the row's lookup concluded: a badge state, `"none"` for "checked, governed by no rule",
 * or `null` for "nothing to say" — the feature is off, there is no row to check, or the lookup
 * failed. Only `"none"` can draw the em dash, and only a failed lookup must not.
 */
type LeaseBadgeCell = AccessBadgeState | "none" | null;

/**
 * Binds `VAULT_ROW_LEASE_BADGE` for one row in the vault list — cipher or collection. The badge
 * recipe, copy, and countdown live in {@link AccessStateBadgeComponent}.
 *
 * A cipher row fetches access state once per cipher/flag change; a collection row instead shows
 * the resting "Privileged" pill straight off `hasEnabledAccessRule`, at no fetch cost.
 *
 * A cipher row with no rule draws an em dash — distinguishing "checked" from "not loaded" — but
 * a collection row never does, since `hasEnabledAccessRule` defaults `false` and can't tell "no
 * rule" from "server too old".
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
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  protected readonly noAccessRuleLabel = inject(I18nService).t("pamNoAccessRule");

  /**
   * Ids of the organizations that actually carry Privileged Access. The column is table-wide —
   * one PAM-enabled organization anywhere in view turns it on for every row — so the placeholder
   * must be narrowed to the row's own organization here.
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
    // Gating is driven by the SDK's `partial` flag, read through the util since only some
    // `CipherViewLike` members carry it. Not gated is a real answer; no id means the lookup
    // couldn't run.
    if (!CipherViewLikeUtils.isPartial(cipher)) {
      return of("none");
    }
    if (cipher.id == null) {
      return of(null);
    }
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state): LeaseBadgeCell => cipherAccessBadgeState(state) ?? "none"),
      // A failed read is not evidence of anything, so it must not draw the placeholder.
      catchError(() => of(null)),
    );
  }

  private collectionCell$({ hasEnabledAccessRule }: BadgeCollection): Observable<LeaseBadgeCell> {
    return of(hasEnabledAccessRule === true ? { kind: "privileged" } : null);
  }
}

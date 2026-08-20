import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";

/**
 * The collection fields the badge reads, structurally — the host passes its own
 * `CollectionView`/`CollectionAdminView`, which this component must not import to stay
 * decoupled from the admin-console models. Both are optional because the vault list also
 * renders pseudo-collections ("Unassigned"), which carry no server state at all.
 */
type BadgeCollection = { organizationId?: OrganizationId; hasEnabledAccessRule?: boolean };

/**
 * What the row's lookup concluded: a badge state, `"none"` for "checked, governed by no rule",
 * or `null` for "nothing to say" — the feature is off, there is no row to check, or the lookup
 * failed. Only `"none"` can draw the em dash, and only a failed lookup must not.
 */
type LeaseBadgeCell = AccessBadgeState | "none" | null;

/**
 * Binds `VAULT_ROW_LEASE_BADGE` for one row in the vault list — cipher or collection.
 * Encapsulates every PAM dependency so the row components stay PAM-free: pass the row's
 * `cipher` (or a collection row's `collection`), get the shared access-state badge (or
 * nothing) back. The badge recipe, copy, and countdown live in
 * {@link AccessStateBadgeComponent} so every row renders exactly what the modal and
 * Requests page do.
 *
 * A cipher row fetches the cipher's access state once per cipher/flag change (not on an
 * interval — a vault list can render many gated rows at once, and the reveal-in-place
 * behavior that needs live polling lives in the cipher-view banner / gated-cipher reloader,
 * not here). The active-lease countdown ticks locally inside the shared badge once fetched.
 *
 * A collection row shows the resting "Privileged" pill straight off the collection's
 * `hasEnabledAccessRule`, which the server derives on the collection read paths. No fetch: the
 * flag arrives with the collection itself, so the badge costs nothing per row, cannot go stale
 * against the list it is rendered beside, and works for viewers who cannot read the
 * organization's access rules — notably provider users, whom `MemberRequirement` excludes from
 * the access-rules endpoint by design.
 *
 * A row with no rule draws an em dash rather than an empty cell, so "checked, not governed"
 * is distinguishable from "not loaded yet". The placeholder lives here and not in
 * {@link AccessStateBadgeComponent}, which the cipher-view modal and the Requests page also
 * render and where the spec calls for nothing at all.
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

  /**
   * Ids of the organizations that actually carry Privileged Access. The column itself is
   * table-wide — one PAM-enabled organization anywhere in view turns it on for every row — so the
   * placeholder has to be narrowed to the row's own organization here, or a row from an
   * organization that cannot have access rules would claim it was checked against them.
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
    const organizationId = this.cipher()?.organizationId ?? this.collection()?.organizationId;
    return organizationId != null && this.pamOrganizationIds().has(String(organizationId));
  });

  private cipherCell$(cipher: CipherViewLike): Observable<LeaseBadgeCell> {
    // Gating is driven by the SDK's `partial` flag, which only some `CipherViewLike` members
    // carry — read it through the util rather than off the union. No flag or no id — no badge.
    if (!CipherViewLikeUtils.isPartial(cipher) || cipher.id == null) {
      return of("none");
    }
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map((state): LeaseBadgeCell => cipherAccessBadgeState(state) ?? "none"),
      // A failed read is not evidence of anything, so it must not draw the placeholder.
      catchError(() => of(null)),
    );
  }

  private collectionCell$({ hasEnabledAccessRule }: BadgeCollection): Observable<LeaseBadgeCell> {
    return of(hasEnabledAccessRule === true ? { kind: "privileged" } : "none");
  }
}

import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

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
import { rulesGoverningCollection } from "../collection-access-rule-callout/access-rule-summary";
import { GovernedCollectionsService } from "../services/governed-collections.service";

/**
 * The collection fields the badge reads, structurally — the host passes its own
 * `CollectionView`/`CollectionAdminView`, which this component must not import to stay
 * decoupled from the admin-console models. Both are optional because the vault list also
 * renders pseudo-collections ("Unassigned") with no id or organization.
 */
type BadgeCollection = { id?: string; organizationId?: OrganizationId };

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
 * A collection row shows the resting "Privileged" pill when the collection is governed by
 * an enabled access rule — the same claim the collection-dialog callout makes, derived from
 * the same cached per-org `listAccessRules` read ({@link GovernedCollectionsService},
 * readable by any org member) through the same {@link rulesGoverningCollection} predicate.
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
  private readonly governedCollections = inject(GovernedCollectionsService);

  private readonly state$: Observable<AccessBadgeState | null> = combineLatest([
    toObservable(this.cipher),
    toObservable(this.collection),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
  ]).pipe(
    switchMap(([cipher, collection, enabled]) => {
      if (!enabled) {
        return of(null);
      }
      if (cipher != null) {
        return this.cipherState$(cipher);
      }
      if (collection != null) {
        return this.collectionState$(collection);
      }
      return of(null);
    }),
  );

  protected readonly badge = toSignal(this.state$, { initialValue: null });

  private cipherState$(cipher: CipherViewLike): Observable<AccessBadgeState | null> {
    // Gating is driven by the SDK's `partial` flag, which only some `CipherViewLike` members
    // carry — read it through the util rather than off the union. No flag or no id — no badge.
    if (!CipherViewLikeUtils.isPartial(cipher) || cipher.id == null) {
      return of(null);
    }
    return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
      map(cipherAccessBadgeState),
      catchError(() => of(null)),
    );
  }

  private collectionState$({ id, organizationId }: BadgeCollection) {
    if (id == null || organizationId == null) {
      return of(null);
    }
    return this.governedCollections
      .rules$(organizationId)
      .pipe(
        map((rules): AccessBadgeState | null =>
          rulesGoverningCollection(rules, id).length > 0 ? { kind: "privileged" } : null,
        ),
      );
  }
}

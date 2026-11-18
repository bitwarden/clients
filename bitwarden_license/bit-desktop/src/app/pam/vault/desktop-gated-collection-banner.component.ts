import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, distinctUntilChanged, map, of, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { callerOrganizations$, unlicensedForPam } from "@bitwarden/bit-pam";
import { GatedCollectionBannerComponent } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";
import { VaultGatedCollectionBanner } from "@bitwarden/desktop/vault/app/vault-v3/vault-gated-collection-banner.token";

/**
 * Binds `VAULT_GATED_COLLECTION_BANNER`. A licensed member gets the shared
 * `GatedCollectionBannerComponent` unchanged. A member without a Privileged Controls license
 * (`unlicensedForPam`) cannot request access, so a governed shared folder instead says why and
 * what to do next, the same way the cipher-view banner's unlicensed card does for one item.
 *
 * The unlicensed branch reads the synced collection's server-derived `hasEnabledAccessRule`
 * rather than the access-rule list, which a seatless member may be refused.
 */
@Component({
  selector: "app-pam-desktop-gated-collection-banner",
  templateUrl: "./desktop-gated-collection-banner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule, GatedCollectionBannerComponent],
})
export class DesktopGatedCollectionBannerComponent implements VaultGatedCollectionBanner {
  readonly organizationId = input<OrganizationId | undefined>(undefined);
  readonly collectionId = input<CollectionId | undefined>(undefined);

  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly collectionService = inject(CollectionService);
  private readonly i18nService = inject(I18nService);

  protected readonly bannerName = this.i18nService.t("pamGatedCollectionBannerName");
  protected readonly unlicensedLabel = this.i18nService.t("pamSharedFolderUnlicensed");

  private readonly selected = computed(() => ({
    id: this.collectionId(),
    organizationId: this.organizationId(),
  }));

  /**
   * `undefined` until the membership read lands, so neither banner flashes before the verdict;
   * `false` with the flag off, so the shared banner keeps its own flag handling.
   */
  protected readonly unlicensed = toSignal(
    combineLatest([
      toObservable(this.organizationId),
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      callerOrganizations$(this.accountService, this.organizationService),
    ]).pipe(
      map(
        ([organizationId, enabled, organizations]) =>
          enabled &&
          organizationId != null &&
          unlicensedForPam(organizations.find((o) => o.id === organizationId)),
      ),
      distinctUntilChanged(),
    ),
    { initialValue: undefined },
  );

  /** Whether an enabled access rule governs the selected shared folder, per the last sync. */
  protected readonly governed = toSignal(
    combineLatest([
      toObservable(this.selected),
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    ]).pipe(
      switchMap(([{ id, organizationId }, userId]) =>
        id == null || organizationId == null || userId == null
          ? of(false)
          : this.collectionService
              .encryptedCollections$(userId)
              .pipe(
                map(
                  (collections) =>
                    collections?.some(
                      (c) =>
                        c.id === id &&
                        c.organizationId === organizationId &&
                        c.hasEnabledAccessRule === true,
                    ) ?? false,
                ),
              ),
      ),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );
}

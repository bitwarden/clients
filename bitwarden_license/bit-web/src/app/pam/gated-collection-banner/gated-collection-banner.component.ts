import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";
import { VaultGatedCollectionBanner } from "@bitwarden/web-vault/app/vault/individual-vault/vault-gated-collection-banner.token";

import { gatedCollection } from "../services/gated-collection";

/**
 * Notice above the vault's item list while a governed collection is the active filter. Reuses the
 * sidebar lock's tooltip string, so both surfaces describe the restriction the same way.
 */
@Component({
  selector: "app-pam-gated-collection-banner",
  templateUrl: "./gated-collection-banner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule],
})
export class GatedCollectionBannerComponent implements VaultGatedCollectionBanner {
  readonly organizationId = input<OrganizationId | undefined>(undefined);
  readonly collectionId = input<CollectionId | undefined>(undefined);

  private readonly i18nService = inject(I18nService);

  protected readonly bannerName = this.i18nService.t("pamGatedCollectionBannerName");
  protected readonly requiresRequestLabel = this.i18nService.t("pamCollectionRequiresRequest");

  private readonly selected = computed(() => ({
    id: this.collectionId(),
    organizationId: this.organizationId(),
  }));

  protected readonly gated = gatedCollection(this.selected);
}

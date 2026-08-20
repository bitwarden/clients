import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";

import { gatedCollection } from "../services/gated-collection";

/**
 * Explains, above the vault's item list, that the collection currently being viewed opens through
 * a request. Without it the list reads as an ordinary collection whose rows happen to be
 * unavailable, with nothing on screen saying why.
 *
 * Bound to `VAULT_GATED_COLLECTION_BANNER` in `provide-pam.ts`. The host passes the selected
 * collection only when exactly one is the active filter, so "All items" and the pseudo-collections
 * never reach this component; whether the collection is governed is decided by the shared
 * {@link gatedCollection} check so the vault stays PAM-free.
 *
 * The sentence is the sidebar lock's tooltip string verbatim, by the same requirement that keeps
 * the two surfaces describing one restriction the same way.
 */
@Component({
  selector: "app-pam-gated-collection-banner",
  templateUrl: "./gated-collection-banner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule],
})
export class GatedCollectionBannerComponent {
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

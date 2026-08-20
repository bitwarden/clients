import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconComponent } from "@bitwarden/components";

import { gatedCollection, GatedCollection } from "../services/gated-collection";

/**
 * Binds `VAULT_FILTER_GATED_COLLECTION_INDICATOR` for one collection in the vault's Filters
 * sidebar: a lock glyph on collections an enabled access rule governs, so a member can tell
 * before clicking that its items open through a request. Encapsulates every PAM dependency so
 * the sidebar stays PAM-free.
 *
 * Whether the collection is governed is decided by the shared {@link gatedCollection} check, the
 * same one behind the vault banner, the collection-row badge and the collection-dialog callout.
 */
@Component({
  selector: "app-pam-gated-collection-filter-indicator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: "./gated-collection-filter-indicator.component.html",
})
export class GatedCollectionFilterIndicatorComponent {
  readonly collection = input<GatedCollection | null>(null);

  protected readonly requiresRequestLabel = inject(I18nService).t("pamCollectionRequiresRequest");

  protected readonly gated = gatedCollection(this.collection);
}

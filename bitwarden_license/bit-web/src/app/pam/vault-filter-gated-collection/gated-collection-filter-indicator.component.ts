import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconComponent } from "@bitwarden/components";

/**
 * The collection field the indicator reads, structurally — the sidebar passes its own
 * `CollectionFilter` node, which this component must not import. Optional, since the sidebar
 * also renders pseudo-collections carrying no server state.
 */
type FilterCollection = { hasEnabledAccessRule?: boolean };

/**
 * Binds `VAULT_FILTER_GATED_COLLECTION_INDICATOR` for one collection in the vault's Filters
 * sidebar: a lock glyph on collections an enabled access rule governs, so a member can tell
 * before clicking that its items open through a request.
 *
 * Reads the collection's own server-derived `hasEnabledAccessRule`, not a `listAccessRules`
 * read — the same source the collection-row "Privileged" pill uses.
 * `VaultFilterService.buildCollectionTree` carries the flag onto the sidebar's node explicitly,
 * since its clone otherwise resets it to `false`; this costs nothing per collection and, unlike
 * a rules read, works for a provider browsing a client org, since `listAccessRules` requires
 * membership a provider lacks.
 */
@Component({
  selector: "app-pam-gated-collection-filter-indicator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: "./gated-collection-filter-indicator.component.html",
})
export class GatedCollectionFilterIndicatorComponent {
  readonly collection = input<FilterCollection | null>(null);

  private readonly configService = inject(ConfigService);

  protected readonly requiresRequestLabel = inject(I18nService).t("pamCollectionRequiresRequest");

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  protected readonly gated = computed(
    () => this.pamEnabled() && this.collection()?.hasEnabledAccessRule === true,
  );
}

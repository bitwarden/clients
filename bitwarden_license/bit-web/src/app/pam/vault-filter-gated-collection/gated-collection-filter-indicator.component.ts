import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconComponent } from "@bitwarden/components";

/** Structural, so this needn't import the sidebar's node type; optional for pseudo-collections. */
type FilterCollection = { hasEnabledAccessRule?: boolean };

/**
 * Lock glyph on a governed collection in the Filters sidebar. Reads the server-derived
 * `hasEnabledAccessRule`, which unlike `listAccessRules` needs no membership, so providers see it.
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

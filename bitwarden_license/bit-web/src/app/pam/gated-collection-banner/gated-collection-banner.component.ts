import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CalloutModule } from "@bitwarden/components";
import { VaultGatedCollectionBanner } from "@bitwarden/web-vault/app/vault/individual-vault/vault-gated-collection-banner.token";

/** Structural, so this needn't import the host's collection model. */
type BannerCollection = { hasEnabledAccessRule?: boolean };

/**
 * Notice above the vault's item list while a governed collection is the active filter. Reads the
 * server-derived `hasEnabledAccessRule`, like the sidebar lock, and reuses its tooltip string, so
 * both surfaces describe the restriction the same way.
 */
@Component({
  selector: "app-pam-gated-collection-banner",
  templateUrl: "./gated-collection-banner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule],
})
export class GatedCollectionBannerComponent implements VaultGatedCollectionBanner {
  readonly collection = input<BannerCollection | null | undefined>(undefined);

  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);

  protected readonly bannerName = this.i18nService.t("pamGatedCollectionBannerName");
  protected readonly requiresRequestLabel = this.i18nService.t("pamSharedFolderRequiresRequest");

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  protected readonly gated = computed(
    () => this.pamEnabled() && this.collection()?.hasEnabledAccessRule === true,
  );
}

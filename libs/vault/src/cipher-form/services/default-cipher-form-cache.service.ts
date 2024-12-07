import { inject, Injectable } from "@angular/core";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

const POPUP_CIPHER_CACHE_KEY = "popup-cipher-cache";

@Injectable()
export class CipherFormCacheService {
  private popupViewCacheService: ViewCacheService = inject(ViewCacheService);
  private configService: ConfigService = inject(ConfigService);

  /** True when the `PM9111ExtensionPersistAddEditForm` flag is enabled */
  private featureEnabled: boolean;

  /**
   * When true the `CipherFormCacheService` a cipher was stored in cache when the service was initialized.
   * Otherwise false, when the cache was empty.
   *
   * This is helpful to know the initial state of the cache as it can be populated quickly after initialization.
   */
  initializedWithValue: boolean;

  private cipherCache = this.popupViewCacheService.signal<CipherView | null>({
    key: POPUP_CIPHER_CACHE_KEY,
    initialValue: null,
    deserializer: (obj) => (obj ? CipherView.fromJSON(obj) : null),
  });

  constructor() {
    this.initializedWithValue = !!this.cipherCache();
  }

  /**
   * Must be called once before interacting with the cached cipher, otherwise methods will be noop.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9111ExtensionPersistAddEditForm,
    );

    if (!this.featureEnabled) {
      this.initializedWithValue = false;
    }
  }

  /**
   * Update the cache with the new CipherView.
   */
  cacheCipherView(cipherView: CipherView): void {
    if (!this.featureEnabled) {
      return;
    }

    // Create a new shallow reference to force the signal to update
    this.cipherCache.set({ ...cipherView } as CipherView);
  }

  /**
   * Returns the cached CipherView when available.
   */
  getCachedCipherView(): CipherView | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.cipherCache();
  }
}

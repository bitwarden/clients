import { inject, Injectable } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

const CIPHER_FORM_CACHE_KEY = "cipher-form-cache";

@Injectable()
export class CipherFormCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);

  /**
   * When true the `CipherFormCacheService` a cipher was stored in cache when the service was initialized.
   * Otherwise false, when the cache was empty.
   *
   * This is helpful to know the initial state of the cache as it can be populated quickly after initialization.
   */
  initializedWithValue: boolean;

  private cipherCache = this.viewCacheService.signal<CipherView | null>({
    key: CIPHER_FORM_CACHE_KEY,
    initialValue: null,
    deserializer: CipherView.fromJSON,
  });

  constructor() {
    this.initializedWithValue = !!this.cipherCache();
  }

  /**
   * Update the cache with the new CipherView.
   */
  cacheCipherView(cipherView: CipherView): void {
    // Create a new reference to force the signal to update
    // By default, signals use `Object.is` to determine equality
    // Docs: https://angular.dev/guide/signals#signal-equality-functions
    this.cipherCache.set(CipherView.fromJSON(cipherView as Jsonify<CipherView>));
  }

  /**
   * Returns the cached CipherView when available.
   */
  getCachedCipherView(): CipherView | null {
    return this.cipherCache();
  }

  /**
   * Clear the cached CipherView.
   */
  clearCache(): void {
    this.cipherCache.set(null);
  }
}

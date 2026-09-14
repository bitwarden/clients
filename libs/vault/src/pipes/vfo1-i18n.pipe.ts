import { inject, Pipe, PipeTransform } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { Vfo1TerminologyService } from "../services/vfo1-terminology.service";

/**
 * Pipe for translating keys with support for vault terminology feature flag.
 * This pipe is impure because it depends on the feature flag state, which can change at runtime.
 * It caches the last translation result to avoid unnecessary calls to the i18n service when the inputs haven't changed.
 */
@Pipe({ name: "vfo1I18n", standalone: true, pure: false })
export class Vfo1I18nPipe implements PipeTransform {
  private i18nService = inject(I18nService);
  private terminology = inject(Vfo1TerminologyService);

  private last?: {
    legacy: string;
    next: string;
    enabled: boolean;
    params: (string | number)[];
    out: string;
  };

  transform(legacyKey: string, newKey: string, ...params: (string | number)[]): string {
    const enabled = this.terminology.enabled();
    if (
      this.last &&
      this.last.legacy === legacyKey &&
      this.last.next === newKey &&
      this.last.enabled === enabled &&
      this.last.params.length === params.length &&
      this.last.params.every((p, i) => p === params[i])
    ) {
      return this.last.out;
    }

    const out = this.i18nService.t(enabled ? newKey : legacyKey, ...params);

    // Cache the result for future calls with the same inputs
    this.last = { legacy: legacyKey, next: newKey, enabled, params, out };

    return out;
  }
}

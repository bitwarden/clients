import { Pipe, PipeTransform } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * Localizes the specified string.
 *
 * @example
 * {{ 'key' | i18n }}
 *
 * @example
 * {{ 'key' | i18n: 'param1' }}
 */
@Pipe({
  name: "i18n",
})
export class I18nPipe implements PipeTransform {
  constructor(private i18nService: I18nService) {}

  transform(id: string, p1?: string, p2?: string, p3?: string): string {
    return this.i18nService.t(id, p1, p2, p3);
  }
}

import { Pipe, PipeTransform } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * @deprecated: Please use the I18nPipe from @bitwarden/ui-common
 */
@Pipe({
  name: "i18n",
})
export class I18nPipe implements PipeTransform {
  constructor(private i18nService: I18nService) {}

  transform(id: string, p1?: string | number, p2?: string | number, p3?: string | number): string {
    return this.i18nService.t(id, p1, p2, p3);
  }
}

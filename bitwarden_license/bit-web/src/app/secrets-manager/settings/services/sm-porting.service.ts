// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { formatDate } from "@angular/common";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Injectable({
  providedIn: "root",
})
export class SecretsManagerPortingService {
  constructor(private i18nService: I18nService) {}

  async getFileName(prefix: string = null, extension = "json"): Promise<string> {
    const locale = await firstValueFrom(this.i18nService.locale$);
    const dateString = formatDate(new Date(), "yyyyMMddHHmmss", locale);
    return "bitwarden" + (prefix ? "_" + prefix : "") + "_export_" + dateString + "." + extension;
  }
}

import { inject } from "@angular/core";
import { ResolveFn } from "@angular/router";
import { map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export const sponsoredFamiliesTitleResolver: ResolveFn<string | null> = () => {
  const configService = inject(ConfigService);
  const i18nService = inject(I18nService);

  return configService
    .getFeatureFlag$(FeatureFlag.VFO1Foundation)
    .pipe(map((enabled) => (enabled ? i18nService.t("acceptSponsoredFamiliesPlan") : null)));
};

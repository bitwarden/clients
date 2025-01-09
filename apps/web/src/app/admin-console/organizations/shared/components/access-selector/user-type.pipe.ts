import { Pipe, PipeTransform } from "@angular/core";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Pipe({
  name: "userType",
})
export class UserTypePipe implements PipeTransform {
  constructor(private i18nService: I18nService) {}

  transform(value?: OrganizationUserType, unknownText?: string): string {
    if (value == null) {
      return unknownText ?? this.i18nService.t("unknown");
    }
    switch (value) {
      case OrganizationUserType.Owner:
        return this.i18nService.t("owner");
      case OrganizationUserType.Admin:
        return this.i18nService.t("admin");
      case OrganizationUserType.User:
        return this.i18nService.t("user");
      case OrganizationUserType.Custom:
        return this.i18nService.t("custom");
    }
  }
}

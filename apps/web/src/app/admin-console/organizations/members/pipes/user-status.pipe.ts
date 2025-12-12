import { Pipe, PipeTransform } from "@angular/core";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Pipe({
  name: "userStatus",
  standalone: false,
})
export class UserStatusPipe implements PipeTransform {
  constructor(private i18nService: I18nService) {}

  transform(value?: OrganizationUserStatusType): string {
    if (value == null) {
      return this.i18nService.t("unknown");
    }
    switch (value) {
      case OrganizationUserStatusType.Invited:
        return this.i18nService.t("invited");
      case OrganizationUserStatusType.Accepted:
        return this.i18nService.t("accepted");
      case OrganizationUserStatusType.Confirmed:
        return this.i18nService.t("confirmed");
      case OrganizationUserStatusType.Revoked:
        return this.i18nService.t("revoked");
      default:
        return this.i18nService.t("unknown");
    }
  }
}

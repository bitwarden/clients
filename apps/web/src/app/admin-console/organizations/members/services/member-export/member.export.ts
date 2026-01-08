import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationUserView } from "../../../core";
import { UserStatusPipe } from "../../pipes";

export class MemberExport {
  /**
   * @param user Organization user to export
   * @returns a Record<string, string> of each column header key, value
   * All property members must be a string for export purposes. Null and undefined will appear as
   * "null" in a .csv export, therefore an empty string is preferable to a nullish type.
   */
  static fromOrganizationUserView(
    i18nService: I18nService,
    userTypePipe: UserTypePipe,
    userStatusPipe: UserStatusPipe,
    user: OrganizationUserView,
  ): Record<string, string> {
    const result = {
      [i18nService.t("email")]: user.email,
      [i18nService.t("name")]: user.name ?? "",
      [i18nService.t("status")]: userStatusPipe.transform(user.status),
      [i18nService.t("role")]: userTypePipe.transform(user.type),

      [i18nService.t("twoStepLogin")]: user.twoFactorEnabled
        ? i18nService.t("optionEnabled")
        : i18nService.t("disabled"),

      [i18nService.t("accountRecovery")]: user.resetPasswordEnrolled
        ? i18nService.t("enrolled")
        : i18nService.t("notEnrolled"),

      [i18nService.t("secretsManager")]: user.accessSecretsManager
        ? i18nService.t("optionEnabled")
        : i18nService.t("disabled"),

      [i18nService.t("groups")]: user.groupNames?.join(", ") ?? "",
    };

    return result;
  }
}

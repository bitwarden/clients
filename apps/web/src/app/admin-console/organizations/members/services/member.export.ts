import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationUserView } from "../../core/views/organization-user.view";

export class MemberExport {
  email: string;
  name: string;
  status: string;
  role: string;
  twoStepLogin: string;
  accountRecovery: string;
  secretsManager: string;
  groups: string;

  constructor(user: OrganizationUserView, i18nService: I18nService) {
    this.email = user.email;
    this.name = user.name ?? "";
    this.status = this.getStatusString(user.status, i18nService);
    this.role = this.getRoleString(user.type, i18nService);
    this.twoStepLogin = user.twoFactorEnabled
      ? i18nService.t("enabled")
      : i18nService.t("disabled");
    this.accountRecovery = user.resetPasswordEnrolled
      ? i18nService.t("enrolled")
      : i18nService.t("notEnrolled");
    this.secretsManager = user.accessSecretsManager
      ? i18nService.t("enabled")
      : i18nService.t("disabled");
    this.groups = user.groupNames?.join(", ") ?? "";
  }

  private getStatusString(status: OrganizationUserStatusType, i18nService: I18nService): string {
    switch (status) {
      case OrganizationUserStatusType.Invited:
        return i18nService.t("invited");
      case OrganizationUserStatusType.Accepted:
        return i18nService.t("accepted");
      case OrganizationUserStatusType.Confirmed:
        return i18nService.t("confirmed");
      case OrganizationUserStatusType.Revoked:
        return i18nService.t("revoked");
      default:
        return "";
    }
  }

  private getRoleString(type: OrganizationUserType, i18nService: I18nService): string {
    switch (type) {
      case OrganizationUserType.Owner:
        return i18nService.t("owner");
      case OrganizationUserType.Admin:
        return i18nService.t("admin");
      case OrganizationUserType.User:
        return i18nService.t("user");
      case OrganizationUserType.Custom:
        return i18nService.t("custom");
      default:
        return "";
    }
  }
}

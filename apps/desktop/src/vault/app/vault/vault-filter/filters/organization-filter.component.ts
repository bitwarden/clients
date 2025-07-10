// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";

import { OrganizationFilterComponent as BaseOrganizationFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/organization-filter.component";
import { DisplayMode } from "@bitwarden/angular/vault/vault-filter/models/display-mode";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-organization-filter",
  templateUrl: "organization-filter.component.html",
  standalone: false,
})
export class OrganizationFilterComponent extends BaseOrganizationFilterComponent {
  get show() {
    const hiddenDisplayModes: DisplayMode[] = [
      "singleOrganizationAndOrganizatonDataOwnershipPolicies",
    ];
    return (
      !this.hide &&
      this.organizations.length > 0 &&
      hiddenDisplayModes.indexOf(this.displayMode) === -1
    );
  }

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {
    super();
  }

  async applyOrganizationFilter(organization: Organization) {
    if (organization.enabled) {
      //proceed with default behaviour for enabled organizations
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      super.applyOrganizationFilter(organization);
    } else {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("disabledOrganizationFilterError"),
      });
    }
  }
}

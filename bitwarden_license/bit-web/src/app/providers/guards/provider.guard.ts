import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";

@Injectable()
export class ProviderGuard implements CanActivate {
  constructor(
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private providerService: ProviderServiceAbstraction
  ) {}

  async canActivate(route: ActivatedRouteSnapshot) {
    const provider = await this.providerService.get(route.params.providerId);
    if (provider == null) {
      this.router.navigate(["/"]);
      return false;
    }
    if (!provider.isProviderAdmin && !provider.enabled) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("providerIsDisabled"));
      this.router.navigate(["/"]);
      return false;
    }

    return true;
  }
}

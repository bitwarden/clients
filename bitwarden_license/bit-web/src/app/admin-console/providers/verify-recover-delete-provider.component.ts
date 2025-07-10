// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, SecurityContext } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderVerifyRecoverDeleteRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-verify-recover-delete.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-verify-recover-delete-provider",
  templateUrl: "verify-recover-delete-provider.component.html",
  standalone: false,
})
export class VerifyRecoverDeleteProviderComponent implements OnInit {
  name: string;

  private providerId: string;
  private token: string;

  constructor(
    private router: Router,
    private providerApiService: ProviderApiServiceAbstraction,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private sanitizer: DomSanitizer,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.queryParams);
    if (qParams.providerId != null && qParams.token != null && qParams.name != null) {
      this.providerId = qParams.providerId;
      this.token = qParams.token;
      this.name =
        qParams.name && typeof qParams.name === "string"
          ? this.sanitizer.sanitize(SecurityContext.HTML, qParams.name) || ""
          : "";
    } else {
      await this.router.navigate(["/"]);
    }
  }

  submit = async () => {
    const request = new ProviderVerifyRecoverDeleteRequest(this.token);
    await this.providerApiService.providerRecoverDeleteToken(this.providerId, request);
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("providerDeleted"),
      message: this.i18nService.t("providerDeletedDesc"),
    });
    await this.router.navigate(["/"]);
  };
}

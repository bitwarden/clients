import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider-api.service.abstraction";
import { SyncService } from "@bitwarden/common/abstractions/sync.service";
import { ProviderUpdateRequest } from "@bitwarden/common/models/request/provider/providerUpdateRequest";
import { ProviderResponse } from "@bitwarden/common/models/response/provider/providerResponse";

@Component({
  selector: "provider-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  selfHosted = false;
  loading = true;
  provider: ProviderResponse;
  formPromise: Promise<any>;
  taxFormPromise: Promise<any>;

  private providerId: string;

  constructor(
    private providerApiService: ProviderApiServiceAbstraction,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private syncService: SyncService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService
  ) {}

  async ngOnInit() {
    this.selfHosted = this.platformUtilsService.isSelfHost();
    this.route.parent.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;
      try {
        this.provider = await this.providerApiService.get(this.providerId);
      } catch (e) {
        this.logService.error(`Handled exception: ${e}`);
      }
    });
    this.loading = false;
  }

  async submit() {
    try {
      const request = new ProviderUpdateRequest();
      request.name = this.provider.name;
      request.businessName = this.provider.businessName;
      request.billingEmail = this.provider.billingEmail;

      this.formPromise = this.providerApiService.update(this.providerId, request).then(() => {
        return this.syncService.fullSync(true);
      });
      await this.formPromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("providerUpdated"));
    } catch (e) {
      this.logService.error(`Handled exception: ${e}`);
    }
  }
}

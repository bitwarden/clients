import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ValidationService } from "@bitwarden/angular/services/validation.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider-api.service.abstraction";
import { SyncService } from "@bitwarden/common/abstractions/sync.service";
import { ProviderSetupRequest } from "@bitwarden/common/models/request/provider/providerSetupRequest";

@Component({
  selector: "provider-setup",
  templateUrl: "setup.component.html",
})
export class SetupComponent implements OnInit {
  loading = true;
  authed = false;
  email: string;
  formPromise: Promise<any>;

  providerId: string;
  token: string;
  name: string;
  billingEmail: string;

  constructor(
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private cryptoService: CryptoService,
    private providerApiService: ProviderApiServiceAbstraction,
    private syncService: SyncService,
    private validationService: ValidationService
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      const error = qParams.providerId == null || qParams.email == null || qParams.token == null;

      if (error) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("emergencyInviteAcceptFailed"),
          { timeout: 10000 }
        );
        this.router.navigate(["/"]);
        return;
      }

      this.providerId = qParams.providerId;
      this.token = qParams.token;

      // Check if provider exists, redirect if it does
      try {
        const provider = await this.providerApiService.get(this.providerId);
        if (provider.name != null) {
          this.router.navigate(["/providers", provider.id], { replaceUrl: true });
        }
      } catch (e) {
        this.validationService.showError(e);
        this.router.navigate(["/"]);
      }
    });
  }

  async submit() {
    this.formPromise = this.doSubmit();
    await this.formPromise;
    this.formPromise = null;
  }

  async doSubmit() {
    try {
      const shareKey = await this.cryptoService.makeShareKey();
      const key = shareKey[0].encryptedString;

      const request = new ProviderSetupRequest();
      request.name = this.name;
      request.billingEmail = this.billingEmail;
      request.token = this.token;
      request.key = key;

      const provider = await this.providerApiService.setup(this.providerId, request);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("providerSetup"));
      await this.syncService.fullSync(true);

      this.router.navigate(["/providers", provider.id]);
    } catch (e) {
      this.validationService.showError(e);
    }
  }
}

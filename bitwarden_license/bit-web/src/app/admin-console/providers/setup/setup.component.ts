import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderSetupRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-setup.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ProviderKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

@Component({
  selector: "provider-setup",
  templateUrl: "setup.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
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
    private apiService: ApiService,
    private syncService: SyncService,
    private validationService: ValidationService
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
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
        const provider = await this.apiService.getProvider(this.providerId);
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
      const providerKey = await this.cryptoService.makeOrgKey<ProviderKey>();
      const key = providerKey[0].encryptedString;

      const request = new ProviderSetupRequest();
      request.name = this.name;
      request.billingEmail = this.billingEmail;
      request.token = this.token;
      request.key = key;

      const provider = await this.apiService.postProviderSetup(this.providerId, request);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("providerSetup"));
      await this.syncService.fullSync(true);

      this.router.navigate(["/providers", provider.id]);
    } catch (e) {
      this.validationService.showError(e);
    }
  }
}

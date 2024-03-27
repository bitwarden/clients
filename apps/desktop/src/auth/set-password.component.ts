import { Component, NgZone, OnDestroy } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { SetPasswordComponent as BaseSetPasswordComponent } from "@bitwarden/angular/auth/components/set-password.component";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

const BroadcasterSubscriptionId = "SetPasswordComponent";

@Component({
  selector: "app-set-password",
  templateUrl: "set-password.component.html",
})
export class SetPasswordComponent extends BaseSetPasswordComponent implements OnDestroy {
  constructor(
    accountService: AccountService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    apiService: ApiService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    policyApiService: PolicyApiServiceAbstraction,
    policyService: PolicyService,
    router: Router,
    syncService: SyncService,
    route: ActivatedRoute,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    stateService: StateService,
    organizationApiService: OrganizationApiServiceAbstraction,
    organizationUserService: OrganizationUserService,
    userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    dialogService: DialogService,
  ) {
    super(
      accountService,
      masterPasswordService,
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyApiService,
      policyService,
      router,
      apiService,
      syncService,
      route,
      stateService,
      organizationApiService,
      organizationUserService,
      userDecryptionOptionsService,
      ssoLoginService,
      dialogService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          default:
        }
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  onWindowHidden() {
    this.showPassword = false;
  }

  protected async onSetPasswordSuccess(
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
    keyPair: [string, EncString],
  ): Promise<void> {
    await super.onSetPasswordSuccess(masterKey, userKey, keyPair);
    this.messagingService.send("redrawMenu");
  }
}

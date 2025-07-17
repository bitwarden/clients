import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { SetPasswordComponent as BaseSetPasswordComponent } from "@bitwarden/angular/auth/components/set-password.component";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

const BroadcasterSubscriptionId = "SetPasswordComponent";

@Component({
  selector: "app-set-password",
  templateUrl: "set-password.component.html",
  standalone: false,
})
export class SetPasswordComponent extends BaseSetPasswordComponent implements OnInit, OnDestroy {
  constructor(
    protected accountService: AccountService,
    protected dialogService: DialogService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected messagingService: MessagingService,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected platformUtilsService: PlatformUtilsService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: PolicyService,
    protected route: ActivatedRoute,
    protected router: Router,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected syncService: SyncService,
    protected toastService: ToastService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
  ) {
    super(
      accountService,
      dialogService,
      encryptService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      messagingService,
      organizationApiService,
      organizationUserApiService,
      platformUtilsService,
      policyApiService,
      policyService,
      route,
      router,
      ssoLoginService,
      syncService,
      toastService,
      userDecryptionOptionsService,
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

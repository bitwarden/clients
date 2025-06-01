import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  DefaultSetInitialPasswordService,
  SetInitialPasswordService,
} from "@bitwarden/auth/angular";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { postLogoutMessageListener$ } from "../../../auth/popup/utils/post-logout-message-listener";

export class WebSetInitialPasswordService
  extends DefaultSetInitialPasswordService
  implements SetInitialPasswordService
{
  constructor(
    protected apiService: ApiService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected messagingService: MessagingService,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private router: Router,
  ) {
    super(
      apiService,
      masterPasswordApiService,
      messagingService,
      keyService,
      encryptService,
      i18nService,
      kdfConfigService,
      masterPasswordService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
    );
  }

  override async logoutAndOptionallyNavigate() {
    // start listening for "switchAccountFinish" or "doneLoggingOut"
    const messagePromise = firstValueFrom(postLogoutMessageListener$);
    this.messagingService.send("logout");

    // wait for messages
    const command = await messagePromise;

    // doneLoggingOut already has a message handler that will navigate us
    if (command === "switchAccountFinish") {
      await this.router.navigate(["/"]);
    }
  }
}

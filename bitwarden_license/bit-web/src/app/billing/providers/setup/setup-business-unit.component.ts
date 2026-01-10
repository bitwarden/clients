import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { filter, map, switchMap } from "rxjs/operators";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ProviderKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import { BaseAcceptComponent } from "@bitwarden/web-vault/app/common/base.accept.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./setup-business-unit.component.html",
  standalone: false,
})
export class SetupBusinessUnitComponent extends BaseAcceptComponent {
  protected bitwardenLogo = BitwardenLogo;

  failedMessage = "emergencyInviteAcceptFailed";
  failedShortMessage = "emergencyInviteAcceptFailedShort";
  requiredParameters = ["organizationId", "email", "token"];

  constructor(
    activatedRoute: ActivatedRoute,
    authService: AuthService,
    private billingNotificationService: BillingNotificationService,
    private encryptService: EncryptService,
    i18nService: I18nService,
    private keyService: KeyService,
    private organizationBillingApiService: OrganizationBillingApiServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    router: Router,
    private stateProvider: StateProvider,
    private syncService: SyncService,
  ) {
    super(router, platformUtilsService, i18nService, activatedRoute, authService);
  }

  async authedHandler(queryParams: Params) {
    await this.process(queryParams);
  }

  async unauthedHandler(_: Params) {}

  async login() {
    await this.router.navigate(["/login"], { queryParams: { email: this.email } });
  }

  process = async (queryParams: Params): Promise<boolean> => {
    const fail = async () => {
      this.billingNotificationService.showError(this.i18nService.t(this.failedMessage));
      return await this.router.navigate(["/"]);
    };

    const organizationId = queryParams.organizationId as string;
    const token = queryParams.token as string;

    if (!organizationId || !token) {
      return await fail();
    }

    const activeUserId$ = this.stateProvider.activeUserId$.pipe(
      filter((userId): userId is NonNullable<typeof userId> => userId != null),
    );

    const organizationKey$ = activeUserId$.pipe(
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter(
        (organizationKeysById): organizationKeysById is NonNullable<typeof organizationKeysById> =>
          organizationKeysById != null && organizationId in organizationKeysById,
      ),
      map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
    );

    const userId = await firstValueFrom(activeUserId$);
    const [{ encryptedString: encryptedProviderKey }, providerKey] =
      await this.keyService.makeOrgKey<ProviderKey>(userId);

    const organizationKey = await firstValueFrom(organizationKey$);

    const { encryptedString: encryptedOrganizationKey } =
      await this.encryptService.wrapSymmetricKey(organizationKey, providerKey);

    if (!encryptedProviderKey || !encryptedOrganizationKey) {
      return await fail();
    }

    const request = {
      userId,
      token,
      providerKey: encryptedProviderKey,
      organizationKey: encryptedOrganizationKey,
    };

    try {
      const providerId = await this.organizationBillingApiService.setupBusinessUnit(
        organizationId,
        request,
      );
      await this.syncService.fullSync(true);
      this.billingNotificationService.showSuccess(this.i18nService.t("providerSetup"));
      return await this.router.navigate(["/providers", providerId]);
    } catch (error) {
      this.billingNotificationService.handleError(error);
      return false;
    }
  };
}

import { Component, DestroyRef, NgZone } from "@angular/core";
import { Router } from "@angular/router";


import { CollectionService } from "@bitwarden/admin-console/common";
import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { LockService, UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeoutService,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SystemService } from "@bitwarden/common/platform/abstractions/system.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { StateEventRunnerService } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { AppComponent as BaseAppComponent } from "@bitwarden/desktop/app/app.component";
import { DesktopAutotypeDefaultSettingPolicy } from "@bitwarden/desktop/autofill/services/desktop-autotype-policy.service";
import { KeyService, BiometricStateService } from "@bitwarden/key-management";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-root",
  styles: [],
  template: ` <ng-template #settings></ng-template>
    <ng-template #premium></ng-template>
    <ng-template #passwordHistory></ng-template>
    <ng-template #exportVault></ng-template>
    <ng-template #appGenerator></ng-template>
    <ng-template #loginApproval></ng-template>
    <app-header *ngIf="this.showHeader$ | async"></app-header>

    <div id="container">
      <div class="loading" *ngIf="loading">
        <i class="bwi bwi-spinner bwi-spin bwi-3x" aria-hidden="true"></i>
      </div>
      <router-outlet *ngIf="!this.loading"></router-outlet>
    </div>

    <bit-toast-container></bit-toast-container>`,
  standalone: false,
})
export class AppComponent extends BaseAppComponent {
  constructor(
    masterPasswordService: MasterPasswordServiceAbstraction,
    broadcasterService: BroadcasterService,
    folderService: InternalFolderService,
    syncService: SyncService,
    cipherService: CipherService,
    authService: AuthService,
    router: Router,
    toastService: ToastService,
    i18nService: I18nService,
    ngZone: NgZone,
    vaultTimeoutService: VaultTimeoutService,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    keyService: KeyService,
    logService: LogService,
    messagingService: MessagingService,
    collectionService: CollectionService,
    searchService: SearchService,
    notificationsService: ServerNotificationsService,
    platformUtilsService: PlatformUtilsService,
    systemService: SystemService,
    processReloadService: ProcessReloadServiceAbstraction,
    stateService: StateService,
    eventUploadService: EventUploadService,
    policyService: InternalPolicyService,
    modalService: ModalService,
    keyConnectorService: KeyConnectorService,
    userVerificationService: UserVerificationService,
    configService: ConfigService,
    dialogService: DialogService,
    biometricStateService: BiometricStateService,
    stateEventRunnerService: StateEventRunnerService,
    accountService: AccountService,
    organizationService: OrganizationService,
    deviceTrustToastService: DeviceTrustToastService,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    destroyRef: DestroyRef,
    documentLangSetter: DocumentLangSetter,
    restrictedItemTypesService: RestrictedItemTypesService,
    pinService: PinServiceAbstraction,
    tokenService: TokenService,
    desktopAutotypeDefaultSettingPolicy: DesktopAutotypeDefaultSettingPolicy,
    lockService: LockService,
  ) {
    super(
      masterPasswordService,
      broadcasterService,
      folderService,
      syncService,
      cipherService,
      authService,
      router,
      toastService,
      i18nService,
      ngZone,
      vaultTimeoutService,
      vaultTimeoutSettingsService,
      keyService,
      logService,
      messagingService,
      collectionService,
      searchService,
      notificationsService,
      platformUtilsService,
      systemService,
      processReloadService,
      stateService,
      eventUploadService,
      policyService,
      modalService,
      keyConnectorService,
      userVerificationService,
      configService,
      dialogService,
      biometricStateService,
      stateEventRunnerService,
      accountService,
      organizationService,
      deviceTrustToastService,
      userDecryptionOptionsService,
      destroyRef,
      documentLangSetter,
      restrictedItemTypesService,
      pinService,
      tokenService,
      desktopAutotypeDefaultSettingPolicy,
      lockService,
    );
  }
}

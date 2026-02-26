import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { EMPTY, of } from "rxjs";

import {
  CollectionAdminService,
  CollectionService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { MessageListener } from "@bitwarden/messaging";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  PasswordRepromptService,
  VaultFilterServiceAbstraction,
} from "@bitwarden/vault";

import { OrganizationWarningsService } from "../../billing/organizations/warnings/services";
import { WebVaultExtensionPromptService } from "../services/web-vault-extension-prompt.service";
import { WelcomeDialogService } from "../services/welcome-dialog.service";

import { VaultComponent } from "./vault.component";

describe("VaultComponent", () => {
  let component: VaultComponent<any>;
  let fixture: ComponentFixture<VaultComponent<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: BroadcasterService, useValue: mock<BroadcasterService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: OrganizationApiServiceAbstraction, useValue: mock<OrganizationApiServiceAbstraction>() },
        { provide: VaultFilterServiceAbstraction, useValue: mock<VaultFilterServiceAbstraction>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: TotpService, useValue: mock<TotpService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        { provide: SearchService, useValue: mock<SearchService>() },
        { provide: SearchPipe, useValue: mock<SearchPipe>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: BillingAccountProfileStateService, useValue: mock<BillingAccountProfileStateService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: { activeAccount$: EMPTY } },
        { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
        { provide: RestrictedItemTypesService, useValue: { restricted$: EMPTY } },
        { provide: CipherArchiveService, useValue: mock<CipherArchiveService>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: AutomaticUserConfirmationService, useValue: mock<AutomaticUserConfirmationService>() },
        { provide: WebVaultExtensionPromptService, useValue: mock<WebVaultExtensionPromptService>() },
        { provide: WelcomeDialogService, useValue: mock<WelcomeDialogService>() },
        { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
        { provide: AuthRequestServiceAbstraction, useValue: mock<AuthRequestServiceAbstraction>() },
        { provide: MessageListener, useValue: { allMessages$: EMPTY } },
        { provide: CollectionAdminService, useValue: mock<CollectionAdminService>() },
        { provide: CipherAuthorizationService, useValue: mock<CipherAuthorizationService>() },
        {
          provide: VaultTimeoutSettingsService,
          useValue: { availableVaultTimeoutActions$: () => of([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultComponent);
    component = fixture.componentInstance;
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });
});

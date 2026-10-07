import { DatePipe } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  CipherViewComponent,
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_STATE_BADGE,
} from "@bitwarden/vault";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { LeasingErrorService } from "../abstractions/leasing-error.service";
import { ItemDetailsStateBadgeComponent } from "../item-details-state-badge/item-details-state-badge.component";
import { AccessRequestCancelService } from "../services/access-request-cancel.service";
import {
  HOUR,
  accessRequest,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
} from "../testing/story-fixtures";

import { CipherViewBannerComponent } from "./cipher-view-banner.component";

/**
 * The composed cipher view, showing card order and the name-row badge. Every vault item renders
 * through these templates, so {@link OrdinaryLogin} must show neither outlet.
 */

function loginCipher(id: string, name: string, uri: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  cipher.type = CipherType.Login;
  cipher.login.uris = [Object.assign(new LoginUriView(), { uri })];
  return cipher;
}

/** A governed item, still unrevealed: `partial` is what marks it, and it carries no credentials. */
function gatedCipher(): CipherView {
  const cipher = loginCipher("cipher-1", "Prod database", "https://db.example.com");
  cipher.organizationId = "org-1";
  cipher.partial = true;
  return cipher;
}

function longNameGatedCipher(): CipherView {
  const cipher = gatedCipher();
  cipher.name = "production-eu-west-1-postgres-primary-readwrite-credentials-rotated-quarterly";
  return cipher;
}

function ordinaryCipher(): CipherView {
  const cipher = loginCipher("cipher-9", "Example account", "https://example.com");
  cipher.login.username = "ada.lovelace";
  cipher.login.password = "correct-horse-battery-staple";
  return cipher;
}

/**
 * Everything `CipherViewComponent` and its sections inject, at the root injector since
 * `Vfo1TerminologyService` is `providedIn: "root"`.
 */
function provideStoryCipherView() {
  return [
    // Only the PAM flag is on; enabling every flag would silently swap terminology and drop the
    // at-risk callout.
    {
      provide: ConfigService,
      useValue: { getFeatureFlag$: (flag: FeatureFlag) => of(flag === FeatureFlag.Pam) },
    },
    provideRouter([]),
    DatePipe,
    {
      provide: EnvironmentService,
      useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
    },
    { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
    { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
    { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
    { provide: CollectionService, useValue: { decryptedCollections$: () => of([]) } },
    { provide: FolderService, useValue: { getDecrypted$: () => of(undefined) } },
    { provide: TaskService, useValue: { pendingTasks$: () => of([]) } },
    { provide: PlatformUtilsService, useValue: { launchUri: () => {} } },
    {
      provide: DialogService,
      useValue: {
        openSimpleDialog: () => Promise.resolve(false),
        open: () => ({ closed: of(undefined) }),
      },
    },
    { provide: ToastService, useValue: { showToast: () => {} } },
    {
      provide: ChangeLoginPasswordService,
      useValue: { getChangePasswordUrl: () => Promise.resolve(undefined) },
    },
    { provide: CipherService, useValue: { ciphers$: () => of({}) } },
    {
      provide: CipherRiskService,
      useValue: { computeCipherRiskForUser: () => Promise.resolve(undefined) },
    },
    {
      provide: BillingAccountProfileStateService,
      useValue: { hasPremiumFromAnySource$: () => of(true) },
    },
    { provide: VaultSettingsService, useValue: { showAtRiskPasswordNotifications$: of(false) } },
    { provide: ViewPasswordHistoryService, useValue: { viewPasswordHistory: () => {} } },
    { provide: PremiumUpgradePromptService, useValue: { promptForPremium: () => {} } },
    { provide: EventCollectionService, useValue: { collect: () => Promise.resolve() } },
  ];
}

/**
 * Binds the real banner and name-row badge over one access state, so any disagreement is a bug. No
 * active-lease story, since the name-row badge drops that state.
 */
function gated(state: () => Record<string, unknown>) {
  return moduleMetadata({
    imports: [CipherViewBannerComponent, ItemDetailsStateBadgeComponent],
    providers: [
      { provide: CIPHER_VIEW_BANNER, useValue: CipherViewBannerComponent },
      { provide: ITEM_DETAILS_STATE_BADGE, useValue: ItemDetailsStateBadgeComponent },
      {
        provide: AccessRequestSdkService,
        useValue: {
          getCipherAccessState: () => Promise.resolve(state()),
          preCheck: () =>
            Promise.resolve({
              approvalMode: "automatic",
              hasActiveLease: false,
              maxDurationSeconds: 4 * 60 * 60,
              defaultDurationSeconds: 60 * 60,
            }),
          submitAccessRequest: () => Promise.resolve({}),
          activateAccessRequest: () => Promise.resolve({}),
        },
      },
      {
        provide: AccessLeaseSdkService,
        useValue: { extendLease: () => Promise.resolve({}), endLease: () => Promise.resolve() },
      },
      {
        provide: AccessRefreshService,
        useValue: { accessChanged$: () => EMPTY, notifyAccessChanged: () => {} },
      },
      {
        provide: AccessRequestCancelService,
        useValue: { cancelOutstandingRequest: () => Promise.resolve() },
      },
      { provide: LeasingErrorService, useValue: { isLeasingError: () => false } },
    ],
  });
}

export default {
  title: "Web/PAM/Gated Cipher View",
  component: CipherViewComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
        ...provideStoryCipherView(),
      ],
    }),
  ],
  args: { cipher: gatedCipher() },
} as Meta<CipherViewComponent>;

type Story = StoryObj<CipherViewComponent>;

export const RequestAccess: Story = {
  decorators: [gated(() => ({ badgeState: "privileged" }))],
};

function pendingState() {
  return {
    badgeState: "pending",
    pendingRequest: accessRequest({
      leaseNotBefore: liveFromNow(0),
      leaseNotAfter: liveFromNow(HOUR),
    }),
  };
}

export const Pending: Story = {
  decorators: [gated(pendingState)],
};

export const Approved: Story = {
  decorators: [
    gated(() => ({
      badgeState: "ready",
      approvedRequest: accessRequest({
        status: "approved",
        leaseNotBefore: liveFromNow(0),
        leaseNotAfter: liveFromNow(2 * HOUR),
      }),
    })),
  ],
};

/**
 * A long name sharing its row with a badge that must not be squeezed. Pending is the longest label.
 */
export const LongNameWithBadge: Story = {
  args: { cipher: longNameGatedCipher() },
  decorators: [gated(pendingState)],
};

/** An ungoverned login with neither seam bound, so no badge and no access card. */
export const OrdinaryLogin: Story = {
  args: { cipher: ordinaryCipher() },
};

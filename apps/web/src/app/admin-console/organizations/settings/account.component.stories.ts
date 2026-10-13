import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { TwoFactorIconComponent } from "@bitwarden/angular/auth/components/two-factor-icon.component";
import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService, ItemModule, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { DangerZoneComponent } from "../../../auth/settings/account/danger-zone.component";
import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { AccountFingerprintComponent } from "../../../key-management/account-fingerprint/account-fingerprint.component";
import { SharedModule } from "../../../shared";

import { AccountComponent } from "./account.component";

/**
 * The real `app-header` (`WebHeaderComponent`) pulls in `<app-product-switcher>` and
 * `<app-account-menu>`, which depend on many app-wide services that aren't worth stubbing out
 * for this story. Stub it out instead, matching the pattern in
 * `vault-header.component.stories.ts`.
 */
@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubHeaderComponent {}

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

const mockOrganization = Object.assign(new Organization(), {
  id: ORG_ID,
  name: "Acme Corp",
  useApi: false,
});

const mockOrganizationResponse = new OrganizationResponse({
  id: ORG_ID,
  name: "Acme Corp",
  billingEmail: "billing@acme.com",
  hasPublicAndPrivateKeys: true,
  useApi: false,
  limitCollectionCreation: false,
  limitCollectionDeletion: false,
  limitItemDeletion: false,
  allowAdminAccessToAllCollectionItems: true,
});

const mockOrganizationKeysResponse = new OrganizationKeysResponse({
  publicKey: "cHVibGljS2V5",
});

const mockActivatedRoute = {
  params: of({ organizationId: ORG_ID }),
};

const mockPlatformUtilsService = { isSelfHost: () => false };

const mockKeyService = {
  orgKeys$: () => of({}),
};

// `AccountComponent` uses `makeKeyPair`; the nested `AccountFingerprintComponent` uses
// `getFingerprint`. Both moved off `KeyService` onto `LegacyCompatKeyService`.
const mockLegacyCompatKeyService = {
  makeKeyPair: () => Promise.resolve(["publicKey", { encryptedString: "encryptedPrivateKey" }]),
  getFingerprint: () => Promise.resolve(["acme", "fingerprint", "words", "here"]),
};

const mockRouter = { navigate: () => Promise.resolve(true) };

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

const mockOrganizationService = {
  organizations$: () => of([mockOrganization]),
};

const mockDialogService = {
  openSimpleDialog: () => Promise.resolve(false),
};

const mockToastService = { showToast: () => {} };

const mockOrganizationApiService = {
  get: () => Promise.resolve(mockOrganizationResponse),
  getKeys: () => Promise.resolve(mockOrganizationKeysResponse),
  save: () => Promise.resolve(mockOrganizationResponse),
  updateCollectionManagement: () => Promise.resolve(),
};

export default {
  title: "Admin Console/Organizations/Settings/Account",
  component: AccountComponent,
  decorators: [
    moduleMetadata({
      declarations: [AccountComponent],
      imports: [
        SharedModule,
        AccountFingerprintComponent,
        DangerZoneComponent,
        StubHeaderComponent,
        PremiumBadgeComponent,
        ItemModule,
        TwoFactorIconComponent,
        Vfo1I18nPipe,
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: LegacyCompatKeyService, useValue: mockLegacyCompatKeyService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        // Vfo1TerminologyService is `providedIn: "root"`, so it resolves ConfigService from the
        // application root injector. Provide a flag-off default here so the `Default` story
        // renders without relying on the global feature-flag toolbar (see .storybook/preview.tsx).
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<AccountComponent>;

/** Organization settings, including the Collection management section. */
export const Default: Story = {
  render: () => ({
    template: `<app-org-account></app-org-account>`,
  }),
};

/**
 * The Collection management section with the VFO1 terminology flag on — the section heading,
 * description, checkbox labels, and the "Manage" permission all render "shared folder" terminology
 * (with the "Manage collection" permission shortened to just "Manage").
 */
export const Vfo1Enabled: Story = {
  render: () => ({
    // Overriding ConfigService requires applicationConfig (not moduleMetadata) since
    // Vfo1TerminologyService resolves it from the application root injector.
    applicationConfig: {
      providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } }],
    },
    template: `<app-org-account></app-org-account>`,
  }),
};

import { ChangeDetectionStrategy, Component, importProvidersFrom, signal } from "@angular/core";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MemberDecryptionType, SsoType } from "@bitwarden/common/auth/enums/sso";
import { OrganizationSsoResponse } from "@bitwarden/common/auth/models/response/organization-sso.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { SsoManageComponent } from "./sso-manage.component";

/** Stub for the <app-header> layout shell — not under test here. */
@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubHeaderComponent {}

const ORG_ID = "org-story-1" as OrganizationId;

const mockOrganization = {
  id: ORG_ID,
  name: "Story Org",
  enabled: true,
  useKeyConnector: false,
} as unknown as Organization;

const mockSsoResponse = new OrganizationSsoResponse({
  Enabled: true,
  Identifier: "story-sso",
  Data: {
    ConfigType: SsoType.OpenIdConnect,
    MemberDecryptionType: MemberDecryptionType.TrustedDeviceEncryption,
    KeyConnectorUrl: null,
    OpenId: null,
    Saml2: null,
  },
  Urls: {
    CallbackPath: "https://sso.bitwarden.com/oidc-signin",
    SignedOutCallbackPath: "https://sso.bitwarden.com/oidc-signedout",
    SpEntityId: null,
    SpEntityIdStatic: null,
    SpMetadataUrl: null,
    SpAcsUrl: null,
  },
});

export default {
  title: "Admin Console/Auth/SSO Settings",
  component: SsoManageComponent,
  decorators: [
    moduleMetadata({
      imports: [StubHeaderComponent, SharedModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORG_ID }) },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: "user-1", email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: InternalOrganizationServiceAbstraction,
          useValue: {
            organizations$: () => of([mockOrganization]),
          },
        },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: {
            getSso: () => Promise.resolve(mockSsoResponse),
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: { isSelfHost: () => false },
        },
        {
          provide: EnvironmentService,
          useValue: {},
        },
        {
          provide: ValidationService,
          useValue: { showError: () => {} },
        },
        {
          provide: LogService,
          useValue: { error: () => {} },
        },
        {
          provide: ApiService,
          useValue: {},
        },
        {
          provide: ToastService,
          useValue: { showToast: () => {} },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideRouter([])],
    }),
  ],
} satisfies Meta<SsoManageComponent>;

type Story = StoryObj<SsoManageComponent>;

const vfo1Off = { provide: Vfo1TerminologyService, useValue: { enabled: signal(false) } };
const vfo1On = { provide: Vfo1TerminologyService, useValue: { enabled: signal(true) } };

/** Flag off — original "single organization" policy name. */
export const FlagOff: Story = {
  decorators: [moduleMetadata({ providers: [vfo1Off] })],
};

/** Flag on (VFO1Foundation) — "single organization vault" policy name. */
export const FlagOn: Story = {
  decorators: [moduleMetadata({ providers: [vfo1On] })],
};

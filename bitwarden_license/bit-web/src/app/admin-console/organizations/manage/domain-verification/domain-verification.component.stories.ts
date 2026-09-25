import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { DomainVerificationComponent } from "./domain-verification.component";

const ORG_ID = "org-story-1";
const USER_ID = "user-story-1" as UserId;

function domain(overrides: Partial<OrganizationDomainResponse> = {}): OrganizationDomainResponse {
  return new OrganizationDomainResponse({
    id: "domain-1",
    organizationId: ORG_ID,
    txt: "bw=abc123",
    domainName: "example.com",
    creationDate: "2026-01-01T00:00:00.000Z",
    nextRunDate: "2026-01-02T00:00:00.000Z",
    jobRunCount: 1,
    lastCheckedDate: "2026-01-01T12:00:00.000Z",
    ...overrides,
  });
}

/** Per-story providers for the org domains list and the API calls the page makes on load. */
function storyProviders(orgDomains: OrganizationDomainResponse[]) {
  return applicationConfig({
    providers: [
      {
        provide: OrgDomainServiceAbstraction,
        useValue: {
          orgDomains$: of(orgDomains),
          copyDnsTxt: action("OrgDomainService.copyDnsTxt"),
        },
      },
      {
        provide: OrgDomainApiServiceAbstraction,
        useValue: {
          getAllByOrgId: async () => orgDomains,
          getByOrgIdAndOrgDomainId: async (orgId: string, orgDomainId: string) =>
            orgDomains.find((d) => d.id === orgDomainId),
        },
      },
    ],
  });
}

export default {
  title: "Admin Console/Organizations/Domain Verification",
  component: DomainVerificationComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: ORG_ID }),
            data: of({ titleId: "claimedDomains" }),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: PolicyService,
          useValue: {
            policies$: () => of([]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            // VFO1Foundation is stubbed on so the real <app-header> skips rendering the legacy
            // product-switcher/account-menu nav chrome, which pulls in a long, unrelated
            // dependency graph (organizations, providers, sync, avatar, billing, etc.) that
            // this story has no need to stub.
            getFeatureFlag$: (flag: FeatureFlag) => of(flag === FeatureFlag.VFO1Foundation),
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: action("DialogService.open"),
            openSimpleDialog: async () => true,
          },
        },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideRouter([])],
    }),
  ],
} satisfies Meta<DomainVerificationComponent>;

type Story = StoryObj<DomainVerificationComponent>;

/** A mix of a claimed domain and one still pending verification. */
export const Default: Story = {
  decorators: [
    storyProviders([
      domain({ id: "domain-1", domainName: "example.com", verifiedDate: undefined }),
      domain({
        id: "domain-2",
        domainName: "claimed.example.com",
        verifiedDate: "2026-01-05T00:00:00.000Z",
      }),
    ]),
  ],
};

/** No domains have been added yet — shows the empty state. */
export const Empty: Story = {
  decorators: [storyProviders([])],
};

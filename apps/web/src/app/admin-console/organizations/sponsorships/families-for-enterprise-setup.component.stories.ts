import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PreValidateSponsorshipResponse } from "@bitwarden/common/admin-console/models/response/pre-validate-sponsorship.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { FamiliesForEnterpriseSetupComponent } from "./families-for-enterprise-setup.component";

const USER_ID = "user-story-1" as UserId;

function familyOrg(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: "org-1" as OrganizationId,
    name: "My Family",
    status: OrganizationUserStatusType.Confirmed,
    type: OrganizationUserType.Owner,
    enabled: true,
    productTierType: ProductTierType.Families,
    ...overrides,
  });
}

function storyProviders(
  preValidateResponse: PreValidateSponsorshipResponse,
  existingFamilyOrgs: Organization[],
) {
  return moduleMetadata({
    providers: [
      {
        provide: ActivatedRoute,
        useValue: { queryParams: of({ token: "sponsorship-token" }) },
      },
      {
        provide: ApiService,
        useValue: {
          postPreValidateSponsorshipToken: async () => preValidateResponse,
          postRedeemSponsorship: action("ApiService.postRedeemSponsorship"),
        },
      },
      {
        provide: SyncService,
        useValue: { fullSync: async () => true },
      },
      {
        provide: OrganizationService,
        useValue: { organizations$: () => of(existingFamilyOrgs) },
      },
      {
        provide: AccountService,
        useValue: {
          activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
        },
      },
      {
        provide: ConfigService,
        useValue: { getFeatureFlag$: () => of(false) },
      },
      {
        provide: ValidationService,
        useValue: { showError: action("ValidationService.showError") },
      },
      {
        provide: DialogService,
        useValue: { open: action("DialogService.open") },
      },
      {
        provide: ToastService,
        useValue: { showToast: action("ToastService.showToast") },
      },
      {
        provide: LogService,
        useValue: {
          info: action("LogService.info"),
          warning: action("LogService.warning"),
          error: action("LogService.error"),
        },
      },
    ],
  });
}

export default {
  title: "Admin Console/Organizations/Sponsorships/Families For Enterprise Setup",
  component: FamiliesForEnterpriseSetupComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<FamiliesForEnterpriseSetupComponent>;

type Story = StoryObj<FamiliesForEnterpriseSetupComponent>;

export const Default: Story = {
  decorators: [
    storyProviders(
      new PreValidateSponsorshipResponse({
        IsTokenValid: true,
        IsFreeFamilyPolicyEnabled: false,
        SponsoringOrganizationName: "Acme Inc.",
      }),
      [familyOrg()],
    ),
  ],
};

export const InvalidToken: Story = {
  decorators: [
    storyProviders(
      new PreValidateSponsorshipResponse({
        IsTokenValid: false,
        IsFreeFamilyPolicyEnabled: false,
      }),
      [],
    ),
  ],
};

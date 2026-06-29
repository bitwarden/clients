import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";

import { ResetPasswordPolicyV2Component } from "./reset-password-v2.component";

function makePolicyStatusResponse(
  enabled: boolean,
  autoEnrollEnabled = false,
): PolicyStatusResponse {
  return new PolicyStatusResponse({
    OrganizationId: "test-org-id",
    Type: PolicyType.ResetPassword,
    Data: { autoEnrollEnabled },
    Enabled: enabled,
    CanToggleState: true,
  });
}

const mockAccountService: Partial<AccountService> = {
  activeAccount$: of({ id: "test-user-id" as UserId, email: "user@example.com" } as any),
};

const mockKeyService: Partial<KeyService> = {
  orgKeys$: () => of({}),
};

const mockPolicyApiService: Partial<PolicyApiServiceAbstraction> = {
  putPolicy: () => Promise.resolve(),
};

const mockOrganizationService: Partial<OrganizationService> = {
  organizations$: () => of([]),
};

type StoryArgs = {
  enabled: boolean;
  autoEnrollEnabled: boolean;
};

function renderStory(args: StoryArgs) {
  return {
    props: {
      policyResponse: makePolicyStatusResponse(args.enabled, args.autoEnrollEnabled),
    },
    template: `
      <reset-password-policy-v2-edit
        [policyResponse]="policyResponse"
      ></reset-password-policy-v2-edit>
    `,
  };
}

export default {
  title: "Admin Console/Organizations/Policies/Account Recovery Administration V2",
  component: ResetPasswordPolicyV2Component,
  args: {
    enabled: false,
    autoEnrollEnabled: false,
  },
  argTypes: {
    enabled: {
      control: "boolean",
      description: "Whether the policy is currently enabled.",
    },
    autoEnrollEnabled: {
      control: "boolean",
      description: "Whether auto-enrollment of new members is enabled.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [ResetPasswordPolicyV2Component],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        { provide: OrganizationService, useValue: mockOrganizationService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

/**
 * Policy is off, auto-enroll is off.
 */
export const PolicyOff: Story = {
  render: renderStory,
};

/**
 * Policy is turned on.
 */
export const PolicyOn: Story = {
  args: {
    enabled: true,
    autoEnrollEnabled: false,
  },
  render: renderStory,
};

/**
 * Policy is on with automatic enrollment of new members enabled.
 */
export const PolicyOnWithAutoEnroll: Story = {
  args: {
    enabled: true,
    autoEnrollEnabled: true,
  },
  render: renderStory,
};

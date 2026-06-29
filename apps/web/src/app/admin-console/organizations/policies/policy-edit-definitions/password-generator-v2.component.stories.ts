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

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import {
  PasswordGeneratorPolicyV2,
  PasswordGeneratorPolicyV2Component,
} from "./password-generator-v2.component";

function makePolicyStatusResponse(
  enabled: boolean,
  data: object | null = null,
): PolicyStatusResponse {
  return new PolicyStatusResponse({
    OrganizationId: "test-org-id",
    Type: PolicyType.PasswordGenerator,
    Data: data,
    Enabled: enabled,
    CanToggleState: true,
  });
}

const policy = new PasswordGeneratorPolicyV2();

const mockAccountService: Partial<AccountService> = {
  activeAccount$: of({ id: "test-user-id" as UserId, email: "user@example.com" } as any),
};

const mockOrganizationService: Partial<OrganizationService> = {
  organizations$: () => of([]),
};

const mockKeyService: Partial<KeyService> = {
  orgKeys$: () => of({}),
};

const mockPolicyApiService: Partial<PolicyApiServiceAbstraction> = {
  putPolicy: () => Promise.resolve(),
};

type StoryArgs = {
  enabled: boolean;
};

function renderStory(args: StoryArgs, data: object | null = null) {
  return {
    props: {
      policy,
      policyResponse: makePolicyStatusResponse(args.enabled, data),
    },
    template: `
      <password-generator-policy-v2-edit
        [policy]="policy"
        [policyResponse]="policyResponse"
      ></password-generator-policy-v2-edit>
    `,
  };
}

export default {
  title: "Admin Console/Organizations/Policies/Password Generator V2",
  component: PasswordGeneratorPolicyV2Component,
  args: {
    enabled: false,
  },
  argTypes: {
    enabled: {
      control: "boolean",
      description: "Whether the policy is currently enabled.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [PasswordGeneratorPolicyV2Component],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const PolicyOff: Story = {
  render: (args) => renderStory(args),
};

/**
 * Policy is enabled with no type override (both password and passphrase sections shown).
 */
export const PolicyOn: Story = {
  args: { enabled: true },
  render: (args) => renderStory(args, { overridePasswordType: null }),
};

/**
 * Policy is enabled showing only password-specific options.
 */
export const PolicyOnPasswordOnly: Story = {
  args: { enabled: true },
  render: (args) =>
    renderStory(args, {
      overridePasswordType: "password",
      minLength: 12,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSpecial: false,
      minNumbers: 1,
      minSpecial: 0,
    }),
};

/**
 * Policy is enabled showing only passphrase-specific options.
 */
export const PolicyOnPassphraseOnly: Story = {
  args: { enabled: true },
  render: (args) =>
    renderStory(args, {
      overridePasswordType: "passphrase",
      minNumberWords: 4,
      capitalize: true,
      includeNumber: false,
    }),
};

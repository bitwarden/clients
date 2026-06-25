import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CalloutComponent } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

/**
 * A sample policy definition used exclusively for Storybook stories.
 * It is not registered in any production policy register.
 */
class SampleTogglePolicy extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  category = PolicyCategory.Authentication;
  priority = 10;
  component = SimpleTogglePolicyComponent;
}

/**
 * A sample policy definition with a warning callout, used exclusively for Storybook stories.
 * The warning callout is rendered by the story template (as the drawer container would do),
 * not by SimpleTogglePolicyComponent itself.
 */
class SampleTogglePolicyWithWarning extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  category = PolicyCategory.Authentication;
  priority = 10;
  component = SimpleTogglePolicyComponent;
  warningKey = "twoStepLoginPolicyWarningV2";
}

function makePolicyStatusResponse(enabled: boolean): PolicyStatusResponse {
  return new PolicyStatusResponse({
    OrganizationId: "test-org-id",
    Type: PolicyType.TwoFactorAuthentication,
    Data: null,
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

type StoryArgs = {
  enabled: boolean;
  showWarning: boolean;
};

function renderStory(args: StoryArgs) {
  const policy = args.showWarning ? new SampleTogglePolicyWithWarning() : new SampleTogglePolicy();
  return {
    props: {
      policy,
      warningKey: policy.warningKey,
      policyResponse: makePolicyStatusResponse(args.enabled),
    },
    template: `
      @if (warningKey) {
        <bit-callout type="warning">{{ warningKey | i18n }}</bit-callout>
      }
      <app-simple-toggle-policy-edit
        [policy]="policy"
        [policyResponse]="policyResponse"
      ></app-simple-toggle-policy-edit>
    `,
  };
}

export default {
  title: "Admin Console/Organizations/Policies/Simple Toggle Policy",
  component: SimpleTogglePolicyComponent,
  args: {
    enabled: false,
    showWarning: false,
  },
  argTypes: {
    enabled: {
      control: "boolean",
      description: "Whether the policy is currently enabled.",
    },
    showWarning: {
      control: "boolean",
      description: "Whether to display a warning callout above the toggle.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [SimpleTogglePolicyComponent, CalloutComponent, I18nPipe],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
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
  render: renderStory,
};

/**
 * Policy is toggled on, no warning callout.
 */
export const PolicyOn: Story = {
  args: {
    enabled: true,
    showWarning: false,
  },
  render: renderStory,
};

/**
 * Policy is off and a warning callout is shown above the toggle.
 */
export const PolicyOffWithWarning: Story = {
  args: {
    enabled: false,
    showWarning: true,
  },
  render: renderStory,
};

/**
 * Policy is on and a warning callout is shown above the toggle.
 */
export const PolicyOnWithWarning: Story = {
  args: {
    enabled: true,
    showWarning: true,
  },
  render: renderStory,
};

import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BadgeComponent, CalloutComponent, TypographyModule } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { BasePolicyEditDefinition } from "../base-policy-edit.component";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";
import { TwoFactorAuthenticationPolicy } from "./two-factor-authentication.component";

const policy: BasePolicyEditDefinition = new TwoFactorAuthenticationPolicy();

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

type StoryArgs = { enabled: boolean };

function renderStory(args: StoryArgs) {
  return {
    props: {
      titleKey: policy.v2?.name ?? policy.name,
      descriptionKey: policy.v2?.description ?? policy.description,
      warningKey: policy.warningKey,
      enabled: args.enabled,
      policyDef: policy,
      policyResponse: makePolicyStatusResponse(args.enabled),
    },
    template: `
      <div class="tw-p-4 tw-w-96">
        <div class="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-4">
          <h2 bitTypography="h4">{{ titleKey | i18n }}</h2>
          <span bitBadge [variant]="enabled ? 'success' : 'secondary'">
            {{ (enabled ? 'on' : 'off') | i18n }}
          </span>
        </div>
        @if (warningKey) {
          <bit-callout type="warning">
            {{ warningKey | i18n }}
          </bit-callout>
        }
        <p bitTypography="body1">{{ descriptionKey | i18n }}</p>
        <app-simple-toggle-policy-edit
          [policy]="policyDef"
          [policyResponse]="policyResponse"
        ></app-simple-toggle-policy-edit>
      </div>
    `,
  };
}

export default {
  title: "Admin Console/Organizations/Policies/Two Factor Authentication",
  component: SimpleTogglePolicyComponent,
  args: { enabled: false },
  argTypes: {
    enabled: {
      control: "boolean",
      description: "Whether the policy is currently enabled.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [
        I18nPipe,
        TypographyModule,
        BadgeComponent,
        CalloutComponent,
        SimpleTogglePolicyComponent,
      ],
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

export const PolicyOn: Story = {
  args: { enabled: true },
  render: renderStory,
};

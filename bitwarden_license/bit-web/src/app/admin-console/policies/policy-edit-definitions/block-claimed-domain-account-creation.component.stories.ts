import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CalloutComponent, LinkComponent, TypographyDirective } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { BlockClaimedDomainAccountCreationPolicy } from "./block-claimed-domain-account-creation.component";

const policy = new BlockClaimedDomainAccountCreationPolicy();

function makePolicyStatusResponse(enabled: boolean): PolicyStatusResponse {
  return new PolicyStatusResponse({
    OrganizationId: "test-org-id",
    Type: PolicyType.BlockClaimedDomainAccountCreation,
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
      descriptionKey: policy.v2?.description ?? policy.description,
      prerequisiteKey: policy.v2?.prerequisiteKey,
      prerequisiteLinkHref: policy.v2?.prerequisiteLinkHref,
      prerequisiteLinkTextKey: policy.v2?.prerequisiteLinkTextKey,
      policyDef: policy,
      policyResponse: makePolicyStatusResponse(args.enabled),
    },
    template: `
      <div class="tw-p-4 tw-w-96">
        @if (prerequisiteKey) {
          <bit-callout type="info" [title]="'prerequisite' | i18n">
            {{ prerequisiteKey | i18n }}
            @if (prerequisiteLinkHref && prerequisiteLinkTextKey) {
              <a bitLink [href]="prerequisiteLinkHref" target="_blank" rel="noreferrer">
                {{ prerequisiteLinkTextKey | i18n }}
              </a>
            }
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
  title: "Admin Console/Organizations/Policies/Block Claimed Domain Account Creation",
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
        TypographyDirective,
        CalloutComponent,
        LinkComponent,
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

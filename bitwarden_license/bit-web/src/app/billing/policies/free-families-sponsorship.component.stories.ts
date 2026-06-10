import { NgComponentOutlet } from "@angular/common";
import { importProvidersFrom, Type } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { BasePolicyEditComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  FreeFamiliesSponsorshipPolicyComponent,
  FreeFamiliesSponsorshipPolicy,
} from "./free-families-sponsorship.component";

function makePolicyStatusResponse(enabled: boolean): PolicyStatusResponse {
  return new PolicyStatusResponse({
    OrganizationId: "test-org-id",
    Type: PolicyType.FreeFamiliesSponsorship,
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
      component: FreeFamiliesSponsorshipPolicyComponent as Type<BasePolicyEditComponent>,
      inputs: {
        policy: new FreeFamiliesSponsorshipPolicy(),
        policyResponse: makePolicyStatusResponse(args.enabled),
      },
    },
    template: `
      <ng-container
        [ngComponentOutlet]="component"
        [ngComponentOutletInputs]="inputs"
      ></ng-container>
    `,
  };
}

export default {
  title: "Admin Console/Organizations/Policies/Free Families Sponsorship",
  component: FreeFamiliesSponsorshipPolicyComponent,
  args: { enabled: false },
  argTypes: {
    enabled: {
      control: "boolean",
      description: "Whether the policy is currently enabled.",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [FreeFamiliesSponsorshipPolicyComponent, NgComponentOutlet],
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

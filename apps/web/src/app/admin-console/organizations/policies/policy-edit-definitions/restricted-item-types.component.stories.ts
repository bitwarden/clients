import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CipherType } from "@bitwarden/common/vault/enums";
import { enabledFlags } from "@bitwarden/storybook";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";
import { OrganizationCipherTypeCountsApiService } from "../services/organization-cipher-type-counts-api.service";

import { ManageItemTypesPolicy } from "./restricted-item-types.component";

/** Mocks the organization's existing item counts by cipher type. */
function withItemTypeCounts(counts: Partial<Record<CipherType, number>>) {
  return moduleMetadata({
    providers: [
      {
        provide: OrganizationCipherTypeCountsApiService,
        useValue: { getCounts: () => Promise.resolve(counts) },
      },
    ],
  });
}

const meta = policyDrawerMeta(new ManageItemTypesPolicy());

export default {
  ...meta,
  decorators: [meta.decorators ?? [], withItemTypeCounts({})].flat(),
  args: { enabled: false, singleOrgEnabled: true },
  // Bank account, license and passport are also manageable with the new item types flag on.
  globals: enabledFlags(FeatureFlag.PM32009NewItemTypes),
  title: "Admin Console/Organizations/Policies/Manage Item Types",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

/**
 * The single organization policy is off, so the callout renders and the toggle is disabled.
 */
export const PolicyOffSingleOrgDisabled: Story = {
  args: { singleOrgEnabled: false },
};

export const PolicyOn: Story = {
  args: { enabled: true },
};

/**
 * The organization already has items of some types, so the drawer shows how many would be hidden.
 */
export const PolicyOnWithExistingItems: Story = {
  args: { enabled: true },
  decorators: [withItemTypeCounts({ [CipherType.Card]: 12, [CipherType.Identity]: 3 })],
};

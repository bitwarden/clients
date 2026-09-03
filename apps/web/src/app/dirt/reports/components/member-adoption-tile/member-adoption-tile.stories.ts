import { Meta, StoryObj, applicationConfig, componentWrapperDecorator } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { MemberAdoptionTileComponent } from "./member-adoption-tile.component";

export default {
  title: "Web/Reports/Member Adoption Tile",
  component: MemberAdoptionTileComponent,
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ close: "Close" }),
        },
      ],
    }),
    componentWrapperDecorator(
      (story) => `<div class="tw-max-w-xs tw-p-6 tw-text-main">${story}</div>`,
    ),
  ],
  args: {
    label: "Active members",
    value: "47",
    unit: "members",
    sublabel: "Logged in over last 30 days",
    infoTitle: "Measuring active members",
    infoBody:
      "This metric is based on the number of confirmed members who have logged into their vault in the last 30 days.",
    loading: false,
  },
} as Meta;

type Story = StoryObj<MemberAdoptionTileComponent>;

/** Every input supplied. Select the info button to open the popover. */
export const Default: Story = {};

/** A percentage rather than a count, so the unit reads as a share. */
export const Percentage: Story = {
  args: {
    label: "Sponsored Families Plan usage",
    value: "48%",
    unit: "of members",
    sublabel: "Redeemed plan",
    infoTitle: "Measuring plan usage",
    infoBody:
      "Sponsored Families Plan usage is based on the number of confirmed users who have redeemed this plan out of your organization's total confirmed licensed seats.",
  },
};

/** A bare metric, for a tile that needs no unit, sublabel or explanation. */
export const LabelAndValueOnly: Story = {
  args: {
    unit: undefined,
    sublabel: undefined,
    infoTitle: undefined,
    infoBody: undefined,
  },
};

/** A count reads on its own, so no unit sits beside it. */
export const WithoutUnit: Story = {
  args: {
    unit: undefined,
  },
};

/** Without a sublabel the value stays anchored to the top of the card. */
export const WithoutSublabel: Story = {
  args: {
    sublabel: undefined,
  },
};

/** No info button renders, so the label sits alone on its row. */
export const WithoutPopover: Story = {
  args: {
    infoTitle: undefined,
    infoBody: undefined,
  },
};

/** A title with no body cannot fill a popover, so no affordance renders. */
export const WithoutPopoverBody: Story = {
  args: {
    infoBody: undefined,
  },
};

/** The skeleton stands in for the value; the unit stays put so the tile does not reflow. */
export const Loading: Story = {
  args: {
    loading: true,
  },
};

/** A muted placeholder rather than a blank tile with a dangling unit. */
export const EmptyValue: Story = {
  args: {
    value: "",
  },
};

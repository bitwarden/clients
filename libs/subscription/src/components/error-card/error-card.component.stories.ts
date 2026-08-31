import { Meta, StoryObj } from "@storybook/angular";

import { ErrorCardComponent } from "./error-card.component";

export default {
  title: "Billing/Error Card",
  component: ErrorCardComponent,
  description:
    "A generic billing error card with an icon badge, title, description, and an optional action button. All copy is passed in already-localized so the card is reusable across surfaces.",
} as Meta<ErrorCardComponent>;

type Story = StoryObj<ErrorCardComponent>;

export const SubscriptionFailedToLoad: Story = {
  args: {
    title: "Subscription details aren't loading",
    description: "We ran into a problem loading your subscription details. Refresh to try again.",
    buttonText: "Refresh",
    icon: "bwi-clear",
  },
};

export const WithoutAction: Story = {
  name: "Without Action Button",
  args: {
    title: "Something went wrong",
    description: "Please try again later.",
    icon: "bwi-error",
  },
};

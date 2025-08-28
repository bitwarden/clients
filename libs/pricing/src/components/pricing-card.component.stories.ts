import { Meta, StoryObj } from "@storybook/angular";

import { PricingCardComponent } from "./pricing-card.component";

export default {
  title: "Billing/Pricing Card",
  component: PricingCardComponent,
  args: {
    title: "Premium Plan",
    tagline: "Everything you need for secure password management across all your devices",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/nuFrzHsgEoEk2Sm8fWOGuS/Premium-Upgrade-flows--pricing-increase-?node-id=858-44276&t=KjcXRRvf8PXJI51j-0",
    },
  },
} as Meta<PricingCardComponent>;

type Story = StoryObj<PricingCardComponent>;

export const Default: Story = {
  args: {
    title: "Premium Plan",
    tagline: "Everything you need for secure password management across all your devices",
    price: { amount: 10, cadence: "monthly" },
    button: { text: "Choose Premium", type: "primary" },
    features: [
      "Unlimited passwords and passkeys",
      "Secure password sharing",
      "Integrated 2FA authenticator",
      "Advanced 2FA options",
      "Priority customer support",
    ],
  },
};

export const WithoutPrice: Story = {
  args: {
    title: "Free Plan",
    tagline: "Get started with essential password management features",
    button: { text: "Get Started", type: "secondary" },
    features: ["Store unlimited passwords", "Access from any device", "Secure password generator"],
  },
};

export const WithoutFeatures: Story = {
  args: {
    title: "Enterprise Plan",
    tagline: "Advanced security and management for your organization",
    price: { amount: 3, cadence: "monthly" },
    button: { text: "Contact Sales", type: "primary" },
  },
};

export const Annual: Story = {
  args: {
    title: "Premium Plan",
    tagline: "Save more with annual billing",
    price: { amount: 120, cadence: "annually" },
    button: { text: "Choose Annual", type: "primary" },
    features: [
      "All Premium features",
      "2 months free with annual billing",
      "Priority customer support",
    ],
  },
};

export const Disabled: Story = {
  args: {
    title: "Coming Soon",
    tagline: "This plan will be available soon with exciting new features",
    price: { amount: 15, cadence: "monthly" },
    button: { text: "Coming Soon", type: "secondary", disabled: true },
    features: ["Advanced security features", "Enhanced collaboration tools", "Premium support"],
  },
};

export const LongTagline: Story = {
  args: {
    title: "Business Plan",
    tagline:
      "Comprehensive password management solution for teams and organizations that need advanced security features, detailed reporting, and enterprise-grade administration tools that scale with your business",
    price: { amount: 5, cadence: "monthly" },
    button: { text: "Start Business Trial", type: "primary" },
    features: [
      "Everything in Premium",
      "Admin dashboard",
      "Team reporting",
      "Advanced permissions",
      "SSO integration",
    ],
  },
};

export const AllButtonTypes: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-4 tw-justify-center">
        <bit-pricing-card
          title="Primary Button"
          tagline="Example with primary button styling"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Primary Action', type: 'primary' }"
          [features]="['Feature 1', 'Feature 2']">
        </bit-pricing-card>
        
        <bit-pricing-card
          title="Secondary Button"
          tagline="Example with secondary button styling"
          [price]="{ amount: 5, cadence: 'monthly' }"
          [button]="{ text: 'Secondary Action', type: 'secondary' }"
          [features]="['Feature 1', 'Feature 2']">
        </bit-pricing-card>
        
        <bit-pricing-card
          title="Danger Button"
          tagline="Example with danger button styling"
          [price]="{ amount: 15, cadence: 'monthly' }"
          [button]="{ text: 'Delete Plan', type: 'danger' }"
          [features]="['Feature 1', 'Feature 2']">
        </bit-pricing-card>
        
        <bit-pricing-card
          title="Unstyled Button"
          tagline="Example with unstyled button"
          [price]="{ amount: 0, cadence: 'monthly' }"
          [button]="{ text: 'Learn More', type: 'unstyled' }"
          [features]="['Feature 1', 'Feature 2']">
        </bit-pricing-card>
      </div>
    `,
    props: {},
  }),
};

export const PricingGrid: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-6 tw-justify-center tw-p-4">
        <bit-pricing-card
          title="Free"
          tagline="For personal use with essential features"
          [button]="{ text: 'Get Started', type: 'secondary' }"
          [features]="['Store unlimited passwords', 'Access from any device', 'Secure password generator']">
        </bit-pricing-card>
        
        <bit-pricing-card
          title="Premium"
          tagline="Everything you need for secure password management"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Choose Premium', type: 'primary' }"
          [features]="['Unlimited passwords and passkeys', 'Secure password sharing', 'Integrated 2FA authenticator', 'Advanced 2FA options', 'Priority customer support']">
        </bit-pricing-card>
        
        <bit-pricing-card
          title="Business"
          tagline="Advanced security and management for teams"
          [price]="{ amount: 5, cadence: 'monthly' }"
          [button]="{ text: 'Start Business Trial', type: 'primary' }"
          [features]="['Everything in Premium', 'Admin dashboard', 'Team reporting', 'Advanced permissions', 'SSO integration']">
        </bit-pricing-card>
      </div>
    `,
    props: {},
  }),
};

import { Meta, StoryObj } from "@storybook/angular";

import { TypographyModule } from "@bitwarden/components";

import { PricingCardComponent } from "./pricing-card.component";

export default {
  title: "Billing/Pricing Card",
  component: PricingCardComponent,
  moduleMetadata: {
    imports: [TypographyModule],
  },
  args: {
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
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [button]="button"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Premium Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
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
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [button]="button"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Free Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline: "Get started with essential password management features",
    button: { text: "Get Started", type: "secondary" },
    features: ["Store unlimited passwords", "Access from any device", "Secure password generator"],
  },
};

export const WithoutFeatures: Story = {
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [button]="button">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Enterprise Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline: "Advanced security and management for your organization",
    price: { amount: 3, cadence: "monthly" },
    button: { text: "Contact Sales", type: "primary" },
  },
};

export const Annual: Story = {
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [button]="button"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Premium Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
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
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [button]="button"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Coming Soon</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline: "This plan will be available soon with exciting new features",
    price: { amount: 15, cadence: "monthly" },
    button: { text: "Coming Soon", type: "secondary", disabled: true },
    features: ["Advanced security features", "Enhanced collaboration tools", "Premium support"],
  },
};

export const LongTagline: Story = {
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [button]="button"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Business Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline:
      "Comprehensive password management solution for teams and organizations that need advanced security features, detailed reporting, and enterprise-grade administration tools that scale with your business",
    price: { amount: 5, cadence: "monthly", showPerUser: true },
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
        <billing-pricing-card
          tagline="Example with primary button styling"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Primary Action', type: 'primary' }"
          [features]="['Feature 1', 'Feature 2']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Primary Button</h3>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Example with secondary button styling"
          [price]="{ amount: 5, cadence: 'monthly' }"
          [button]="{ text: 'Secondary Action', type: 'secondary' }"
          [features]="['Feature 1', 'Feature 2']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Secondary Button</h3>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Example with danger button styling"
          [price]="{ amount: 15, cadence: 'monthly' }"
          [button]="{ text: 'Delete Plan', type: 'danger' }"
          [features]="['Feature 1', 'Feature 2']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Danger Button</h3>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Example with unstyled button"
          [price]="{ amount: 0, cadence: 'monthly' }"
          [button]="{ text: 'Learn More', type: 'unstyled' }"
          [features]="['Feature 1', 'Feature 2']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Unstyled Button</h3>
        </billing-pricing-card>
      </div>
    `,
    props: {},
  }),
};

export const ConfigurableHeadings: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-6 tw-p-4 tw-justify-center">
        <billing-pricing-card
          tagline="Example with h2 heading for accessibility"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Choose Plan', type: 'primary' }"
          [features]="['Feature 1', 'Feature 2']">
          <h2 class="title-slot tw-m-0" bitTypography="h3">H2 Heading</h2>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Example with h4 heading for nested content"
          [price]="{ amount: 15, cadence: 'monthly' }"
          [button]="{ text: 'Choose Plan', type: 'secondary' }"
          [features]="['Feature 1', 'Feature 2']">
          <h4 class="title-slot tw-m-0" bitTypography="h3">H4 Heading</h4>
        </billing-pricing-card>
      </div>
    `,
    props: {},
  }),
};

export const PricingGrid: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-6 tw-p-4 tw-justify-center">
        <billing-pricing-card
          tagline="For personal use with essential features"
          [button]="{ text: 'Get Started', type: 'secondary' }"
          [features]="['Store unlimited passwords', 'Access from any device', 'Secure password generator']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Free</h3>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Everything you need for secure password management"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Choose Premium', type: 'primary' }"
          [features]="['Unlimited passwords and passkeys', 'Secure password sharing', 'Integrated 2FA authenticator', 'Advanced 2FA options', 'Priority customer support']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Premium</h3>
        </billing-pricing-card>
        
        <billing-pricing-card
          tagline="Advanced security and management for teams"
          [price]="{ amount: 5, cadence: 'monthly', showPerUser: true }"
          [button]="{ text: 'Start Business Trial', type: 'primary' }"
          [features]="['Everything in Premium', 'Admin dashboard', 'Team reporting', 'Advanced permissions', 'SSO integration']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Business</h3>
        </billing-pricing-card>
      </div>
    `,
    props: {},
  }),
};

export const WithoutButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [price]="price"
        [features]="features">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Coming Soon Plan</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline: "This plan will be available soon with exciting new features",
    price: { amount: 15, cadence: "monthly" },
    features: ["Advanced security features", "Enhanced collaboration tools", "Premium support"],
  },
};

export const ActivePlan: Story = {
  render: (args) => ({
    props: args,
    template: `
      <billing-pricing-card
        [tagline]="tagline"
        [features]="features"
        [activeBadge]="activeBadge">
        <h3 class="title-slot tw-m-0" bitTypography="h3">Free</h3>
      </billing-pricing-card>
    `,
  }),
  args: {
    tagline: "Your current plan with essential password management features",
    features: ["Store unlimited passwords", "Access from any device", "Secure password generator"],
    activeBadge: { text: "Active plan" },
  },
};

export const PricingComparison: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-wrap tw-gap-6 tw-p-4 tw-justify-center">
        <div class="tw-flex tw-flex-col tw-h-full">
          <billing-pricing-card
            tagline="Your current plan with essential features"
            [price]="{ amount: 0, cadence: 'monthly' }"
            [features]="['Store unlimited passwords', 'Access from any device', 'Secure password generator']"
            [activeBadge]="{ text: 'Active plan' }">
            <h3 class="title-slot tw-m-0" bitTypography="h3">Free</h3>
          </billing-pricing-card>
        </div>
        
        <div class="tw-flex tw-flex-col tw-h-full">
          <billing-pricing-card
            tagline="Everything you need for secure password management"
            [price]="{ amount: 10, cadence: 'monthly' }"
            [button]="{ text: 'Upgrade to Premium', type: 'primary' }"
            [features]="['Unlimited passwords and passkeys', 'Secure password sharing', 'Integrated 2FA authenticator', 'Advanced 2FA options', 'Priority customer support']">
            <h3 class="title-slot tw-m-0" bitTypography="h3">Premium</h3>
          </billing-pricing-card>
        </div>
        
        <div class="tw-flex tw-flex-col tw-h-full">
          <billing-pricing-card
            tagline="Advanced security and management for teams"
            [price]="{ amount: 5, cadence: 'monthly', showPerUser: true }"
            [button]="{ text: 'Start Business Trial', type: 'primary' }"
            [features]="['Everything in Premium', 'Admin dashboard', 'Team reporting', 'Advanced permissions', 'SSO integration']">
            <h3 class="title-slot tw-m-0" bitTypography="h3">Business</h3>
          </billing-pricing-card>
        </div>
      </div>
    `,
    props: {},
  }),
};

export const WithButtonIcon: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-gap-6 tw-p-4 tw-flex-wrap tw-justify-center">
        <!-- Test card with external link icon after text -->
        <billing-pricing-card
          tagline="Upgrade for advanced features"
          [price]="{ amount: 10, cadence: 'monthly' }"
          [button]="{ text: 'Upgrade Now', type: 'primary', icon: { type: 'bwi-external-link', position: 'after' } }"
          [features]="['Advanced security', 'Priority support', 'Extra storage']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Premium</h3>
        </billing-pricing-card>
        
        <!-- Test card with plus icon before text -->
        <billing-pricing-card
          tagline="Add more features to your plan"
          [price]="{ amount: 5, cadence: 'monthly', showPerUser: true }"
          [button]="{ text: 'Add Features', type: 'secondary', icon: { type: 'bwi-plus', position: 'before' } }"
          [features]="['Team management', 'Enhanced reporting', 'Custom branding']">
          <h3 class="title-slot tw-m-0" bitTypography="h3">Business</h3>
        </billing-pricing-card>
      </div>
    `,
    props: {},
  }),
};

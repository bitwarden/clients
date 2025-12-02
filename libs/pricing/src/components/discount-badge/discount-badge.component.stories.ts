import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule } from "@bitwarden/components";

import { DiscountBadgeComponent, DiscountInfo } from "./discount-badge.component";

export default {
  title: "Billing/Discount Badge",
  component: DiscountBadgeComponent,
  description: "A badge component that displays discount information (percentage or fixed amount).",
  decorators: [
    moduleMetadata({
      imports: [BadgeModule],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "discount":
                  return "discount";
                default:
                  return key;
              }
            },
          },
        },
      ],
    }),
  ],
} as Meta<DiscountBadgeComponent>;

type Story = StoryObj<DiscountBadgeComponent>;

export const PercentDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: true,
      percentOff: 20,
    } as DiscountInfo,
  },
};

export const PercentDiscountDecimal: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: true,
      percentOff: 0.15, // 15% in decimal format
    } as DiscountInfo,
  },
};

export const AmountDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: true,
      amountOff: 10.99,
    } as DiscountInfo,
  },
};

export const LargeAmountDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: true,
      amountOff: 99.99,
    } as DiscountInfo,
  },
};

export const InactiveDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: false,
      percentOff: 20,
    } as DiscountInfo,
  },
};

export const NoDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: null,
  },
};

export const PercentAndAmountPreferPercent: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      active: true,
      percentOff: 25,
      amountOff: 10.99,
    } as DiscountInfo,
  },
};

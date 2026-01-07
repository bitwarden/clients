import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule } from "@bitwarden/components";
import { Discount, DiscountBadgeComponent, DiscountTypes } from "@bitwarden/pricing";

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
      type: DiscountTypes.PercentOff,
      active: true,
      value: 20,
    } as Discount,
  },
};

export const PercentDiscountDecimal: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      type: DiscountTypes.PercentOff,
      active: true,
      value: 0.15, // 15% in decimal format
    } as Discount,
  },
};

export const AmountDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      type: DiscountTypes.AmountOff,
      active: true,
      value: 10.99,
    } as Discount,
  },
};

export const LargeAmountDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      type: DiscountTypes.AmountOff,
      active: true,
      value: 99.99,
    } as Discount,
  },
};

export const InactiveDiscount: Story = {
  render: (args) => ({
    props: args,
    template: `<billing-discount-badge [discount]="discount"></billing-discount-badge>`,
  }),
  args: {
    discount: {
      type: DiscountTypes.PercentOff,
      active: false,
      value: 20,
    } as Discount,
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

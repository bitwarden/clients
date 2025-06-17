import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { EnterBillingAddressComponent } from "./";

export default {
  title: "Web/Billing/Address/Form",
  component: EnterBillingAddressComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<EnterBillingAddressComponent>;

const render: Story["render"] = (args) => ({
  props: {
    ...args,
  },
  template: `
    <app-enter-billing-address [scenario]="scenario" [group]="group"></app-enter-billing-address>
  `,
});

export const Checkout: Story = {
  args: {
    scenario: {
      type: "checkout",
      useCase: "personal",
    },
    group: EnterBillingAddressComponent.getFormGroup(),
  },
  render,
};

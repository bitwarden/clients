import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { IconButtonModule } from "../icon-button";

import { DisclosureTriggerForDirective } from "./disclosure-trigger-for.directive";
import { DisclosureComponent } from "./disclosure.component";

export default {
  title: "Component Library/Disclosure",
  component: DisclosureComponent,
  decorators: [
    moduleMetadata({
      imports: [DisclosureTriggerForDirective, DisclosureComponent, IconButtonModule],
    }),
  ],
} as Meta<DisclosureComponent>;

type Story = StoryObj<DisclosureComponent>;

export const DisclosureWithIconButton: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" bitIconButton="bwi-sliders" [buttonType]="'muted'" [bitDisclosureTriggerFor]="disclosureRef">
      </button>
      <bit-disclosure #disclosureRef class="tw-text-main tw-block" open>click button to hide this content</bit-disclosure>
    `,
  }),
};

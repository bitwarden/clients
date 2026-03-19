import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { I18nMockService } from "../utils";

import { DisclosureTriggerForDirective } from "./disclosure-trigger-for.directive";
import { DisclosureComponent } from "./disclosure.component";

export default {
  title: "Component Library/Disclosure",
  component: DisclosureComponent,
  decorators: [
    moduleMetadata({
      imports: [DisclosureTriggerForDirective, DisclosureComponent, IconButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-47329&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta<DisclosureComponent>;

type Story = StoryObj<DisclosureComponent>;

export const DisclosureOpen: Story = {
  args: {
    open: true,
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" label="Settings" bitIconButton="bwi-sliders" buttonType="muted" [bitDisclosureTriggerFor]="disclosureRef">
      </button>
      <bit-disclosure #disclosureRef class="tw-text-main tw-block" [(open)]="open">click button to hide this content</bit-disclosure>
    `,
  }),
};

export const DisclosureClosed: Story = {
  args: {
    open: false,
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" label="Settings" bitIconButton="bwi-sliders" buttonType="muted" [bitDisclosureTriggerFor]="disclosureRef">
      </button>
      <bit-disclosure #disclosureRef class="tw-text-main tw-block" [(open)]="open">click button to hide this content</bit-disclosure>
    `,
  }),
};

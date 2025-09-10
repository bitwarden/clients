import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils";

import { NoItemsComponent } from "./no-items.component";
import { NoItemsModule } from "./no-items.module";

export default {
  title: "Component Library/No Items",
  component: NoItemsComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, NoItemsModule],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ loading: "Loading" }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21665-25102&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta;

type Story = StoryObj<NoItemsComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
    <bit-no-items class="tw-text-main">
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">Your description here.</ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <i class="bwi bwi-plus" aria-hidden="true"></i>
          New item
      </button>
    </bit-no-items>
    `,
  }),
};

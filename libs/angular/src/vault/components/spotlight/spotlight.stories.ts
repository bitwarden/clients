import { moduleMetadata, Meta, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  I18nMockService,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import { SpotlightComponent } from "./spotlight.component";

const meta: Meta<SpotlightComponent> = {
  title: "Vault/Spotlight",
  component: SpotlightComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, IconButtonModule, TypographyModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  args: {
    title: "Primary",
    subtitle: "Callout Text",
    buttonText: "Button",
  },
};

export default meta;
type Story = StoryObj<SpotlightComponent>;

export const Default: Story = {};

export const WithoutButton: Story = {
  args: {
    buttonText: undefined,
  },
};

export const Persistent: Story = {
  args: {
    persistent: true,
  },
};

export const WithButtonIcon: Story = {
  args: {
    buttonIcon: "bwi bwi-external-link",
  },
  render: (args) => ({
    props: args,
    template: `
      <bit-spotlight
        [title]="title"
        [subtitle]="subtitle"
        buttonText="External Link"
        buttonIcon="bwi-external-link"
      ></bit-spotlight>
    `,
  }),
};

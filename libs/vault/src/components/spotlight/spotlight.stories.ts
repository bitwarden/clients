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

export const WithCustomButton: Story = {
  args: {
    buttonText: "Custom Button",
  },
  render: (args) => ({
    props: args,
    template: `
      <bit-spotlight
        [title]="title"
        [subtitle]="subtitle"
      >
        <button
          class="tw-w-full"
          bit-item-content
          bitButton
          type="button"
          buttonType="primary"
          (click)="handleButtonClick()"
        >
          External Link
           <i slot="end" class="bwi bwi-external-link ml-2" aria-hidden="true"></i>
        </button>
      </bit-spotlight>
    `,
  }),
};

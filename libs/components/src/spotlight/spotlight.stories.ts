import { moduleMetadata, Meta, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SpotlightComponent } from "./spotlight.component";

const meta: Meta<SpotlightComponent> = {
  title: "Component Library/Spotlight",
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

const defaultContent = `
  <div class="tw-w-80">
    <bit-spotlight
      [title]="title"
      [subtitle]="subtitle"
      [buttonText]="buttonText"
      (onDismiss)="handleDismiss()"
    ></bit-spotlight>
  <div class="tw-w-40">
`;

export default meta;
type Story = StoryObj<SpotlightComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
    ${defaultContent}`,
  }),
};

export const WithoutButton: Story = {
  args: {
    title: "Primary",
    subtitle: "Callout Text",
    buttonText: undefined,
  },
};

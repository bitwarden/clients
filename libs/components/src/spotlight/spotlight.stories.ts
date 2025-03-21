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

export default meta;
type Story = StoryObj<SpotlightComponent>;

export const Default: Story = {};

export const WithoutButton: Story = {
  args: {
    buttonText: undefined,
  },
};

export const Indismissable: Story = {
  args: {
    indismissable: true,
  },
};

import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { ImportConfirmationStatesComponent } from "./import-confirmation-states.component";

export default {
  title: "Tools/Import/Extension tab states",
  component: ImportConfirmationStatesComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              importingItemsTitle: (count?: string) => `Importing ${count} items!`,
              importingItemsTitleSingular: "Importing 1 item!",
              openingExtensionSubtitle: "Opening the browser extension",
              openedExtensionTitle: "Opened the browser extension",
              somethingWentWrong: "Something went wrong...",
              openingExtensionError:
                "We had trouble opening the Bitwarden browser extension. Click the button to open it now.",
              openExtension: "Open extension",
              openingExtensionToolbarErrorPart1:
                "We had trouble opening the Bitwarden browser extension. Open the Bitwarden icon ",
              openingExtensionToolbarErrorPart2: " from the toolbar.",
              loading: "Loading",
            }),
        },
      ],
    }),
  ],
  args: { total: 74, retrying: false },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/XSVfwUs74g0353SKulKmWN/Import?node-id=6618-91619",
    },
  },
} as Meta<ImportConfirmationStatesComponent>;

type Story = StoryObj<ImportConfirmationStatesComponent>;

/** Figma 6618:91619. */
export const Opening: Story = { args: { phase: "opening" } };

/** Figma 6618:91643. */
export const Opened: Story = { args: { phase: "opened" } };

/** Figma 6618:92321: the popup could not be opened, so the user is offered a button. */
export const OpenExtensionButton: Story = { args: { phase: "button" } };

/** Figma 6618:92345: the button could not open it either. */
export const ToolbarInstructions: Story = { args: { phase: "toolbar" } };

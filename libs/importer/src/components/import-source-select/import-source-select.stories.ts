import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { I18nMockService } from "@bitwarden/components";

import { ImportSourceSelectComponent } from "./import-source-select.component";

export default {
  title: "Tools/Import/Source Select",
  component: ImportSourceSelectComponent,
  decorators: [
    moduleMetadata({
      providers: [
        // Storybook's light/dark toolbar toggle only flips a CSS class (withThemeByClassName in
        // preview.tsx) — it doesn't touch AbstractThemingService, so this is a static stand-in
        // rather than something that reacts to the toolbar. Without it the story throws
        // NullInjectorError, since the component now injects this service directly.
        { provide: AbstractThemingService, useValue: { theme$: of(ThemeTypes.Light) } },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              search: "Search",
              resetSearch: "Reset search",
              continue: "Continue",
              progressBar: "Progress",
              importSourceBreadcrumb: "Select source",
              importSourceBrowsers: "Browsers",
              importSourcePasswordManagers: "Password managers",
              importSourceSelectTitle: "Select your source",
              importSourceSelectDescription:
                "Choose the password manager or browser you are importing from.",
              importSourceShowAll: "Show all",
              importSourceShowLess: "Show less",
              importSourceStepCount: (current?: string, total?: string) =>
                `Step ${current} of ${total}`,
              noMatchingItems: "No matching items",
            });
          },
        },
      ],
    }),
  ],
} as Meta<ImportSourceSelectComponent>;

type Story = StoryObj<ImportSourceSelectComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `<importer-source-select></importer-source-select>`,
  }),
};

export const SecondStep: Story = {
  render: (args) => ({
    props: args,
    template: `<importer-source-select [currentStep]="2" [totalSteps]="3"></importer-source-select>`,
  }),
};

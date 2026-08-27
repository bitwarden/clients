import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { ImportSourceSelectComponent } from "./import-source-select.component";

export default {
  title: "Tools/Import/Source Select",
  component: ImportSourceSelectComponent,
  decorators: [
    moduleMetadata({
      providers: [
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

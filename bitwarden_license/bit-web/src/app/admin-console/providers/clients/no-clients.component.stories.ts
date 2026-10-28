import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { NoClientsComponent } from "./no-clients.component";

export default {
  title: "Admin Console/Providers/Clients/No Clients",
  component: NoClientsComponent,
  decorators: [
    moduleMetadata({
      imports: [NoClientsComponent],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    addNewOrganizationClicked: action("addNewOrganizationClicked"),
  },
} satisfies Meta<NoClientsComponent>;

type Story = StoryObj<NoClientsComponent>;

export const Default: Story = {};

export const AddOrganizationButtonHidden: Story = {
  args: {
    showAddOrganizationButton: false,
  },
};

export const AddOrganizationButtonDisabled: Story = {
  args: {
    disableAddOrganizationButton: true,
  },
};

import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AddableOrganizationResponse } from "@bitwarden/common/admin-console/models/response/addable-organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { WebProviderService } from "../services/web-provider.service";

import { AddExistingOrganizationDialogComponent } from "./add-existing-organization-dialog.component";

const provider = {
  id: "provider-story-1",
  name: "Acme MSP",
  type: ProviderUserType.ProviderAdmin,
} as Provider;

function storyProviders(addableOrganizations: AddableOrganizationResponse[]) {
  return [
    {
      provide: ProviderApiServiceAbstraction,
      useValue: { getProviderAddableOrganizations: async () => addableOrganizations },
    },
  ];
}

export default {
  title: "Admin Console/Providers/Clients/Add Existing Organization Dialog",
  component: AddExistingOrganizationDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [AddExistingOrganizationDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { provider } },
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
        {
          provide: WebProviderService,
          useValue: {
            addOrganizationToProvider: action("WebProviderService.addOrganizationToProvider"),
          },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-story-1" }) } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<AddExistingOrganizationDialogComponent>;

type Story = StoryObj<AddExistingOrganizationDialogComponent>;

export const Default: Story = {
  decorators: [
    moduleMetadata({
      providers: storyProviders([
        new AddableOrganizationResponse({
          id: "org-1",
          name: "Acme Inc",
          plan: "Teams (Monthly)",
          seats: 10,
          disabled: false,
        }),
        new AddableOrganizationResponse({
          id: "org-2",
          name: "Umbrella Corp",
          plan: "Enterprise (Monthly)",
          seats: 500,
          disabled: true,
        }),
      ]),
    }),
  ],
};

export const Empty: Story = {
  decorators: [moduleMetadata({ providers: storyProviders([]) })],
};

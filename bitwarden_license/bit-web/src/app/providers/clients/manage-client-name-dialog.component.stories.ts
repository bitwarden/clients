import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ManageClientNameDialogComponent } from "./manage-client-name-dialog.component";

export default {
  title: "Admin Console/Providers/Clients/Manage Client Name Dialog",
  component: ManageClientNameDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ManageClientNameDialogComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            providerId: "provider-story-1",
            organization: { id: "org-1", name: "Acme Inc", seats: 10 },
          },
        },
        {
          provide: ProviderApiServiceAbstraction,
          useValue: {
            updateProviderOrganization: action("ProviderApiService.updateProviderOrganization"),
          },
        },
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<ManageClientNameDialogComponent>;

type Story = StoryObj<ManageClientNameDialogComponent>;

export const Default: Story = {};

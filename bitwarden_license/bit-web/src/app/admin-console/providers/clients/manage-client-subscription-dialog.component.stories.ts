import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProviderSubscriptionResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ManageClientSubscriptionDialogComponent } from "./manage-client-subscription-dialog.component";

const organization = new ProviderOrganizationOrganizationDetailsResponse({
  id: "provider-org-1",
  providerId: "provider-story-1",
  organizationId: "org-1",
  organizationName: "Acme Inc",
  seats: 10,
  occupiedSeats: 4,
  remainingSeats: 6,
  plan: "Teams (Monthly)",
  userCount: 4,
});

function storyProviders(providerType: ProviderUserType, purchasedSeats: number) {
  return [
    {
      provide: DIALOG_DATA,
      useValue: {
        organization,
        provider: { id: "provider-story-1", name: "Acme MSP", type: providerType } as Provider,
      },
    },
    {
      provide: BillingApiServiceAbstraction,
      useValue: {
        getProviderSubscription: async () =>
          new ProviderSubscriptionResponse({
            plans: [
              {
                PlanName: "Teams (Monthly)",
                SeatMinimum: 100,
                AssignedSeats: 40,
                PurchasedSeats: purchasedSeats,
              },
            ],
          }),
      },
    },
  ];
}

export default {
  title: "Admin Console/Providers/Clients/Manage Client Subscription Dialog",
  component: ManageClientSubscriptionDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ManageClientSubscriptionDialogComponent],
      providers: [
        {
          provide: ProviderApiServiceAbstraction,
          useValue: {
            updateProviderOrganization: action("ProviderApiService.updateProviderOrganization"),
          },
        },
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        {
          provide: BillingNotificationService,
          useValue: {
            showSuccess: action("BillingNotificationService.showSuccess"),
            handleError: action("BillingNotificationService.handleError"),
          },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<ManageClientSubscriptionDialogComponent>;

type Story = StoryObj<ManageClientSubscriptionDialogComponent>;

export const ProviderAdmin: Story = {
  decorators: [moduleMetadata({ providers: storyProviders(ProviderUserType.ProviderAdmin, 0) })],
};

export const ServiceUserWithPurchasedSeats: Story = {
  decorators: [moduleMetadata({ providers: storyProviders(ProviderUserType.ServiceUser, 5) })],
};

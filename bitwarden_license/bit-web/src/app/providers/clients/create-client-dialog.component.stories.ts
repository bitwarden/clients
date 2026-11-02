import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ProviderSubscriptionResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { WebProviderService } from "../services/web-provider.service";

import { CreateClientDialogComponent } from "./create-client-dialog.component";

const plans = [
  new PlanResponse({
    Type: PlanType.TeamsMonthly,
    ProductTier: ProductTierType.Teams,
    Name: "Teams (Monthly)",
    IsAnnual: false,
    PasswordManager: { ProviderPortalSeatPrice: 4 },
  }),
  new PlanResponse({
    Type: PlanType.EnterpriseMonthly,
    ProductTier: ProductTierType.Enterprise,
    Name: "Enterprise (Monthly)",
    IsAnnual: false,
    PasswordManager: { ProviderPortalSeatPrice: 6 },
  }),
];

function subscription(discountPercentage: number | null) {
  return new ProviderSubscriptionResponse({
    discountPercentage,
    plans: [
      {
        PlanName: "Teams (Monthly)",
        Type: PlanType.TeamsMonthly,
        SeatMinimum: 100,
        AssignedSeats: 40,
        PurchasedSeats: 0,
      },
      {
        PlanName: "Enterprise (Monthly)",
        Type: PlanType.EnterpriseMonthly,
        SeatMinimum: 100,
        AssignedSeats: 95,
        PurchasedSeats: 0,
      },
    ],
  });
}

function storyProviders(discountPercentage: number | null) {
  return [
    {
      provide: BillingApiServiceAbstraction,
      useValue: { getProviderSubscription: async () => subscription(discountPercentage) },
    },
  ];
}

export default {
  title: "Admin Console/Providers/Clients/Create Client Dialog",
  component: CreateClientDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CreateClientDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { providerId: "provider-story-1", plans } },
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
        {
          provide: WebProviderService,
          useValue: {
            createClientOrganization: action("WebProviderService.createClientOrganization"),
          },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-story-1" }) } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<CreateClientDialogComponent>;

type Story = StoryObj<CreateClientDialogComponent>;

export const Default: Story = {
  decorators: [moduleMetadata({ providers: storyProviders(null) })],
};

export const WithProviderDiscount: Story = {
  decorators: [moduleMetadata({ providers: storyProviders(20) })],
};

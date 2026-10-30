import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DialogService,
  LayoutComponent,
  StorybookGlobalStateProvider,
  ToastService,
} from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { WebProviderService } from "../services/web-provider.service";

import { ManageClientsComponent } from "./manage-clients.component";

const PROVIDER_ID = "provider-story-1";
const USER_ID = "user-story-1" as UserId;

function client(
  overrides: Partial<ProviderOrganizationOrganizationDetailsResponse> = {},
): ProviderOrganizationOrganizationDetailsResponse {
  return new ProviderOrganizationOrganizationDetailsResponse({
    id: "provider-org-1",
    providerId: PROVIDER_ID,
    organizationId: "org-1",
    organizationName: "Acme Inc",
    seats: 10,
    occupiedSeats: 4,
    remainingSeats: 6,
    plan: "Teams (Monthly)",
    userCount: 4,
    ...overrides,
  });
}

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: PROVIDER_ID,
    name: "Acme MSP",
    enabled: true,
    type: ProviderUserType.ProviderAdmin,
    providerType: 0,
    canAccess: true,
    canCreateOrganizations: true,
    canManageUsers: true,
    canAccessEventLogs: true,
    isProviderAdmin: true,
    ...overrides,
  } as Provider;
}

function storyProviders(
  clients: ProviderOrganizationOrganizationDetailsResponse[],
  providerOverrides: Partial<Provider> = {},
) {
  const activeProvider = provider(providerOverrides);
  return [
    { provide: ProviderService, useValue: { get$: () => of(activeProvider) } },
    {
      provide: ProviderApiServiceAbstraction,
      useValue: { getProviderOrganizations: async () => ({ data: clients }) },
    },
    {
      provide: BillingApiServiceAbstraction,
      useValue: { getPlans: async () => ({ data: [] as PlanResponse[] }) },
    },
  ];
}

const routes: Routes = [
  {
    path: ":providerId",
    children: [
      { path: "clients", component: ManageClientsComponent, data: { titleId: "clients" } },
    ],
  },
];

const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

export default {
  title: "Admin Console/Providers/Clients/Manage Clients",
  component: ManageClientsComponent,
  render: () => ({
    template: `<bit-layout style="height: 800px">
    <router-outlet></router-outlet>
  </bit-layout>`,
  }),
  decorators: [
    moduleMetadata({
      imports: [RouterOutlet, LayoutComponent],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) => of(flag === FeatureFlag.VFO1Foundation),
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: action("DialogService.open"),
            openSimpleDialog: async () => true,
          },
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") },
        },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        {
          provide: WebProviderService,
          useValue: { detachOrganization: action("WebProviderService.detachOrganization") },
        },
        {
          provide: BillingNotificationService,
          useValue: { handleError: action("BillingNotificationService.handleError") },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
      ],
    }),
  ],
} satisfies Meta<ManageClientsComponent>;

type Story = StoryObj<ManageClientsComponent>;

export const Default: Story = {
  decorators: [
    atUrl(`/${PROVIDER_ID}/clients`),
    moduleMetadata({
      providers: storyProviders([
        client({ id: "provider-org-1", organizationId: "org-1", organizationName: "Acme Inc" }),
        client({
          id: "provider-org-2",
          organizationId: "org-2",
          organizationName: "Umbrella Corp",
          seats: 25,
          occupiedSeats: 25,
          remainingSeats: 0,
          plan: "Enterprise (Annually)",
        }),
      ]),
    }),
  ],
};

export const Empty: Story = {
  decorators: [atUrl(`/${PROVIDER_ID}/clients`), moduleMetadata({ providers: storyProviders([]) })],
};

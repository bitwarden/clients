import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import {
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, StorybookGlobalStateProvider } from "@bitwarden/components";
import { GlobalStateProvider, StateProvider } from "@bitwarden/state";
import { LockService } from "@bitwarden/unlock";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ProviderWarningsService } from "../../billing/providers/warnings/services";

import { ProvidersLayoutComponent } from "./providers-layout.component";

const PROVIDER_ID = "provider-story-1";
const USER_ID = "user-story-1" as UserId;

@Component({
  selector: "story-provider-page",
  template: `<p>Provider page content</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryProviderPageComponent {}

const routes: Routes = [
  {
    path: "providers/:providerId",
    component: ProvidersLayoutComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "clients" },
      { path: "clients", component: StoryProviderPageComponent },
      {
        path: "manage",
        children: [
          { path: "", pathMatch: "full", redirectTo: "members" },
          { path: "members", component: StoryProviderPageComponent },
          { path: "events", component: StoryProviderPageComponent },
        ],
      },
      {
        path: "billing",
        children: [
          { path: "", pathMatch: "full", redirectTo: "subscription" },
          { path: "subscription", component: StoryProviderPageComponent },
          { path: "payment-details", component: StoryProviderPageComponent },
          { path: "history", component: StoryProviderPageComponent },
        ],
      },
      {
        path: "settings",
        children: [
          { path: "", pathMatch: "full", redirectTo: "account" },
          { path: "account", component: StoryProviderPageComponent },
        ],
      },
    ],
  },
];

const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

function provider(overrides: Partial<Provider> = {}): Provider {
  return new Provider({
    id: PROVIDER_ID,
    name: "Acme Managed Services",
    status: ProviderUserStatusType.Confirmed,
    type: ProviderUserType.ProviderAdmin,
    enabled: true,
    userId: USER_ID,
    useEvents: true,
    providerStatus: undefined,
    providerType: ProviderType.Msp,
    ...overrides,
  } as any);
}

export default {
  title: "Admin Console/Providers/Providers Layout",
  component: ProvidersLayoutComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({
      imports: [RouterOutlet, StoryProviderPageComponent],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: ProviderService,
          useValue: {
            get$: () => of(provider()),
            providers$: () => of([provider()]),
          },
        },
        {
          provide: ProviderWarningsService,
          useValue: {
            showProviderSuspendedDialog$: () => of(undefined),
            getTaxIdWarning$: () => of(null),
            refreshTaxIdWarning: () => {},
          },
        },
        {
          provide: StateProvider,
          useValue: {
            getUser: () => ({ state$: of(null) }),
            getUserState$: () => of(null),
          },
        },
        { provide: ApiService, useValue: {} },
        {
          provide: DialogService,
          useValue: { open: (): undefined => undefined, openSimpleDialog: async () => true },
        },
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        {
          provide: PlatformUtilsService,
          useValue: { isSelfHost: () => false, copyToClipboard: () => {} },
        },
        {
          provide: SyncService,
          useValue: { fullSync: async () => true, getLastSync: async () => new Date() },
        },
        {
          provide: PolicyService,
          useValue: { policiesByType$: () => of([]), policyAppliesToUser$: () => of(false) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(false) },
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          provide: VaultTimeoutSettingsService,
          useValue: { availableVaultTimeoutActions$: () => of([]) },
        },
        { provide: LogoutService, useValue: { logout: async () => {} } },
        { provide: LockService, useValue: { lock: async () => {} } },
        { provide: AvatarService, useValue: { avatarColor$: of("#175DDC") } },
      ],
    }),
  ],
} satisfies Meta<ProvidersLayoutComponent>;

type Story = StoryObj<ProvidersLayoutComponent>;

export const Default: Story = {
  decorators: [atUrl(`/providers/${PROVIDER_ID}/clients`)],
};

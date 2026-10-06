import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { action } from "storybook/actions";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { BraintreeService, StripeService } from "@bitwarden/web-vault/app/billing/services";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { SetupComponent } from "./setup.component";

const PROVIDER_ID = "provider-story-1";

const mockUnnamedProvider = new ProviderResponse({
  Id: PROVIDER_ID,
  Name: null,
  BusinessName: null,
  BillingEmail: null,
  CreationDate: "2024-01-01T00:00:00.000Z",
});

const SETUP_QUERY_PARAMS = of({
  providerId: PROVIDER_ID,
  email: "jane@example.com",
  token: "story-token",
});

const mockBraintreeService: Partial<BraintreeService> = {
  loadBraintree: () => {},
  createDropin: () => {},
  requestPaymentMethod: () => Promise.resolve("mock-braintree-nonce"),
  unloadBraintree: () => {},
};

const mockStripeService: Partial<StripeService> = {
  loadStripe: () => {},
  mountElements: () => {},
  unloadStripe: () => {},
  createSetupIntent: () => Promise.resolve("mock-client-secret"),
  setupCardPaymentMethod: () => Promise.resolve("mock-payment-method"),
  setupBankAccountPaymentMethod: () => Promise.resolve("mock-payment-method"),
};

export default {
  title: "Admin Console/Providers/Setup/Setup",
  component: SetupComponent,
  decorators: [
    moduleMetadata({
      declarations: [SetupComponent],
      imports: [SharedModule, EnterPaymentMethodComponent, EnterBillingAddressComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: SETUP_QUERY_PARAMS } },
        {
          provide: ProviderApiServiceAbstraction,
          useValue: {
            getProvider: async () => mockUnnamedProvider,
            postProviderSetup: async () => mockUnnamedProvider,
          },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-story-1", email: "jane@example.com" }) },
        },
        {
          provide: LegacyCompatKeyService,
          useValue: {
            makeOrgKey: async () => [{ encryptedString: "encrypted-provider-key" }, {}],
          },
        },
        { provide: SyncService, useValue: { fullSync: async () => true } },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
        { provide: BraintreeService, useValue: mockBraintreeService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: LogService, useValue: { warning: () => {}, error: () => {} } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<SetupComponent>;

type Story = StoryObj<SetupComponent>;

/** The provider creation form: name, billing email, payment method, and billing address. */
export const Default: Story = {};

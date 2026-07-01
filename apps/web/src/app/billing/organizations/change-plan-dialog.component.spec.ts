import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUpgradeRequest } from "@bitwarden/common/admin-console/models/request/organization-upgrade.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  SubscriberBillingClient,
  PreviewInvoiceClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { BillingNotificationService } from "../services/billing-notification.service";

import { ChangePlanDialogComponent } from "./change-plan-dialog.component";

describe("ChangePlanDialogComponent (additional service accounts)", () => {
  let component: ChangePlanDialogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        ChangePlanDialogComponent,
        { provide: DIALOG_DATA, useValue: {} },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: Router, useValue: mock<Router>() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: mock<OrganizationApiServiceAbstraction>(),
        },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: BillingNotificationService, useValue: mock<BillingNotificationService>() },
        { provide: SubscriberBillingClient, useValue: mock<SubscriberBillingClient>() },
        { provide: PreviewInvoiceClient, useValue: mock<PreviewInvoiceClient>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
      ],
    });

    component = TestBed.inject(ChangePlanDialogComponent);
  });

  describe("get additionalServiceAccount", () => {
    // Reported PM-39805 org: 75 total entitlement, 20 static baseline. Grace varies per case.
    const setState = (grace: number | undefined) => {
      component.currentPlan = { SecretsManager: { baseServiceAccount: 20 } } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: grace } as any;
    };

    it("subtracts permanent migration-grace accounts before pricing (75 - 20 - 30 = 25)", () => {
      setState(30);

      expect(component.additionalServiceAccount).toBe(25);
    });

    it("treats an absent grace value as zero (pre-server behavior: 75 - 20 = 55)", () => {
      setState(undefined);

      expect(component.additionalServiceAccount).toBe(55);
    });

    it("treats grace = 0 the same as no grace (75 - 20 = 55)", () => {
      setState(0);

      expect(component.additionalServiceAccount).toBe(55);
    });

    it("clamps to zero when grace exceeds the billable count (bad server data: 75 - 20 - 80)", () => {
      setState(80);

      expect(component.additionalServiceAccount).toBe(0);
    });

    it("returns 0 when the current plan has no Secrets Manager", () => {
      component.currentPlan = { SecretsManager: null } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: 30 } as any;

      expect(component.additionalServiceAccount).toBe(0);
    });
  });

  describe("buildSecretsManagerRequest (write path)", () => {
    it("submits the post-grace additional service account count", () => {
      component.organization = { useSecretsManager: true, seats: 5 } as any;
      // currentPlan is not Free, so the request takes the existing-subscription branch.
      component.currentPlan = {
        productTier: ProductTierType.Teams,
        SecretsManager: { baseServiceAccount: 20 },
      } as any;
      component.selectedPlan = { SecretsManager: { hasAdditionalSeatsOption: true } } as any;
      component.sub = {
        smSeats: 5,
        smServiceAccounts: 75,
        smServiceAccountsGrace: 30,
      } as any;

      const request = new OrganizationUpgradeRequest();
      (component as any).buildSecretsManagerRequest(request);

      expect(request.additionalServiceAccounts).toBe(25); // 75 - 20 - 30
      expect(request.additionalSmSeats).toBe(5);
    });

    it("does not set service accounts when the organization does not use Secrets Manager", () => {
      component.organization = { useSecretsManager: false } as any;
      component.currentPlan = {
        productTier: ProductTierType.Teams,
        SecretsManager: { baseServiceAccount: 20 },
      } as any;
      component.selectedPlan = { SecretsManager: { hasAdditionalSeatsOption: true } } as any;
      component.sub = { smServiceAccounts: 75, smServiceAccountsGrace: 30 } as any;

      const request = new OrganizationUpgradeRequest();
      (component as any).buildSecretsManagerRequest(request);

      expect(request.useSecretsManager).toBe(false);
      expect(request.additionalServiceAccounts).toBeUndefined();
    });
  });
});

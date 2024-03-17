import { any, mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { FakeActiveUserState } from "../../../spec/fake-state";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { BillingApiServiceAbstraction as BillingApiService } from "../abstractions/billilng-api.service.abstraction";
import { PAYMENT_METHOD_WARNINGS_KEY } from "../models/billing-keys.state";
import { PaymentMethodWarning } from "../models/domain/payment-method-warning";
import { OrganizationBillingStatusResponse } from "../models/response/organization-billing-status.response";

import { PaymentMethodWarningsService } from "./payment-method-warnings.service";

describe("Payment Method Warnings Service", () => {
  let paymentMethodWarningsService: PaymentMethodWarningsService;
  let billingApiService: MockProxy<BillingApiService>;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let activeUserState: FakeActiveUserState<Record<string, PaymentMethodWarning>>;

  function getPastDate(daysAgo: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  const getBillingStatusResponse = (organizationId: string) =>
    new OrganizationBillingStatusResponse({
      OrganizationId: organizationId,
      OrganizationName: "Teams Organization",
      RisksSubscriptionFailure: true,
    });

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);
    activeUserState = stateProvider.activeUser.getFake(PAYMENT_METHOD_WARNINGS_KEY);

    billingApiService = mock<BillingApiService>();
    paymentMethodWarningsService = new PaymentMethodWarningsService(
      billingApiService,
      stateProvider,
    );
  });

  it("acknowledge", async () => {
    const organizationId = "1";
    const state: Record<string, PaymentMethodWarning> = {
      [organizationId]: {
        organizationName: "Teams Organization",
        risksSubscriptionFailure: true,
        acknowledged: false,
        savedAt: getPastDate(3),
      },
    };
    activeUserState.nextState(state);
    await paymentMethodWarningsService.acknowledge(organizationId);
    expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({
      [organizationId]: {
        ...state[organizationId],
        acknowledged: true,
      },
    });
  });

  it("clear", async () => {
    const state: Record<string, PaymentMethodWarning> = {
      "1": {
        organizationName: "Teams Organization",
        risksSubscriptionFailure: true,
        acknowledged: false,
        savedAt: getPastDate(3),
      },
    };
    activeUserState.nextState(state);
    await paymentMethodWarningsService.clear();
    expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({});
  });

  it("removeSubscriptionRisk", async () => {
    const organizationId = "1";
    const state: Record<string, PaymentMethodWarning> = {
      [organizationId]: {
        organizationName: "Teams Organization",
        risksSubscriptionFailure: true,
        acknowledged: false,
        savedAt: getPastDate(3),
      },
    };
    activeUserState.nextState(state);
    await paymentMethodWarningsService.removeSubscriptionRisk(organizationId);
    expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({
      [organizationId]: {
        ...state[organizationId],
        risksSubscriptionFailure: false,
      },
    });
  });

  describe("update", () => {
    it("Does nothing if the stored payment method warning is less than a week old", async () => {
      const organizationId = "1";
      const state: Record<string, PaymentMethodWarning> = {
        [organizationId]: {
          organizationName: "Teams Organization",
          risksSubscriptionFailure: true,
          acknowledged: false,
          savedAt: getPastDate(3),
        },
      };
      activeUserState.nextState(state);
      await paymentMethodWarningsService.update(organizationId);
      expect(billingApiService.getBillingStatus).not.toHaveBeenCalled();
    });

    it("Retrieves the billing status from the API and uses it to update the state if the state is null", async () => {
      const organizationId = "1";
      activeUserState.nextState(null);
      billingApiService.getBillingStatus.mockResolvedValue(
        getBillingStatusResponse(organizationId),
      );
      await paymentMethodWarningsService.update(organizationId);
      expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({
        [organizationId]: {
          organizationName: "Teams Organization",
          risksSubscriptionFailure: true,
          acknowledged: false,
          savedAt: any(),
        },
      });
      expect(billingApiService.getBillingStatus).toHaveBeenCalledTimes(1);
    });

    it("Retrieves the billing status from the API and uses it to update the state if the stored warning is null", async () => {
      const organizationId = "1";
      activeUserState.nextState({
        [organizationId]: null,
      });
      billingApiService.getBillingStatus.mockResolvedValue(
        getBillingStatusResponse(organizationId),
      );
      await paymentMethodWarningsService.update(organizationId);
      expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({
        [organizationId]: {
          organizationName: "Teams Organization",
          risksSubscriptionFailure: true,
          acknowledged: false,
          savedAt: any(),
        },
      });
      expect(billingApiService.getBillingStatus).toHaveBeenCalledTimes(1);
    });

    it("Retrieves the billing status from the API and uses it to update the state if the stored warning is older than a week", async () => {
      const organizationId = "1";
      activeUserState.nextState({
        [organizationId]: {
          organizationName: "Teams Organization",
          risksSubscriptionFailure: false,
          acknowledged: false,
          savedAt: getPastDate(10),
        },
      });
      billingApiService.getBillingStatus.mockResolvedValue(
        new OrganizationBillingStatusResponse({
          OrganizationId: organizationId,
          OrganizationName: "Teams Organization",
          RisksSubscriptionFailure: true,
        }),
      );
      await paymentMethodWarningsService.update(organizationId);
      expect(await firstValueFrom(paymentMethodWarningsService.paymentMethodWarnings$)).toEqual({
        [organizationId]: {
          organizationName: "Teams Organization",
          risksSubscriptionFailure: true,
          acknowledged: false,
          savedAt: any(),
        },
      });
      expect(billingApiService.getBillingStatus).toHaveBeenCalledTimes(1);
    });
  });
});

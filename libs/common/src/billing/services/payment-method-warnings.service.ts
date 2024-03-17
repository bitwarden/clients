import { firstValueFrom, map, Observable } from "rxjs";

import { ActiveUserState, StateProvider } from "../../platform/state";
import { BillingApiServiceAbstraction as BillingApiService } from "../abstractions/billilng-api.service.abstraction";
import { PaymentMethodWarningsServiceAbstraction } from "../abstractions/payment-method-warnings-service.abstraction";
import { PAYMENT_METHOD_WARNINGS_KEY } from "../models/billing-keys.state";
import { PaymentMethodWarning } from "../models/domain/payment-method-warning";

export class PaymentMethodWarningsService implements PaymentMethodWarningsServiceAbstraction {
  private paymentMethodWarningsState: ActiveUserState<Record<string, PaymentMethodWarning>>;
  paymentMethodWarnings$: Observable<Record<string, PaymentMethodWarning>>;

  constructor(
    private billingApiService: BillingApiService,
    private stateProvider: StateProvider,
  ) {
    this.paymentMethodWarningsState = this.stateProvider.getActive(PAYMENT_METHOD_WARNINGS_KEY);
    this.paymentMethodWarnings$ = this.paymentMethodWarningsState.state$;
  }

  async acknowledge(organizationId: string): Promise<void> {
    await this.paymentMethodWarningsState.update((state) => {
      const current = state[organizationId];
      state[organizationId] = {
        ...current,
        acknowledged: true,
      };
      return state;
    });
  }

  async removeSubscriptionRisk(organizationId: string): Promise<void> {
    await this.paymentMethodWarningsState.update((state) => {
      const current = state[organizationId];
      state[organizationId] = {
        ...current,
        risksSubscriptionFailure: false,
      };
      return state;
    });
  }

  async clear(): Promise<void> {
    await this.paymentMethodWarningsState.update(() => ({}));
  }

  async update(organizationId: string): Promise<void> {
    const warning = await firstValueFrom(
      this.paymentMethodWarningsState.state$.pipe(
        map((state) => (!state ? null : state[organizationId])),
      ),
    );
    if (!warning || warning.savedAt < this.getOneWeekAgo()) {
      const { organizationName, risksSubscriptionFailure } =
        await this.billingApiService.getBillingStatus(organizationId);
      await this.paymentMethodWarningsState.update((state) => {
        state ??= {};
        state[organizationId] = {
          organizationName,
          risksSubscriptionFailure,
          acknowledged: false,
          savedAt: new Date(),
        };
        return state;
      });
    }
  }

  private getOneWeekAgo = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  };
}

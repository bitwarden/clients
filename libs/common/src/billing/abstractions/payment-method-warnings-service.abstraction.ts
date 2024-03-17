import { Observable } from "rxjs";

import { PaymentMethodWarning } from "../models/domain/payment-method-warning";

export abstract class PaymentMethodWarningsServiceAbstraction {
  /**
   * An {@link Observable} record in the {@link ActiveUserState} of the user's organization IDs each mapped to their respective {@link PaymentMethodWarning}.
   */
  paymentMethodWarnings$: Observable<Record<string, PaymentMethodWarning>>;
  /**
   * Updates the {@link ActiveUserState} by setting `acknowledged` to `true` for the {@link PaymentMethodWarning} represented by the provided organization ID.
   * @param organizationId - The ID of the organization whose warning you'd like to acknowledge.
   */
  acknowledge: (organizationId: string) => Promise<void>;
  /**
   * Updates the {@link ActiveUserState} by setting `risksSubscriptionFailure` to `false` for the {@link PaymentMethodWarning} represented by the provided organization ID.
   * @param organizationId - The ID of the organization whose subscription risk you'd like to remove.
   */
  removeSubscriptionRisk: (organizationId: string) => Promise<void>;
  /**
   * Clears the {@link PaymentMethodWarning} record from the {@link ActiveUserState}.
   */
  clear: () => Promise<void>;
  /**
   * Tries to retrieve the {@link PaymentMethodWarning} for the provided organization ID from the {@link ActiveUserState}.
   * If the warning does not exist, or if the warning has been in state for longer than a week, fetches the current {@link OrganizationBillingStatusResponse} for the organization
   * from the API and uses it to update the warning in state.
   * @param organizationId - The ID of the organization whose {@link PaymentMethodWarning} you'd like to update.
   */
  update: (organizationId: string) => Promise<void>;
}

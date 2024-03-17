import { Observable } from "rxjs";

export type BillingAccountProfile = {
  hasPremiumPersonally: boolean;
  hasPremiumFromAnyOrganization: boolean;
};

export abstract class BillingAccountProfileStateService {
  /**
   * Emits `true` when the active user's account has been granted premium from any of the
   * organizations it is a member of. Otherwise, emits `false`
   */
  hasPremiumFromAnyOrganization$: Observable<boolean>;

  /**
   * Emits `true` when the active user's account has an active premium subscription at the
   * individual user level
   */
  hasPremiumPersonally$: Observable<boolean>;

  /**
   * Emits `true` when either `hasPremiumPersonally` or `hasPremiumFromAnyOrganization` is `true`
   */
  hasPremiumFromAnySource$: Observable<boolean>;

  /**
   * Sets the active user's premium status fields upon every full sync, either from their personal
   * subscription to premium, or an organization they're a part of that grants them premium.
   * @param hasPremiumPersonally
   * @param hasPremiumFromAnyOrganization
   */
  abstract setHasPremium(
    hasPremiumPersonally: boolean,
    hasPremiumFromAnyOrganization: boolean,
  ): Promise<void>;
}

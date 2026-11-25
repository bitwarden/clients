import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { UserId } from "../../types/guid";
import { RestrictedItemTypesService } from "../../vault/services/restricted-item-types.service";

import { AutofillSettingsService } from "./autofill-settings.service";

describe("AutofillSettingsService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let configService: MockProxy<ConfigService>;
  let featureFlag$: BehaviorSubject<boolean>;
  let autofillSettingsService: AutofillSettingsService;

  const collectEmissions = (observable$: Observable<boolean>) => {
    const emissions: boolean[] = [];
    const subscription = observable$.subscribe((value) => emissions.push(value));
    return { emissions, subscription };
  };

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    featureFlag$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.EnableBasicAuthResponse)
      .mockReturnValue(featureFlag$);

    autofillSettingsService = new AutofillSettingsService(
      stateProvider,
      mock<PolicyService>(),
      accountService,
      mock<RestrictedItemTypesService>(),
      configService,
    );
  });

  describe("httpAuthenticationAvailable$", () => {
    it("emits true when there is an active user and the feature flag is on", async () => {
      await expect(
        firstValueFrom(autofillSettingsService.httpAuthenticationAvailable$),
      ).resolves.toBe(true);
    });

    it("emits false when the feature flag is off", async () => {
      featureFlag$.next(false);

      await expect(
        firstValueFrom(autofillSettingsService.httpAuthenticationAvailable$),
      ).resolves.toBe(false);
    });

    it("emits false when there is no active user", async () => {
      await accountService.switchAccount(null);

      await expect(
        firstValueFrom(autofillSettingsService.httpAuthenticationAvailable$),
      ).resolves.toBe(false);
    });

    it("follows a change of active user", async () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.httpAuthenticationAvailable$,
      );

      await accountService.switchAccount(null);
      await accountService.switchAccount(otherUserId);

      expect(emissions).toEqual([true, false, true]);
      subscription.unsubscribe();
    });

    it("updates when the feature flag changes", () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.httpAuthenticationAvailable$,
      );

      featureFlag$.next(false);
      featureFlag$.next(true);

      expect(emissions).toEqual([true, false, true]);
      subscription.unsubscribe();
    });

    it("does not re-emit an unchanged value", async () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.httpAuthenticationAvailable$,
      );

      featureFlag$.next(true);
      await accountService.switchAccount(otherUserId);

      expect(emissions).toEqual([true]);
      subscription.unsubscribe();
    });
  });
});

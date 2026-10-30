import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, Subject } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { SingleUserState } from "../../platform/state";
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
  let enableBasicAuthResponseByUser: Map<UserId, Observable<boolean | null>>;
  let autofillSettingsService: AutofillSettingsService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    featureFlag$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.EnableBasicAuthResponse)
      .mockReturnValue(featureFlag$);

    // Only the resolved basic auth response state reads single-user state, so
    // each user's stored setting is supplied here as its own stream.
    enableBasicAuthResponseByUser = new Map<UserId, Observable<boolean | null>>([
      [userId, new BehaviorSubject<boolean | null>(true)],
      [otherUserId, new BehaviorSubject<boolean | null>(false)],
    ]);
    jest
      .spyOn(stateProvider, "getUser")
      .mockImplementation(
        (requestedUserId: UserId) =>
          ({ state$: enableBasicAuthResponseByUser.get(requestedUserId) }) as SingleUserState<any>,
      );

    autofillSettingsService = new AutofillSettingsService(
      stateProvider,
      mock<PolicyService>(),
      accountService,
      mock<RestrictedItemTypesService>(),
      configService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resolvedEnableBasicAuthResponse$", () => {
    const collectEmissions = (observable$: Observable<boolean>) => {
      const emissions: boolean[] = [];
      const subscription = observable$.subscribe((value) => emissions.push(value));
      return { emissions, subscription };
    };

    it("emits true when the feature flag and the user setting are both enabled", async () => {
      await expect(
        firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$),
      ).resolves.toBe(true);
    });

    it("emits false when the feature flag is disabled", async () => {
      featureFlag$.next(false);

      await expect(
        firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$),
      ).resolves.toBe(false);
    });

    it("emits false when the user setting is disabled", async () => {
      enableBasicAuthResponseByUser.set(userId, new BehaviorSubject<boolean | null>(false));

      await expect(
        firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$),
      ).resolves.toBe(false);
    });

    it("treats a user setting that was never set as disabled", async () => {
      enableBasicAuthResponseByUser.set(userId, new BehaviorSubject<boolean | null>(null));

      await expect(
        firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$),
      ).resolves.toBe(false);
    });

    it("emits false when there is no active user", async () => {
      await accountService.switchAccount(null);

      await expect(
        firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$),
      ).resolves.toBe(false);
    });

    it("reads the basic auth response setting of the active user", async () => {
      await firstValueFrom(autofillSettingsService.resolvedEnableBasicAuthResponse$);

      expect(stateProvider.getUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ key: "enableBasicAuthResponse" }),
      );
    });

    it("follows a change of active user", async () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.resolvedEnableBasicAuthResponse$,
      );

      await accountService.switchAccount(otherUserId);

      expect(emissions).toEqual([true, false]);
      subscription.unsubscribe();
    });

    it("updates when the feature flag changes", () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.resolvedEnableBasicAuthResponse$,
      );

      featureFlag$.next(false);
      featureFlag$.next(true);

      expect(emissions).toEqual([true, false, true]);
      subscription.unsubscribe();
    });

    it("does not re-emit an unchanged resolved value", () => {
      const { emissions, subscription } = collectEmissions(
        autofillSettingsService.resolvedEnableBasicAuthResponse$,
      );

      featureFlag$.next(true);

      expect(emissions).toEqual([true]);
      subscription.unsubscribe();
    });

    it("does not give a new subscriber the previous user's value before the active user's setting is read", async () => {
      // Stands in for a newly active user whose setting is still being read from storage.
      const pendingOtherUserSetting$ = new Subject<boolean | null>();
      enableBasicAuthResponseByUser.set(otherUserId, pendingOtherUserSetting$);
      // A long-lived subscriber, as the background holds, keeps any shared state alive.
      const longLived = collectEmissions(autofillSettingsService.resolvedEnableBasicAuthResponse$);
      expect(longLived.emissions).toEqual([true]);

      await accountService.switchAccount(otherUserId);
      const newSubscriber = collectEmissions(
        autofillSettingsService.resolvedEnableBasicAuthResponse$,
      );

      expect(newSubscriber.emissions).toEqual([]);

      pendingOtherUserSetting$.next(false);

      expect(newSubscriber.emissions).toEqual([false]);
      longLived.subscription.unsubscribe();
      newSubscriber.subscription.unsubscribe();
    });
  });
});

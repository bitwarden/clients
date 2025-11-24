import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import {
  ObservableTracker,
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { AccountInfo } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { UserNotLoggedInError } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

import { DefaultRegisterSdkService } from "./register-sdk.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    // Simulate successful WASM load
    return Promise.resolve();
  }
}

describe("DefaultRegisterSdkService", () => {
  describe("userClient$", () => {
    let sdkClientFactory!: MockProxy<SdkClientFactory>;
    let environmentService!: MockProxy<EnvironmentService>;
    let platformUtilsService!: MockProxy<PlatformUtilsService>;
    let configService!: MockProxy<ConfigService>;
    let service!: DefaultRegisterSdkService;
    let accountService!: FakeAccountService;
    let fakeStateProvider!: FakeStateProvider;
    let apiService!: MockProxy<ApiService>;

    beforeEach(async () => {
      await new TestSdkLoadService().loadAndInit();

      sdkClientFactory = mock<SdkClientFactory>();
      environmentService = mock<EnvironmentService>();
      platformUtilsService = mock<PlatformUtilsService>();
      apiService = mock<ApiService>();
      const mockUserId = Utils.newGuid() as UserId;
      accountService = mockAccountServiceWith(mockUserId);
      fakeStateProvider = new FakeStateProvider(accountService);
      configService = mock<ConfigService>();

      configService.serverConfig$ = new BehaviorSubject(null);

      // Can't use `of(mock<Environment>())` for some reason
      environmentService.environment$ = new BehaviorSubject(mock<Environment>());

      service = new DefaultRegisterSdkService(
        sdkClientFactory,
        environmentService,
        platformUtilsService,
        accountService,
        apiService,
        fakeStateProvider,
        configService,
      );
    });

    describe("given the user is logged in", () => {
      const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;
      beforeEach(() => {
        environmentService.getEnvironment$
          .calledWith(userId)
          .mockReturnValue(new BehaviorSubject(mock<Environment>()));
        accountService.accounts$ = of({
          [userId]: { email: "email", emailVerified: true, name: "name" } as AccountInfo,
        });
      });

      let mockClient!: MockProxy<BitwardenClient>;

      beforeEach(() => {
        mockClient = createMockClient();
        sdkClientFactory.createSdkClient.mockResolvedValue(mockClient);
      });

      it("creates an internal SDK client when called the first time", async () => {
        await firstValueFrom(service.userClient$(userId));

        expect(sdkClientFactory.createSdkClient).toHaveBeenCalled();
      });

      it("does not create an SDK client when called the second time with same userId", async () => {
        const subject_1 = new BehaviorSubject<Rc<BitwardenClient> | undefined>(undefined);
        const subject_2 = new BehaviorSubject<Rc<BitwardenClient> | undefined>(undefined);

        // Use subjects to ensure the subscription is kept alive
        service.userClient$(userId).subscribe(subject_1);
        service.userClient$(userId).subscribe(subject_2);

        // Wait for the next tick to ensure all async operations are done
        await new Promise(process.nextTick);

        expect(subject_1.value.take().value).toBe(mockClient);
        expect(subject_2.value.take().value).toBe(mockClient);
        expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
      });

      it("destroys the internal SDK client when all subscriptions are closed", async () => {
        const subject_1 = new BehaviorSubject<Rc<BitwardenClient> | undefined>(undefined);
        const subject_2 = new BehaviorSubject<Rc<BitwardenClient> | undefined>(undefined);
        const subscription_1 = service.userClient$(userId).subscribe(subject_1);
        const subscription_2 = service.userClient$(userId).subscribe(subject_2);
        await new Promise(process.nextTick);

        subscription_1.unsubscribe();
        subscription_2.unsubscribe();

        await new Promise(process.nextTick);
        expect(mockClient.free).toHaveBeenCalledTimes(1);
      });

      it("destroys the internal SDK client when the account is removed (logout)", async () => {
        const accounts$ = new BehaviorSubject({
          [userId]: { email: "email", emailVerified: true, name: "name" } as AccountInfo,
        });
        accountService.accounts$ = accounts$;

        const userClientTracker = new ObservableTracker(service.userClient$(userId), false);
        await userClientTracker.pauseUntilReceived(1);

        accounts$.next({});
        await userClientTracker.expectCompletion();

        expect(mockClient.free).toHaveBeenCalledTimes(1);
      });
    });

    describe("given the user is not logged in", () => {
      const userId = "0da62ebd-98bb-4f42-a846-64e8555087d7" as UserId;

      beforeEach(() => {
        environmentService.getEnvironment$
          .calledWith(userId)
          .mockReturnValue(new BehaviorSubject(mock<Environment>()));
        accountService.accounts$ = of({});
      });

      it("throws UserNotLoggedInError when user has no account", async () => {
        const result = () => firstValueFrom(service.userClient$(userId));

        await expect(result).rejects.toThrow(UserNotLoggedInError);
      });
    });
  });
});

function createMockClient(): MockProxy<BitwardenClient> {
  const client = mock<BitwardenClient>();
  client.platform.mockReturnValue({
    state: jest.fn().mockReturnValue(mock()),
    load_flags: jest.fn().mockReturnValue(mock()),
    free: mock(),
    [Symbol.dispose]: jest.fn(),
  });
  return client;
}

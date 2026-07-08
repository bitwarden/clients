import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AppIdService } from "../../platform/abstractions/app-id.service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { ActiveUserState, StateProvider } from "../../platform/state";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";

import { DeviceSettingsServiceImplementation } from "./device-settings.service.implementation";

describe("DeviceSettingsServiceImplementation", () => {
  let service: DeviceSettingsServiceImplementation;
  let stateProvider: MockProxy<StateProvider>;
  let devicesApiService: MockProxy<DevicesApiServiceAbstraction>;
  let appIdService: MockProxy<AppIdService>;
  let configService: MockProxy<ConfigService>;

  let stateSubject: BehaviorSubject<boolean | null>;
  let betaFlag$: BehaviorSubject<boolean>;
  let updateMock: jest.Mock;

  beforeEach(() => {
    stateProvider = mock<StateProvider>();
    devicesApiService = mock<DevicesApiServiceAbstraction>();
    appIdService = mock<AppIdService>();
    configService = mock<ConfigService>();
    appIdService.getAppId.mockResolvedValue("app-id-123");

    betaFlag$ = new BehaviorSubject<boolean>(true);
    configService.getFeatureFlag$.mockReturnValue(betaFlag$ as any);

    stateSubject = new BehaviorSubject<boolean | null>(null);
    updateMock = jest.fn(async (configureState: (current: boolean | null) => boolean) => {
      const next = configureState(stateSubject.value);
      stateSubject.next(next);
      return next;
    });
    stateProvider.getActive.mockReturnValue({
      state$: stateSubject,
      update: updateMock,
    } as unknown as ActiveUserState<boolean>);

    service = new DeviceSettingsServiceImplementation(
      stateProvider,
      devicesApiService,
      appIdService,
      configService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("newUiBetaEnabled$", () => {
    it("reflects the feature flag", async () => {
      expect(await firstValueFrom(service.newUiBetaEnabled$)).toBe(true);

      betaFlag$.next(false);
      expect(await firstValueFrom(service.newUiBetaEnabled$)).toBe(false);
    });
  });

  describe("useNewUi$", () => {
    it("defaults to false when state is unset", async () => {
      expect(await firstValueFrom(service.useNewUi$)).toBe(false);
    });

    it("reflects the cached state value when the beta flag is on", async () => {
      stateSubject.next(true);
      expect(await firstValueFrom(service.useNewUi$)).toBe(true);
    });

    it("is forced to false when the beta flag is off, even if the device opted in", async () => {
      stateSubject.next(true);
      betaFlag$.next(false);

      expect(await firstValueFrom(service.useNewUi$)).toBe(false);
    });
  });

  describe("setUseNewUi", () => {
    it("persists to the server and updates cached state", async () => {
      devicesApiService.updateDeviceSettings.mockResolvedValue({ useNewUi: true } as any);

      await service.setUseNewUi(true);

      expect(devicesApiService.updateDeviceSettings).toHaveBeenCalledWith(
        "app-id-123",
        expect.objectContaining({ useNewUi: true }),
      );
      expect(await firstValueFrom(service.useNewUi$)).toBe(true);
    });
  });

  describe("refreshFromServer", () => {
    it("loads the current device value into cached state", async () => {
      devicesApiService.getDeviceByIdentifier.mockResolvedValue({ useNewUi: true } as any);

      await service.refreshFromServer();

      expect(devicesApiService.getDeviceByIdentifier).toHaveBeenCalledWith("app-id-123");
      expect(await firstValueFrom(service.useNewUi$)).toBe(true);
    });
  });
});

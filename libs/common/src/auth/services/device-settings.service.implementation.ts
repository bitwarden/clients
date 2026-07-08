import { combineLatest, map, Observable } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import {
  ActiveUserState,
  DEVICE_SETTINGS_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { DeviceSettingsServiceAbstraction } from "../abstractions/device-settings.service.abstraction";
import { DevicesApiServiceAbstraction } from "../abstractions/devices-api.service.abstraction";

import { DeviceSettingsRequest } from "./devices/requests/device-settings.request";

const USE_NEW_UI = new UserKeyDefinition<boolean>(DEVICE_SETTINGS_DISK, "useNewUi", {
  deserializer: (value) => value ?? false,
  clearOn: ["logout"],
});

export class DeviceSettingsServiceImplementation implements DeviceSettingsServiceAbstraction {
  private useNewUiState: ActiveUserState<boolean>;
  newUiBetaEnabled$: Observable<boolean>;
  useNewUi$: Observable<boolean>;

  constructor(
    private stateProvider: StateProvider,
    private devicesApiService: DevicesApiServiceAbstraction,
    private appIdService: AppIdService,
    private configService: ConfigService,
  ) {
    this.useNewUiState = this.stateProvider.getActive(USE_NEW_UI);
    this.newUiBetaEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.NewUiBetaSwitch);

    // The new UI is gated behind the beta flag: when it is off, useNewUi$ is forced to false
    // regardless of the stored per-device value (which is preserved for when the flag flips on).
    this.useNewUi$ = combineLatest([this.newUiBetaEnabled$, this.useNewUiState.state$]).pipe(
      map(([betaEnabled, useNewUi]) => (betaEnabled ? (useNewUi ?? false) : false)),
    );
  }

  async setUseNewUi(useNewUi: boolean): Promise<void> {
    const deviceIdentifier = await this.appIdService.getAppId();
    await this.devicesApiService.updateDeviceSettings(
      deviceIdentifier,
      new DeviceSettingsRequest(useNewUi),
    );
    await this.useNewUiState.update(() => useNewUi);
  }

  async refreshFromServer(): Promise<void> {
    const deviceIdentifier = await this.appIdService.getAppId();
    const device = await this.devicesApiService.getDeviceByIdentifier(deviceIdentifier);
    await this.useNewUiState.update(() => device.useNewUi);
  }
}

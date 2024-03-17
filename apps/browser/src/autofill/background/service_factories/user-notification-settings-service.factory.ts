import { UserNotificationSettingsService } from "@bitwarden/common/autofill/services/user-notification-settings.service";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

export type UserNotificationSettingsServiceInitOptions = FactoryOptions & StateProviderInitOptions;

export function userNotificationSettingsServiceFactory(
  cache: { userNotificationSettingsService?: UserNotificationSettingsService } & CachedServices,
  opts: UserNotificationSettingsServiceInitOptions,
): Promise<UserNotificationSettingsService> {
  return factory(
    cache,
    "userNotificationSettingsService",
    opts,
    async () => new UserNotificationSettingsService(await stateProviderFactory(cache, opts)),
  );
}

import {
  TotpServiceInitOptions,
  totpServiceFactory,
} from "../../../auth/background/service-factories/totp-service.factory";
import {
  UserVerificationServiceInitOptions,
  userVerificationServiceFactory,
} from "../../../auth/background/service-factories/user-verification-service.factory";
import {
  EventCollectionServiceInitOptions,
  eventCollectionServiceFactory,
} from "../../../background/service-factories/event-collection-service.factory";
import {
  settingsServiceFactory,
  SettingsServiceInitOptions,
} from "../../../background/service-factories/settings-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";
import {
  cipherServiceFactory,
  CipherServiceInitOptions,
} from "../../../vault/background/service_factories/cipher-service.factory";
import { AutofillService as AbstractAutoFillService } from "../../services/abstractions/autofill.service";
import AutofillService from "../../services/autofill.service";

type AutoFillServiceOptions = FactoryOptions;

export type AutoFillServiceInitOptions = AutoFillServiceOptions &
  CipherServiceInitOptions &
  StateServiceInitOptions &
  TotpServiceInitOptions &
  EventCollectionServiceInitOptions &
  LogServiceInitOptions &
  SettingsServiceInitOptions &
  UserVerificationServiceInitOptions;

export function autofillServiceFactory(
  cache: { autofillService?: AbstractAutoFillService } & CachedServices,
  opts: AutoFillServiceInitOptions
): Promise<AbstractAutoFillService> {
  return factory(
    cache,
    "autofillService",
    opts,
    async () =>
      new AutofillService(
        await cipherServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await totpServiceFactory(cache, opts),
        await eventCollectionServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        await settingsServiceFactory(cache, opts),
        await userVerificationServiceFactory(cache, opts)
      )
  );
}

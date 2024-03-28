import { SendService } from "@bitwarden/common/tools/send/services/send.service";
import { InternalSendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import {
  AccountServiceInitOptions,
  accountServiceFactory,
} from "../../auth/background/service-factories/account-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../platform/background/service-factories/crypto-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../platform/background/service-factories/i18n-service.factory";
import {
  KeyGenerationServiceInitOptions,
  keyGenerationServiceFactory,
} from "../../platform/background/service-factories/key-generation-service.factory";
import { StateProviderInitOptions } from "../../platform/background/service-factories/state-provider.factory";

import { sendStateProviderFactory } from "./send-state-provider.factory";

type SendServiceFactoryOptions = FactoryOptions;

export type SendServiceInitOptions = SendServiceFactoryOptions &
  CryptoServiceInitOptions &
  I18nServiceInitOptions &
  KeyGenerationServiceInitOptions &
  StateProviderInitOptions &
  AccountServiceInitOptions;

export function sendServiceFactory(
  cache: { sendService?: InternalSendService } & CachedServices,
  opts: SendServiceInitOptions,
): Promise<InternalSendService> {
  return factory(
    cache,
    "sendService",
    opts,
    async () =>
      new SendService(
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await keyGenerationServiceFactory(cache, opts),
        await sendStateProviderFactory(cache, opts),
        await accountServiceFactory(cache, opts),
      ),
  );
}

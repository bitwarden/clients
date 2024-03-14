import { CipherService as AbstractCipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";

import {
  AutofillSettingsServiceInitOptions,
  autofillSettingsServiceFactory,
} from "../../../autofill/background/service_factories/autofill-settings-service.factory";
import {
  DomainSettingsServiceInitOptions,
  domainSettingsServiceFactory,
} from "../../../autofill/background/service_factories/domain-settings-service.factory";
import {
  CipherFileUploadServiceInitOptions,
  cipherFileUploadServiceFactory,
} from "../../../background/service-factories/cipher-file-upload-service.factory";
import {
  searchServiceFactory,
  SearchServiceInitOptions,
} from "../../../background/service-factories/search-service.factory";
import {
  apiServiceFactory,
  ApiServiceInitOptions,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  configServiceFactory,
  ConfigServiceInitOptions,
} from "../../../platform/background/service-factories/config-service.factory";
import {
  cryptoServiceFactory,
  CryptoServiceInitOptions,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  EncryptServiceInitOptions,
  encryptServiceFactory,
} from "../../../platform/background/service-factories/encrypt-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../../platform/background/service-factories/i18n-service.factory";
import { stateProviderFactory } from "../../../platform/background/service-factories/state-provider.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";

type CipherServiceFactoryOptions = FactoryOptions;

export type CipherServiceInitOptions = CipherServiceFactoryOptions &
  CryptoServiceInitOptions &
  ApiServiceInitOptions &
  CipherFileUploadServiceInitOptions &
  I18nServiceInitOptions &
  SearchServiceInitOptions &
  StateServiceInitOptions &
  AutofillSettingsServiceInitOptions &
  DomainSettingsServiceInitOptions &
  EncryptServiceInitOptions &
  ConfigServiceInitOptions;

export function cipherServiceFactory(
  cache: { cipherService?: AbstractCipherService } & CachedServices,
  opts: CipherServiceInitOptions,
): Promise<AbstractCipherService> {
  return factory(
    cache,
    "cipherService",
    opts,
    async () =>
      new CipherService(
        await cryptoServiceFactory(cache, opts),
        await domainSettingsServiceFactory(cache, opts),
        await apiServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await searchServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await autofillSettingsServiceFactory(cache, opts),
        await encryptServiceFactory(cache, opts),
        await cipherFileUploadServiceFactory(cache, opts),
        await configServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}

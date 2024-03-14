import { FolderService as AbstractFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";

import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

import { cipherServiceFactory, CipherServiceInitOptions } from "./cipher-service.factory";

type FolderServiceFactoryOptions = FactoryOptions;

export type FolderServiceInitOptions = FolderServiceFactoryOptions &
  CryptoServiceInitOptions &
  CipherServiceInitOptions &
  I18nServiceInitOptions &
  StateProviderInitOptions;

export function folderServiceFactory(
  cache: { folderService?: AbstractFolderService } & CachedServices,
  opts: FolderServiceInitOptions,
): Promise<AbstractFolderService> {
  return factory(
    cache,
    "folderService",
    opts,
    async () =>
      new FolderService(
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await cipherServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}

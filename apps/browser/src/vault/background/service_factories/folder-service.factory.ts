import { FolderService as AbstractFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

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
  stateServiceFactory as stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";
import { BackgroundFolderService } from "../services/background-folder.service";

import { cipherServiceFactory, CipherServiceInitOptions } from "./cipher-service.factory";

type FolderServiceFactoryOptions = FactoryOptions;

export type FolderServiceInitOptions = FolderServiceFactoryOptions &
  CryptoServiceInitOptions &
  CipherServiceInitOptions &
  I18nServiceInitOptions &
  StateServiceInitOptions;

export function folderServiceFactory(
  cache: { folderService?: AbstractFolderService } & CachedServices,
  opts: FolderServiceInitOptions
): Promise<AbstractFolderService> {
  return factory(
    cache,
    "folderService",
    opts,
    async () =>
      new BackgroundFolderService(
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await cipherServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts)
      )
  );
}

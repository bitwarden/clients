// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { safeProvider, SafeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { LOG_PROVIDER } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeyServiceLegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/key-service-legacy-encryptor-provider";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "@bitwarden/common/tools/extension/extension-registry.abstraction";
import { buildExtensionRegistry } from "@bitwarden/common/tools/extension/factory";
import { disabledSemanticLoggerProvider, enableLogForTypes } from "@bitwarden/common/tools/log";
import { DefaultEnvService, EnvService } from "@bitwarden/common/tools/providers";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KeyService } from "@bitwarden/key-management";

import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "../services";

/** Import service factories */
export const ImporterProviders: SafeProvider[] = [
  safeProvider({
    provide: ImportApiServiceAbstraction,
    useClass: ImportApiService,
    deps: [ApiService],
  }),
  safeProvider({
    provide: LegacyEncryptorProvider,
    useClass: KeyServiceLegacyEncryptorProvider,
    deps: [EncryptService, KeyService],
  }),
  safeProvider({
    provide: ExtensionRegistry,
    useFactory: () => {
      return buildExtensionRegistry();
    },
    deps: [],
  }),
  safeProvider({
    provide: EnvService,
    useClass: DefaultEnvService,
    deps: [ConfigService, PlatformUtilsService],
  }),
  safeProvider({
    provide: LOG_PROVIDER,
    useFactory: (logger: LogService, env: EnvService) => {
      if (env.isDev()) {
        return enableLogForTypes(logger, []);
      } else {
        return disabledSemanticLoggerProvider;
      }
    },
    deps: [LogService, EnvService],
  }),
  safeProvider({
    provide: ImportServiceAbstraction,
    useClass: ImportService,
    deps: [
      CipherService,
      FolderService,
      ImportApiServiceAbstraction,
      I18nService,
      CollectionService,
      KeyService,
      EncryptService,
      PinServiceAbstraction,
      AccountService,
      RestrictedItemTypesService,
      EnvService,
      LOG_PROVIDER,
    ],
  }),
];

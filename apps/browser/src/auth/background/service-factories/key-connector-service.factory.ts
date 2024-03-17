import { KeyConnectorService as AbstractKeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { KeyConnectorService } from "@bitwarden/common/auth/services/key-connector.service";

import {
  OrganizationServiceInitOptions,
  organizationServiceFactory,
} from "../../../admin-console/background/service-factories/organization-service.factory";
import {
  apiServiceFactory,
  ApiServiceInitOptions,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  KeyGenerationServiceInitOptions,
  keyGenerationServiceFactory,
} from "../../../platform/background/service-factories/key-generation-service.factory";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";

import { TokenServiceInitOptions, tokenServiceFactory } from "./token-service.factory";

type KeyConnectorServiceFactoryOptions = FactoryOptions & {
  keyConnectorServiceOptions: {
    logoutCallback: (expired: boolean, userId?: string) => Promise<void>;
  };
};

export type KeyConnectorServiceInitOptions = KeyConnectorServiceFactoryOptions &
  StateServiceInitOptions &
  CryptoServiceInitOptions &
  ApiServiceInitOptions &
  TokenServiceInitOptions &
  LogServiceInitOptions &
  OrganizationServiceInitOptions &
  KeyGenerationServiceInitOptions;

export function keyConnectorServiceFactory(
  cache: { keyConnectorService?: AbstractKeyConnectorService } & CachedServices,
  opts: KeyConnectorServiceInitOptions,
): Promise<AbstractKeyConnectorService> {
  return factory(
    cache,
    "keyConnectorService",
    opts,
    async () =>
      new KeyConnectorService(
        await stateServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await apiServiceFactory(cache, opts),
        await tokenServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        await organizationServiceFactory(cache, opts),
        await keyGenerationServiceFactory(cache, opts),
        opts.keyConnectorServiceOptions.logoutCallback,
      ),
  );
}

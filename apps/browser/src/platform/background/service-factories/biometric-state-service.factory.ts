import {
  BiometricStateService,
  DefaultBiometricStateService,
} from "@bitwarden/common/platform/biometrics/biometric-state.service";

import { FactoryOptions, CachedServices, factory } from "./factory-options";
import { StateProviderInitOptions, stateProviderFactory } from "./state-provider.factory";

type BiometricStateServiceFactoryOptions = FactoryOptions;

export type BiometricStateServiceInitOptions = BiometricStateServiceFactoryOptions &
  StateProviderInitOptions;

export function biometricStateServiceFactory(
  cache: { biometricStateService?: BiometricStateService } & CachedServices,
  opts: BiometricStateServiceInitOptions,
): Promise<BiometricStateService> {
  return factory(
    cache,
    "biometricStateService",
    opts,
    async () => new DefaultBiometricStateService(await stateProviderFactory(cache, opts)),
  );
}

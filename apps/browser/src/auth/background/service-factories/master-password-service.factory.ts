import {
  InternalMasterPasswordServiceAbstraction,
  MasterPasswordServiceAbstraction,
} from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { MasterPasswordService } from "@bitwarden/common/auth/services/master-password/master-password.service";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

type MasterPasswordServiceFactoryOptions = FactoryOptions;

export type MasterPasswordServiceInitOptions = MasterPasswordServiceFactoryOptions &
  StateProviderInitOptions;

export function internalMasterPasswordServiceFactory(
  cache: { masterPasswordService?: InternalMasterPasswordServiceAbstraction } & CachedServices,
  opts: MasterPasswordServiceInitOptions,
): Promise<InternalMasterPasswordServiceAbstraction> {
  return factory(
    cache,
    "masterPasswordService",
    opts,
    async () => new MasterPasswordService(await stateProviderFactory(cache, opts)),
  );
}

export async function masterPasswordServiceFactory(
  cache: { masterPasswordService?: InternalMasterPasswordServiceAbstraction } & CachedServices,
  opts: MasterPasswordServiceInitOptions,
): Promise<MasterPasswordServiceAbstraction> {
  return (await internalMasterPasswordServiceFactory(
    cache,
    opts,
  )) as MasterPasswordServiceAbstraction;
}

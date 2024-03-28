import { SendStateProvider } from "@bitwarden/common/tools/send/services/send-state.provider";

import {
  CachedServices,
  FactoryOptions,
  factory,
} from "../../platform/background/service-factories/factory-options";
import {
  StateProviderInitOptions,
  stateProviderFactory,
} from "../../platform/background/service-factories/state-provider.factory";

type SendStateProviderFactoryOptions = FactoryOptions;

export type SendStateProviderInitOptions = SendStateProviderFactoryOptions &
  StateProviderInitOptions;

export function sendStateProviderFactory(
  cache: { sendStateProvider?: SendStateProvider } & CachedServices,
  opts: SendStateProviderInitOptions,
): Promise<SendStateProvider> {
  return factory(
    cache,
    "sendStateProvider",
    opts,
    async () => new SendStateProvider(await stateProviderFactory(cache, opts)),
  );
}

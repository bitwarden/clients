import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BackgroundPlatformUtilsService } from "../../services/platform-utils/background-platform-utils.service";

import { CachedServices, factory, FactoryOptions } from "./factory-options";
import { MessagingServiceInitOptions, messagingServiceFactory } from "./messaging-service.factory";

type PlatformUtilsServiceFactoryOptions = FactoryOptions & {
  platformUtilsServiceOptions: {
    clipboardWriteCallback: (clipboardValue: string, clearMs: number) => Promise<void>;
    biometricCallback: () => Promise<boolean>;
    win: Window & typeof globalThis;
  };
};

export type PlatformUtilsServiceInitOptions = PlatformUtilsServiceFactoryOptions &
  MessagingServiceInitOptions;

export function platformUtilsServiceFactory(
  cache: { platformUtilsService?: PlatformUtilsService } & CachedServices,
  opts: PlatformUtilsServiceInitOptions,
): Promise<PlatformUtilsService> {
  return factory(
    cache,
    "platformUtilsService",
    opts,
    async () =>
      new BackgroundPlatformUtilsService(
        await messagingServiceFactory(cache, opts),
        opts.platformUtilsServiceOptions.clipboardWriteCallback,
        opts.platformUtilsServiceOptions.biometricCallback,
        opts.platformUtilsServiceOptions.win,
      ),
  );
}

import { EventUploadService as AbstractEventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";

import {
  ApiServiceInitOptions,
  apiServiceFactory,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";

type EventUploadServiceOptions = FactoryOptions;

export type EventUploadServiceInitOptions = EventUploadServiceOptions &
  ApiServiceInitOptions &
  StateServiceInitOptions &
  LogServiceInitOptions;

export function eventUploadServiceFactory(
  cache: { eventUploadService?: AbstractEventUploadService } & CachedServices,
  opts: EventUploadServiceInitOptions,
): Promise<AbstractEventUploadService> {
  return factory(
    cache,
    "eventUploadService",
    opts,
    async () =>
      new EventUploadService(
        await apiServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
      ),
  );
}

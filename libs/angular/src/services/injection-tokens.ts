import { InjectionToken } from "@angular/core";

import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";

export const WINDOW = new InjectionToken<Window>("WINDOW");
export const MEMORY_STORAGE = new InjectionToken<AbstractMemoryStorageService>("MEMORY_STORAGE");
export const SECURE_STORAGE = new InjectionToken<AbstractStorageService>("SECURE_STORAGE");
export const STATE_FACTORY = new InjectionToken<StateFactory>("STATE_FACTORY");
export const STATE_SERVICE_USE_CACHE = new InjectionToken<boolean>("STATE_SERVICE_USE_CACHE");
export const LOGOUT_CALLBACK = new InjectionToken<
  (expired: boolean, userId?: string) => Promise<void>
>("LOGOUT_CALLBACK");
export const LOCKED_CALLBACK = new InjectionToken<(userId?: string) => Promise<void>>(
  "LOCKED_CALLBACK"
);
export const LOCALES_DIRECTORY = new InjectionToken<string>("LOCALES_DIRECTORY");
export const SYSTEM_LANGUAGE = new InjectionToken<string>("SYSTEM_LANGUAGE");
export const LOG_MAC_FAILURES = new InjectionToken<string>("LOG_MAC_FAILURES");

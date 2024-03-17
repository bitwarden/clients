import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

import {
  AbstractMemoryStorageService,
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";

declare const tag: unique symbol;
/**
 * A (more) typesafe version of InjectionToken which will more strictly enforce the generic type parameter.
 * @remarks The default angular implementation does not use the generic type to define the structure of the object,
 * so the structural type system will not complain about a mismatch in the type parameter.
 * This is solved by assigning T to an arbitrary private property.
 */
export class SafeInjectionToken<T> extends InjectionToken<T> {
  private readonly [tag]: T;
}

export const WINDOW = new SafeInjectionToken<Window>("WINDOW");
export const OBSERVABLE_MEMORY_STORAGE = new SafeInjectionToken<
  AbstractMemoryStorageService & ObservableStorageService
>("OBSERVABLE_MEMORY_STORAGE");
export const OBSERVABLE_DISK_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_DISK_STORAGE");
export const OBSERVABLE_DISK_LOCAL_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_DISK_LOCAL_STORAGE");
export const MEMORY_STORAGE = new SafeInjectionToken<AbstractMemoryStorageService>(
  "MEMORY_STORAGE",
);
export const SECURE_STORAGE = new SafeInjectionToken<AbstractStorageService>("SECURE_STORAGE");
export const STATE_FACTORY = new SafeInjectionToken<StateFactory>("STATE_FACTORY");
export const STATE_SERVICE_USE_CACHE = new SafeInjectionToken<boolean>("STATE_SERVICE_USE_CACHE");
export const LOGOUT_CALLBACK = new SafeInjectionToken<
  (expired: boolean, userId?: string) => Promise<void>
>("LOGOUT_CALLBACK");
export const LOCKED_CALLBACK = new SafeInjectionToken<(userId?: string) => Promise<void>>(
  "LOCKED_CALLBACK",
);
export const SUPPORTS_SECURE_STORAGE = new SafeInjectionToken<boolean>("SUPPORTS_SECURE_STORAGE");
export const LOCALES_DIRECTORY = new SafeInjectionToken<string>("LOCALES_DIRECTORY");
export const SYSTEM_LANGUAGE = new SafeInjectionToken<string>("SYSTEM_LANGUAGE");
export const LOG_MAC_FAILURES = new SafeInjectionToken<boolean>("LOG_MAC_FAILURES");
export const SYSTEM_THEME_OBSERVABLE = new SafeInjectionToken<Observable<ThemeType>>(
  "SYSTEM_THEME_OBSERVABLE",
);

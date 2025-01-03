// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { InjectionToken } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/common/enums";
import { RegionConfig } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { Theme } from "@bitwarden/common/platform/enums";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Message } from "@bitwarden/common/platform/messaging";
import { VaultTimeout } from "@bitwarden/common/types/vault-timeout.type";

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
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_MEMORY_STORAGE");
export const OBSERVABLE_DISK_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_DISK_STORAGE");
export const OBSERVABLE_DISK_LOCAL_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_DISK_LOCAL_STORAGE");
export const MEMORY_STORAGE = new SafeInjectionToken<AbstractStorageService>("MEMORY_STORAGE");
export const SECURE_STORAGE = new SafeInjectionToken<AbstractStorageService>("SECURE_STORAGE");
export const STATE_FACTORY = new SafeInjectionToken<StateFactory>("STATE_FACTORY");
export const LOGOUT_CALLBACK = new SafeInjectionToken<
  (logoutReason: LogoutReason, userId?: string) => Promise<void>
>("LOGOUT_CALLBACK");
export const LOCKED_CALLBACK = new SafeInjectionToken<(userId?: string) => Promise<void>>(
  "LOCKED_CALLBACK",
);
export const LOCALES_DIRECTORY = new SafeInjectionToken<string>("LOCALES_DIRECTORY");
export const SYSTEM_LANGUAGE = new SafeInjectionToken<string>("SYSTEM_LANGUAGE");
export const LOG_MAC_FAILURES = new SafeInjectionToken<boolean>("LOG_MAC_FAILURES");
export const SYSTEM_THEME_OBSERVABLE = new SafeInjectionToken<Observable<Theme>>(
  "SYSTEM_THEME_OBSERVABLE",
);
export const DEFAULT_VAULT_TIMEOUT = new SafeInjectionToken<VaultTimeout>("DEFAULT_VAULT_TIMEOUT");
export const INTRAPROCESS_MESSAGING_SUBJECT = new SafeInjectionToken<
  Subject<Message<Record<string, unknown>>>
>("INTRAPROCESS_MESSAGING_SUBJECT");
export const CLIENT_TYPE = new SafeInjectionToken<ClientType>("CLIENT_TYPE");

export const REFRESH_ACCESS_TOKEN_ERROR_CALLBACK = new SafeInjectionToken<() => void>(
  "REFRESH_ACCESS_TOKEN_ERROR_CALLBACK",
);

/**
 * Injection token for injecting the NodeJS process.env additional regions into services.
 * Using an injection token allows services to be tested without needing to
 * mock the process.env.
 */
export const ENV_ADDITIONAL_REGIONS = new SafeInjectionToken<RegionConfig[]>(
  "ENV_ADDITIONAL_REGIONS",
);

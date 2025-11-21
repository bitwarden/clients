// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/common/enums";
import { VaultTimeout } from "@bitwarden/common/key-management/vault-timeout";
import { RegionConfig } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { Theme } from "@bitwarden/common/platform/enums";
import { Message } from "@bitwarden/common/platform/messaging";
import { HttpOperations } from "@bitwarden/common/services/api.service";
import { SafeInjectionToken } from "@bitwarden/ui-common";
// Re-export the SafeInjectionToken from ui-common
export { SafeInjectionToken } from "@bitwarden/ui-common";

export const WINDOW = new SafeInjectionToken<Window>("WINDOW");
export const DOCUMENT = new SafeInjectionToken<Document>("DOCUMENT");
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
export const LOGOUT_CALLBACK = new SafeInjectionToken<
  (logoutReason: LogoutReason, userId?: string) => Promise<void>
>("LOGOUT_CALLBACK");
export const SUPPORTS_SECURE_STORAGE = new SafeInjectionToken<boolean>("SUPPORTS_SECURE_STORAGE");
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

export const HTTP_OPERATIONS = new SafeInjectionToken<HttpOperations>("HTTP_OPERATIONS");

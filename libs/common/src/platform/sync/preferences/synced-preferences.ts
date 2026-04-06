import { VaultTimeoutAction } from "../../../key-management/vault-timeout/enums/vault-timeout-action.enum";
import { VaultTimeout } from "../../../key-management/vault-timeout/types/vault-timeout.type";
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Theme } from "../../enums/theme-type.enum";

/**
 * The encrypted blob structure stored on the server.
 * Each client reads `shared` + its own device section.
 *
 * All fields are optional for forward/backward compatibility —
 * old clients ignore unknown keys, new clients use existing defaults for missing keys.
 */
export interface SyncedPreferences {
  /** Universal settings — same value on every device */
  shared?: SharedPreferences;

  /** Per-device-type sections — each client reads/writes only its own */
  desktop?: DevicePreferences;
  browser?: BrowserPreferences;
  web?: DevicePreferences;
  mobile?: DevicePreferences;
}

/**
 * Settings shared across all devices (single source of truth).
 * Includes theme, locale, generator settings, and forwarder API keys.
 *
 * Generator and forwarder types are intentionally kept as `Record<string, unknown>`
 * here because the actual types live in `@bitwarden/generator` and importing them
 * would create a circular dependency. The static registry handles type-safe access.
 */
export interface SharedPreferences {
  theme?: Theme;
  locale?: string;
  showFavicons?: boolean;

  // Generator preferences and settings — stored as opaque JSON
  // Actual types: CredentialPreference, PasswordGenerationOptions, etc.
  credentialPreferences?: Record<string, unknown>;
  passwordGeneratorSettings?: Record<string, unknown>;
  passphraseGeneratorSettings?: Record<string, unknown>;
  effUsernameGeneratorSettings?: Record<string, unknown>;
  catchallGeneratorSettings?: Record<string, unknown>;
  subaddressGeneratorSettings?: Record<string, unknown>;

  // Forwarder secrets — stored as opaque JSON
  // Actual types: SimpleLoginSettings, AddyIoSettings, etc.
  simpleLoginForwarder?: Record<string, unknown>;
  addyIoForwarder?: Record<string, unknown>;
  duckDuckGoForwarder?: Record<string, unknown>;
  firefoxRelayForwarder?: Record<string, unknown>;
  fastmailForwarder?: Record<string, unknown>;
  forwardEmailForwarder?: Record<string, unknown>;
}

/** Settings every device type has, but with its own values */
export interface DevicePreferences {
  vaultTimeout?: VaultTimeout;
  vaultTimeoutAction?: VaultTimeoutAction;
}

/** Browser extension has additional settings beyond the base device preferences */
export interface BrowserPreferences extends DevicePreferences {
  autofillOnPageLoad?: boolean;
  autofillOnPageLoadDefault?: boolean;
  autoCopyTotp?: boolean;
  showInlineMenuIdentities?: boolean;
  showInlineMenuCards?: boolean;
  showCardsCurrentTab?: boolean;
  showIdentitiesCurrentTab?: boolean;
  clickItemsToAutofillOnVaultView?: boolean;
  defaultUriMatchStrategy?: UriMatchStrategySetting;
  enableBadgeCounter?: boolean;
  compactMode?: boolean;
  showAnimations?: boolean;
  copyButtonDisplayMode?: string;
  popupWidth?: string;
}

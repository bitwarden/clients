import { Observable } from "rxjs";
import { SemVer } from "semver";

import { DeviceType } from "../../enums";
import { ClientType } from "../../enums/client-type.enum";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ServerConfig } from "../../platform/abstractions/config/server-config";
import { Region } from "../../platform/abstractions/environment.service";
import { ServerSettings } from "../../platform/models/domain/server-settings";
import { UserId } from "../../types/guid";

/**
 * Facade for environmental awareness and configuration services.
 * Provides a unified interface for checking runtime environment capabilities,
 * feature flags, and server configuration.
 */
export abstract class EnvService {
  /* ConfigService methods */
  abstract readonly serverConfig$: Observable<ServerConfig | null>;
  abstract readonly serverSettings$: Observable<ServerSettings | null>;
  abstract readonly cloudRegion$: Observable<Region>;

  abstract getFeatureFlag$<Flag extends FeatureFlag>(key: Flag): Observable<boolean>;
  abstract userCachedFeatureFlag$<Flag extends FeatureFlag>(
    key: Flag,
    userId: UserId,
  ): Observable<boolean>;
  abstract getFeatureFlag<Flag extends FeatureFlag>(key: Flag): Promise<boolean>;
  abstract checkServerMeetsVersionRequirement$(
    minimumRequiredServerVersion: SemVer,
  ): Observable<boolean>;
  abstract ensureConfigFetched(): Promise<void>;

  /* PlatformUtilsService methods */
  abstract getDevice(): DeviceType;
  abstract getDeviceString(): string;
  abstract getClientType(): ClientType;
  abstract isFirefox(): boolean;
  abstract isChrome(): boolean;
  abstract isEdge(): boolean;
  abstract isOpera(): boolean;
  abstract isVivaldi(): boolean;
  abstract isSafari(): boolean;
  abstract isChromium(): boolean;
  abstract isMacAppStore(): boolean;
  abstract isPopupOpen(): Promise<boolean>;
  abstract launchUri(uri: string, options?: any): void;
  abstract getApplicationVersion(): Promise<string>;
  abstract getApplicationVersionNumber(): Promise<string>;
  abstract supportsWebAuthn(win: Window): boolean;
  abstract supportsDuo(): boolean;
  abstract supportsAutofill(): boolean;
  abstract supportsFileDownloads(): boolean;
  abstract isDev(): boolean;
  abstract isSelfHost(): boolean;
  abstract copyToClipboard(text: string, options?: any): void | boolean;
  abstract readFromClipboard(): Promise<string>;
  abstract supportsSecureStorage(): boolean;
  abstract getAutofillKeyboardShortcut(): Promise<string>;
  /**
   * @deprecated use `@bitwarden/components/ToastService.showToast` instead
   */
  abstract showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ): void;
}

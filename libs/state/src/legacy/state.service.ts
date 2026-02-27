import { UserId } from "@bitwarden/user-core";

export type RequiredUserId = { userId: UserId };

/**
 * This class exists for various legacy reasons, there are likely better things to use than this service.
 */
export abstract class StateService {
  abstract clean(options: RequiredUserId): Promise<void>;

  /**
   * Gets the user's auto key
   */
  abstract getUserKeyAutoUnlock(options: RequiredUserId): Promise<string | null>;
  /**
   * Sets the user's auto key
   */
  abstract setUserKeyAutoUnlock(value: string | null, options: RequiredUserId): Promise<void>;
  /**
   * @deprecated For backwards compatible purposes only, use DesktopAutofillSettingsService
   */
  abstract setEnableDuckDuckGoBrowserIntegration(value: boolean): Promise<void>;
  abstract getDuckDuckGoSharedKey(): Promise<string | null>;
  abstract setDuckDuckGoSharedKey(value: string): Promise<void>;
}

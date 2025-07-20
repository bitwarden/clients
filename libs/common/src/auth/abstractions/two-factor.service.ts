import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";

export interface TwoFactorProviderDetails {
  type: TwoFactorProviderType;
  name: string;
  description: string;
  priority: number;
  sort: number;
  premium: boolean;
}
export abstract class TwoFactorService {
  /**
   * Initializes the client-side's TwoFactorProviders const with translations.
   */
  abstract init(): void;

  /**
   * Gets a list of two-factor providers from state that are supported on the current client.
   * E.g., WebAuthn and Duo are not available on all clients.
   * @returns A list of supported two-factor providers or an empty list if none are stored in state.
   */
  abstract getSupportedProviders(win: Window): Promise<TwoFactorProviderDetails[]>;

  /**
   * Gets the previously selected two-factor provider or the default two factor provider based on priority.
   * @param webAuthnSupported - Whether or not WebAuthn is supported by the client. Prevents WebAuthn from being the default provider if false.
   */
  abstract getDefaultProvider(webAuthnSupported: boolean): Promise<TwoFactorProviderType>;

  /**
   * Sets the selected two-factor provider in state.
   * @param type - The type of two-factor provider to set as the selected provider.
   */
  abstract setSelectedProvider(type: TwoFactorProviderType): Promise<void>;

  /**
   * Clears the selected two-factor provider from state.
   */
  abstract clearSelectedProvider(): Promise<void>;

  /**
   * Sets the list of available two-factor providers in state.
   * @param response - the response from Identity for when 2FA is required. Includes the list of available 2FA providers.
   */
  abstract setProviders(response: IdentityTwoFactorResponse): Promise<void>;

  /**
   * Clears the list of available two-factor providers from state.
   */
  abstract clearProviders(): Promise<void>;

  /**
   * Gets the list of two-factor providers from state.
   * Note: no filtering is done here, so this will return all providers, including potentially
   * unsupported ones for the current client.
   * @returns A list of two-factor providers or null if none are stored in state.
   */
  abstract getProviders(): Promise<Map<TwoFactorProviderType, { [key: string]: string }> | null>;
}

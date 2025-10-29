import { ListResponse } from "../../models/response/list.response";
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { DisableTwoFactorAuthenticatorRequest } from "../models/request/disable-two-factor-authenticator.request";
import { SecretVerificationRequest } from "../models/request/secret-verification.request";
import { TwoFactorEmailRequest } from "../models/request/two-factor-email.request";
import { TwoFactorProviderRequest } from "../models/request/two-factor-provider.request";
import { UpdateTwoFactorAuthenticatorRequest } from "../models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "../models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "../models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "../models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "../models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "../models/request/update-two-factor-yubikey-otp.request";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";
import { TwoFactorAuthenticatorResponse } from "../models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "../models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "../models/response/two-factor-email.response";
import { TwoFactorProviderResponse } from "../models/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../models/response/two-factor-recover.response";
import {
  ChallengeResponse,
  TwoFactorWebAuthnResponse,
} from "../models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "../models/response/two-factor-yubi-key.response";

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

  /**
   * Gets the enabled two-factor providers for the current user from the API.
   * Used for settings management.
   * @returns A promise that resolves to a list response containing enabled two-factor provider configurations.
   */
  abstract getEnabledTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>>;

  /**
   * Gets the enabled two-factor providers for an organization from the API.
   * Requires organization administrator permissions.
   * Used for settings management.
   *
   * @param organizationId The ID of the organization.
   * @returns A promise that resolves to a list response containing enabled two-factor provider configurations.
   */
  abstract getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>>;

  /**
   * Gets the authenticator (TOTP) two-factor configuration for the current user from the API.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the authenticator configuration including the secret key.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorAuthenticator(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorAuthenticatorResponse>;

  /**
   * Gets the email two-factor configuration for the current user from the API.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the email two-factor configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorEmail(request: SecretVerificationRequest): Promise<TwoFactorEmailResponse>;

  /**
   * Gets the Duo two-factor configuration for the current user from the API.
   * Requires user verification and an active premium subscription.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the Duo configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse>;

  /**
   * Gets the Duo two-factor configuration for an organization from the API.
   * Requires user verification and organization policy management permissions.
   * Used for settings management.
   *
   * @param organizationId The ID of the organization.
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the organization Duo configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorDuoResponse>;

  /**
   * Gets the YubiKey OTP two-factor configuration for the current user from the API.
   * Requires user verification and an active premium subscription.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the YubiKey configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorYubiKey(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorYubiKeyResponse>;

  /**
   * Gets the WebAuthn (FIDO2) two-factor configuration for the current user from the API.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to authentication.
   * @returns A promise that resolves to the WebAuthn configuration including registered credentials.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorWebAuthn(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Gets a WebAuthn challenge for registering a new WebAuthn credential from the API.
   * This must be called before putTwoFactorWebAuthn to obtain the cryptographic challenge
   * required for credential creation. The challenge is used by the browser's WebAuthn API.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link SecretVerificationRequest} to prove authentication.
   * @returns A promise that resolves to the credential creation options containing the challenge.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorWebAuthnChallenge(
    request: SecretVerificationRequest,
  ): Promise<ChallengeResponse>;

  /**
   * Gets the recovery code configuration for the current user from the API.
   * The recovery code should be stored securely by the user.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   *  @param verification The verification information to prove authentication.
   * @returns A promise that resolves to the recovery code configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract getTwoFactorRecover(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorRecoverResponse>;

  /**
   * Enables or updates the authenticator (TOTP) two-factor provider.
   * Validates the provided token against the shared secret before enabling.
   * The token must be generated by an authenticator app using the secret key.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorAuthenticatorRequest} to prove authentication.
   * @returns A promise that resolves to the updated authenticator configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorAuthenticator(
    request: UpdateTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorAuthenticatorResponse>;

  /**
   * Disables the authenticator (TOTP) two-factor provider for the current user.
   * Requires user verification token to confirm the operation.
   * Used for settings management.
   *
   * @param request The {@link DisableTwoFactorAuthenticatorRequest} to prove authentication.
   * @returns A promise that resolves to the updated provider status.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract deleteTwoFactorAuthenticator(
    request: DisableTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Enables or updates the email two-factor provider for the current user.
   * Validates the email verification token sent via postTwoFactorEmailSetup before enabling.
   * The token must match the code sent to the specified email address.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorEmailRequest} to prove authentication.
   * @returns A promise that resolves to the updated email two-factor configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorEmail(request: UpdateTwoFactorEmailRequest): Promise<TwoFactorEmailResponse>;

  /**
   * Enables or updates the Duo two-factor provider for the current user.
   * Validates the Duo configuration (client ID, client secret, and host) before enabling.
   * Requires user verification and an active premium subscription.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorDuoRequest} to prove authentication.
   * @returns A promise that resolves to the updated Duo configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorDuo(request: UpdateTwoFactorDuoRequest): Promise<TwoFactorDuoResponse>;

  /**
   * Enables or updates the Duo two-factor provider for an organization.
   * Validates the Duo configuration (client ID, client secret, and host) before enabling.
   * Requires user verification and organization policy management permissions.
   * Used for settings management.
   *
   * @param organizationId The ID of the organization.
   * @param request The {@link UpdateTwoFactorDuoRequest} to prove authentication.
   * @returns A promise that resolves to the updated organization Duo configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorOrganizationDuo(
    organizationId: string,
    request: UpdateTwoFactorDuoRequest,
  ): Promise<TwoFactorDuoResponse>;

  /**
   * Enables or updates the YubiKey OTP two-factor provider for the current user.
   * Validates each provided YubiKey by testing an OTP from the device.
   * Supports up to 5 YubiKey devices. Empty key slots are allowed.
   * Requires user verification and an active premium subscription.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorYubikeyOtpRequest} to prove authentication.
   * @returns A promise that resolves to the updated YubiKey configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorYubiKey(
    request: UpdateTwoFactorYubikeyOtpRequest,
  ): Promise<TwoFactorYubiKeyResponse>;

  /**
   * Registers a new WebAuthn (FIDO2) credential for two-factor authentication for the current user.
   * Must be called after getTwoFactorWebAuthnChallenge to complete the registration flow.
   * The device response contains the signed challenge from the authenticator device.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorWebAuthnRequest} to prove authentication.
   * @returns A promise that resolves to the updated WebAuthn configuration with the new credential.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Removes a specific WebAuthn (FIDO2) credential from the user's account.
   * The credential will no longer be usable for two-factor authentication.
   * Other registered WebAuthn credentials remain active.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link UpdateTwoFactorWebAuthnDeleteRequest} to prove authentication.
   * @returns A promise that resolves to the updated WebAuthn configuration.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract deleteTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Disables a specific two-factor provider for the current user.
   * The provider will no longer be required or usable for authentication.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link TwoFactorProviderRequest} to prove authentication.
   * @returns A promise that resolves to the updated provider status.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorDisable(
    request: TwoFactorProviderRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Disables a specific two-factor provider for an organization.
   * The provider will no longer be available for organization members.
   * Requires user verification and organization policy management permissions.
   * Used for settings management.
   *
   * @param organizationId The ID of the organization.
   * @param request The {@link TwoFactorProviderRequest} to prove authentication.
   * @returns A promise that resolves to the updated provider status.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract putTwoFactorOrganizationDisable(
    organizationId: string,
    request: TwoFactorProviderRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Initiates email two-factor setup by sending a verification code to the specified email address.
   * This is the first step in enabling email two-factor authentication.
   * The verification code must be provided to putTwoFactorEmail to complete setup.
   * Only used during initial configuration, not during login flows.
   * Requires user verification via master password or OTP.
   * Used for settings management.
   *
   * @param request The {@link TwoFactorEmailRequest} to prove authentication.
   * @returns A promise that resolves when the verification email has been sent.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract postTwoFactorEmailSetup(request: TwoFactorEmailRequest): Promise<any>;

  /**
   * Sends a two-factor authentication code via email during the login flow.
   * Supports multiple authentication contexts including standard login, SSO, and passwordless flows.
   * This is used to deliver codes during authentication, not during initial setup.
   * May be called without authentication for login scenarios.
   * Used during authentication flows.
   *
   * @param request The {@link TwoFactorEmailRequest} to prove authentication.
   * @returns A promise that resolves when the authentication email has been sent.
   * @remarks Use {@link UserVerificationService.buildRequest} to create the request object.
   */
  abstract postTwoFactorEmail(request: TwoFactorEmailRequest): Promise<any>;
}

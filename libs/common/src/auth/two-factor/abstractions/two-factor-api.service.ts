import { ListResponse } from "../../../models/response/list.response";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { TwoFactorAuthenticatorDeleteRequest } from "../request/two-factor-authenticator-delete.request";
import { TwoFactorAuthenticatorUpdateRequest } from "../request/two-factor-authenticator-update.request";
import { TwoFactorDuoDeleteRequest } from "../request/two-factor-duo-delete.request";
import { TwoFactorDuoUpdateRequest } from "../request/two-factor-duo-update.request";
import { TwoFactorEmailDeleteRequest } from "../request/two-factor-email-delete.request";
import { TwoFactorEmailLoginRequest } from "../request/two-factor-email-login.request";
import { TwoFactorEmailSetupRequest } from "../request/two-factor-email-setup.request";
import { TwoFactorEmailUpdateRequest } from "../request/two-factor-email-update.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "../request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnChallengeRequest } from "../request/two-factor-web-authn-challenge.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "../request/two-factor-web-authn-delete-all.request";
import { TwoFactorWebAuthnDeleteRequest } from "../request/two-factor-web-authn-delete.request";
import { TwoFactorWebAuthnUpdateRequest } from "../request/two-factor-web-authn-update.request";
import { TwoFactorYubiKeyDeleteRequest } from "../request/two-factor-yubikey-delete.request";
import { TwoFactorYubiKeyUpdateRequest } from "../request/two-factor-yubikey-update.request";
import { TwoFactorAuthenticatorUpdateResponse } from "../response/two-factor-authenticator-update.response";
import { TwoFactorAuthenticatorResponse } from "../response/two-factor-authenticator.response";
import { TwoFactorDuoUpdateResponse } from "../response/two-factor-duo-update.response";
import { TwoFactorDuoResponse } from "../response/two-factor-duo.response";
import { TwoFactorEmailUpdateResponse } from "../response/two-factor-email-update.response";
import { TwoFactorEmailResponse } from "../response/two-factor-email.response";
import { TwoFactorOrganizationDuoUpdateResponse } from "../response/two-factor-organization-duo-update.response";
import { TwoFactorOrganizationDuoResponse } from "../response/two-factor-organization-duo.response";
import { TwoFactorProviderResponse } from "../response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "../response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "../response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnDeleteResponse } from "../response/two-factor-web-authn-delete.response";
import { TwoFactorWebAuthnUpdateResponse } from "../response/two-factor-web-authn-update.response";
import { TwoFactorWebAuthnResponse } from "../response/two-factor-web-authn.response";
import { TwoFactorYubiKeyUpdateResponse } from "../response/two-factor-yubi-key-update.response";
import { TwoFactorYubiKeyResponse } from "../response/two-factor-yubi-key.response";

/**
 * Service abstraction for two-factor authentication API operations.
 * Provides methods for managing various two-factor authentication providers including
 * authenticator apps (TOTP), email, Duo, YubiKey, WebAuthn (FIDO2), and recovery codes.
 *
 * All methods that retrieve sensitive configuration data require user verification via
 * SecretVerificationRequest. Update/enable methods for Duo and YubiKey require an active
 * premium subscription. Organization-level methods require appropriate administrative permissions.
 */
export abstract class TwoFactorApiService {
  /**
   * Gets a list of all enabled two-factor providers for the current user.
   *
   * @returns A promise that resolves to a list response containing enabled two-factor provider configurations.
   */
  abstract getTwoFactorProviders(): Promise<ListResponse<TwoFactorProviderResponse>>;

  /**
   * Gets a list of all enabled two-factor providers for an organization.
   * Requires organization administrator permissions.
   *
   * @param organizationId The ID of the organization.
   * @returns A promise that resolves to a list response containing enabled two-factor provider configurations.
   */
  abstract getTwoFactorOrganizationProviders(
    organizationId: string,
  ): Promise<ListResponse<TwoFactorProviderResponse>>;

  /**
   * Gets the authenticator (TOTP) two-factor configuration for the current user.
   * Returns the shared secret key and user verification token needed for setup.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the authenticator configuration including the secret key.
   */
  abstract getTwoFactorAuthenticator(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorAuthenticatorResponse>;

  /**
   * Gets the email two-factor configuration for the current user.
   * Returns the configured email address, enabled status, and a user verification token.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the email two-factor configuration.
   */
  abstract getTwoFactorEmail(request: SecretVerificationRequest): Promise<TwoFactorEmailResponse>;

  /**
   * Gets the Duo two-factor configuration for the current user.
   * Returns Duo integration configuration details and a user verification token.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the Duo configuration.
   */
  abstract getTwoFactorDuo(request: SecretVerificationRequest): Promise<TwoFactorDuoResponse>;

  /**
   * Gets the Duo two-factor configuration for an organization.
   * Returns organization-level Duo integration configuration and a user verification token.
   * Requires user verification and organization policy management permissions.
   *
   * @param organizationId The ID of the organization.
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the organization Duo configuration.
   */
  abstract getTwoFactorOrganizationDuo(
    organizationId: string,
    request: SecretVerificationRequest,
  ): Promise<TwoFactorOrganizationDuoResponse>;

  /**
   * Gets the YubiKey OTP two-factor configuration for the current user.
   * Returns configured YubiKey device identifiers and a user verification token.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the YubiKey configuration.
   */
  abstract getTwoFactorYubiKey(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorYubiKeyResponse>;

  /**
   * Gets the WebAuthn (FIDO2) two-factor configuration for the current user.
   * Returns a list of registered WebAuthn credentials with their names and IDs,
   * and a user verification token.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the WebAuthn configuration including registered credentials.
   */
  abstract getTwoFactorWebAuthn(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Gets a WebAuthn challenge for registering a new WebAuthn credential.
   * This must be called before putTwoFactorWebAuthn to obtain the cryptographic challenge
   * required for credential creation. Authorized by replaying the user-verification token
   * minted by the prior getTwoFactorWebAuthn call; that same token stays valid for the
   * subsequent PUT.
   *
   * @param request The request carrying the user-verification token from getTwoFactorWebAuthn.
   * @returns A promise that resolves to the wrapped challenge response.
   */
  abstract getTwoFactorWebAuthnChallenge(
    request: TwoFactorWebAuthnChallengeRequest,
  ): Promise<TwoFactorWebAuthnChallengeResponse>;

  /**
   * Gets the recovery code configuration for the current user.
   * Returns the recovery code that can be used to regain access if other two-factor methods are unavailable.
   * The recovery code should be stored securely by the user.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the recovery code configuration.
   */
  abstract getTwoFactorRecover(
    request: SecretVerificationRequest,
  ): Promise<TwoFactorRecoverResponse>;

  /**
   * Enables or updates the authenticator (TOTP) two-factor provider.
   * Validates the provided token against the shared secret before enabling.
   * The token must be generated by an authenticator app using the secret key.
   *
   * @param request The request containing the authenticator configuration and verification token.
   * @returns A promise that resolves to the updated authenticator configuration.
   */
  abstract putTwoFactorAuthenticator(
    request: TwoFactorAuthenticatorUpdateRequest,
  ): Promise<TwoFactorAuthenticatorUpdateResponse>;

  /**
   * Removes the authenticator (TOTP) two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation. Returns 204 No Content.
   *
   * @param request The request containing the user verification token and key.
   */
  abstract deleteTwoFactorAuthenticator(
    request: TwoFactorAuthenticatorDeleteRequest,
  ): Promise<void>;

  /**
   * Enables or updates the email two-factor provider.
   * Validates the email verification token sent via postTwoFactorEmailSetup before enabling.
   *
   * @param request The request containing the email configuration and verification token.
   * @returns A promise that resolves to the updated email two-factor configuration.
   */
  abstract putTwoFactorEmail(
    request: TwoFactorEmailUpdateRequest,
  ): Promise<TwoFactorEmailUpdateResponse>;

  /**
   * Removes the email two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation. Returns 204 No Content.
   *
   * @param request The request containing the user verification token.
   */
  abstract deleteTwoFactorEmail(request: TwoFactorEmailDeleteRequest): Promise<void>;

  /**
   * Enables or updates the Duo two-factor provider for the current user.
   * Validates the Duo configuration (client ID, client secret, and host) before enabling.
   * Requires an active premium subscription.
   *
   * @param request The request containing the Duo integration configuration.
   * @returns A promise that resolves to the updated Duo configuration.
   */
  abstract putTwoFactorDuo(request: TwoFactorDuoUpdateRequest): Promise<TwoFactorDuoUpdateResponse>;

  /**
   * Removes the Duo two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation. Returns 204 No Content.
   * Does NOT require premium — deletion must always be available even if premium has lapsed.
   *
   * @param request The request containing the user verification token.
   */
  abstract deleteTwoFactorDuo(request: TwoFactorDuoDeleteRequest): Promise<void>;

  /**
   * Enables or updates the Duo two-factor provider for an organization.
   * Validates the Duo configuration (client ID, client secret, and host) before enabling.
   * Requires organization policy management permissions.
   *
   * @param organizationId The ID of the organization.
   * @param request The request containing the Duo integration configuration.
   * @returns A promise that resolves to the updated organization Duo configuration.
   */
  abstract putTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorDuoUpdateRequest,
  ): Promise<TwoFactorOrganizationDuoUpdateResponse>;

  /**
   * Removes the Duo two-factor enrollment for an organization. Returns 204 No Content.
   * Requires a user verification token to confirm the operation and
   * organization policy management permissions.
   *
   * @param organizationId The ID of the organization.
   * @param request The request containing the user verification token.
   */
  abstract deleteTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorOrganizationDuoDeleteRequest,
  ): Promise<void>;

  /**
   * Enables or updates the YubiKey OTP two-factor provider.
   * Validates each provided YubiKey by testing an OTP from the device.
   * Supports up to 5 YubiKey devices. Empty key slots are allowed.
   * Requires an active premium subscription.
   *
   * @param request The request containing YubiKey device identifiers and test OTPs.
   * @returns A promise that resolves to the updated YubiKey configuration.
   */
  abstract putTwoFactorYubiKey(
    request: TwoFactorYubiKeyUpdateRequest,
  ): Promise<TwoFactorYubiKeyUpdateResponse>;

  /**
   * Removes the YubiKey two-factor enrollment for the current user. Returns 204 No Content.
   * Requires a user verification token to confirm the operation.
   * Does NOT require premium — deletion must always be available even if premium has lapsed.
   *
   * @param request The request containing the user verification token.
   */
  abstract deleteTwoFactorYubiKey(request: TwoFactorYubiKeyDeleteRequest): Promise<void>;

  /**
   * Registers a new WebAuthn (FIDO2) credential for two-factor authentication.
   * Must be called after getTwoFactorWebAuthnChallenge to complete the registration flow.
   * The device response contains the signed challenge from the authenticator device.
   *
   * @param request The request containing the WebAuthn credential creation response and verification token.
   * @returns A promise that resolves to the updated WebAuthn configuration with the new credential.
   */
  abstract putTwoFactorWebAuthn(
    request: TwoFactorWebAuthnUpdateRequest,
  ): Promise<TwoFactorWebAuthnUpdateResponse>;

  /**
   * Removes a specific WebAuthn (FIDO2) credential from the user's account.
   * The credential will no longer be usable for two-factor authentication.
   * Other registered WebAuthn credentials remain active.
   * Server refuses to remove the last registered credential — use deleteTwoFactorWebAuthnAll instead.
   * The operation modifies the WebAuthn provider rather than destroying it, so the response
   * carries the updated parent state.
   *
   * @param request The request containing the credential ID and verification token.
   * @returns A promise that resolves to the updated WebAuthn configuration.
   */
  abstract deleteTwoFactorWebAuthn(
    request: TwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnDeleteResponse>;

  /**
   * Removes the entire WebAuthn (FIDO2) two-factor enrollment for the current user — all
   * credentials are deleted in a single round-trip. The only path that can clear the last
   * registered credential, since per-credential delete refuses by design. Returns 204 No Content.
   *
   * @param request The request containing the user verification token.
   */
  abstract deleteTwoFactorWebAuthnAll(request: TwoFactorWebAuthnDeleteAllRequest): Promise<void>;

  /**
   * Initiates email two-factor setup by sending a verification code to the specified email address.
   * This is the first step in enabling email two-factor authentication.
   * The verification code must be provided to putTwoFactorEmail to complete setup.
   * Only used during initial configuration, not during login flows.
   * Requires a user verification token (from a prior getTwoFactorEmail call).
   *
   * @param request The request containing the email address and verification token for two-factor setup.
   * @returns A promise that resolves when the verification email has been sent.
   */
  abstract postTwoFactorEmailSetup(request: TwoFactorEmailSetupRequest): Promise<any>;

  /**
   * Sends a two-factor authentication code via email during the login flow.
   * Supports multiple authentication contexts including standard login, SSO, and passwordless flows.
   * This is used to deliver codes during authentication, not during initial setup.
   * May be called without authentication for login scenarios.
   *
   * @param request The request to send the two-factor code, optionally including SSO or auth request tokens.
   * @returns A promise that resolves when the authentication email has been sent.
   */
  abstract postTwoFactorEmail(request: TwoFactorEmailLoginRequest): Promise<any>;
}

import { DeleteTwoFactorAuthenticatorRequest } from "@bitwarden/common/auth/models/request/delete-two-factor-authenticator.request";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorDuoDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-duo-delete.request";
import { TwoFactorEmailDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-email-delete.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorOrganizationDuoDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-organization-duo-delete.request";
import { TwoFactorWebAuthnDeleteAllRequest } from "@bitwarden/common/auth/models/request/two-factor-web-authn-delete-all.request";
import { TwoFactorYubiKeyDeleteRequest } from "@bitwarden/common/auth/models/request/two-factor-yubikey-delete.request";
import { UpdateTwoFactorAuthenticatorRequest } from "@bitwarden/common/auth/models/request/update-two-factor-authenticator.request";
import { UpdateTwoFactorDuoRequest } from "@bitwarden/common/auth/models/request/update-two-factor-duo.request";
import { UpdateTwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/update-two-factor-email.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn.request";
import { UpdateTwoFactorYubikeyOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubikey-otp.request";
import { TwoFactorAuthenticatorResponse } from "@bitwarden/common/auth/models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/models/response/two-factor-email.response";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/models/response/two-factor-provider.response";
import { TwoFactorRecoverResponse } from "@bitwarden/common/auth/models/response/two-factor-recover.response";
import { TwoFactorWebAuthnChallengeResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn-challenge.response";
import { TwoFactorWebAuthnResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

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
  ): Promise<TwoFactorDuoResponse>;

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
   * required for credential creation. The challenge is wrapped together with a user verification
   * token used to authorize the subsequent PUT.
   * Requires user verification via master password or OTP.
   *
   * @param request The secret verification request to authorize the operation.
   * @returns A promise that resolves to the wrapped challenge response.
   */
  abstract getTwoFactorWebAuthnChallenge(
    request: SecretVerificationRequest,
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
    request: UpdateTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorAuthenticatorResponse>;

  /**
   * Removes the authenticator (TOTP) two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation.
   *
   * @param request The request containing the user verification token and key.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorAuthenticator(
    request: DeleteTwoFactorAuthenticatorRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Enables or updates the email two-factor provider.
   * Validates the email verification token sent via postTwoFactorEmailSetup before enabling.
   *
   * @param request The request containing the email configuration and verification token.
   * @returns A promise that resolves to the updated email two-factor configuration.
   */
  abstract putTwoFactorEmail(request: UpdateTwoFactorEmailRequest): Promise<TwoFactorEmailResponse>;

  /**
   * Removes the email two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation.
   *
   * @param request The request containing the user verification token.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorEmail(
    request: TwoFactorEmailDeleteRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Enables or updates the Duo two-factor provider for the current user.
   * Validates the Duo configuration (client ID, client secret, and host) before enabling.
   * Requires an active premium subscription.
   *
   * @param request The request containing the Duo integration configuration.
   * @returns A promise that resolves to the updated Duo configuration.
   */
  abstract putTwoFactorDuo(request: UpdateTwoFactorDuoRequest): Promise<TwoFactorDuoResponse>;

  /**
   * Removes the Duo two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation.
   * Does NOT require premium — disabling must always be available even if premium has lapsed.
   *
   * @param request The request containing the user verification token.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorDuo(
    request: TwoFactorDuoDeleteRequest,
  ): Promise<TwoFactorProviderResponse>;

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
    request: UpdateTwoFactorDuoRequest,
  ): Promise<TwoFactorDuoResponse>;

  /**
   * Removes the Duo two-factor enrollment for an organization.
   * Requires a user verification token to confirm the operation and
   * organization policy management permissions.
   *
   * @param organizationId The ID of the organization.
   * @param request The request containing the user verification token.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorOrganizationDuo(
    organizationId: string,
    request: TwoFactorOrganizationDuoDeleteRequest,
  ): Promise<TwoFactorProviderResponse>;

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
    request: UpdateTwoFactorYubikeyOtpRequest,
  ): Promise<TwoFactorYubiKeyResponse>;

  /**
   * Removes the YubiKey two-factor enrollment for the current user.
   * Requires a user verification token to confirm the operation.
   * Does NOT require premium — disabling must always be available even if premium has lapsed.
   *
   * @param request The request containing the user verification token.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorYubiKey(
    request: TwoFactorYubiKeyDeleteRequest,
  ): Promise<TwoFactorProviderResponse>;

  /**
   * Registers a new WebAuthn (FIDO2) credential for two-factor authentication.
   * Must be called after getTwoFactorWebAuthnChallenge to complete the registration flow.
   * The device response contains the signed challenge from the authenticator device.
   *
   * @param request The request containing the WebAuthn credential creation response and verification token.
   * @returns A promise that resolves to the updated WebAuthn configuration with the new credential.
   */
  abstract putTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Removes a specific WebAuthn (FIDO2) credential from the user's account.
   * The credential will no longer be usable for two-factor authentication.
   * Other registered WebAuthn credentials remain active.
   * Server refuses to remove the last registered credential — use deleteTwoFactorWebAuthnAll instead.
   *
   * @param request The request containing the credential ID and verification token.
   * @returns A promise that resolves to the updated WebAuthn configuration.
   */
  abstract deleteTwoFactorWebAuthn(
    request: UpdateTwoFactorWebAuthnDeleteRequest,
  ): Promise<TwoFactorWebAuthnResponse>;

  /**
   * Removes the entire WebAuthn (FIDO2) two-factor enrollment for the current user — all
   * credentials are removed and the provider is disabled in a single round-trip. The only path
   * that can clear the last registered credential, since per-credential delete refuses by design.
   *
   * @param request The request containing the user verification token.
   * @returns A promise that resolves to the updated provider status.
   */
  abstract deleteTwoFactorWebAuthnAll(
    request: TwoFactorWebAuthnDeleteAllRequest,
  ): Promise<TwoFactorProviderResponse>;

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
  abstract postTwoFactorEmailSetup(request: TwoFactorEmailRequest): Promise<any>;

  /**
   * Sends a two-factor authentication code via email during the login flow.
   * Supports multiple authentication contexts including standard login, SSO, and passwordless flows.
   * This is used to deliver codes during authentication, not during initial setup.
   * May be called without authentication for login scenarios.
   *
   * @param request The request to send the two-factor code, optionally including SSO or auth request tokens.
   * @returns A promise that resolves when the authentication email has been sent.
   */
  abstract postTwoFactorEmail(request: TwoFactorEmailRequest): Promise<any>;
}

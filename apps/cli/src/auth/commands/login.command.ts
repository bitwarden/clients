// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as http from "http";

import { OptionValues } from "commander";
import * as inquirer from "inquirer";
import Separator from "inquirer/lib/objects/separator";
import { firstValueFrom, map } from "rxjs";

import {
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  SsoLoginCredentials,
  SsoUrlService,
  UserApiLoginCredentials,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { ClientType } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LoginCommand {
  protected canInteract: boolean;
  protected clientSecret: string;
  protected email: string;

  private ssoRedirectUri: string = null;
  private options: OptionValues;

  constructor(
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected authService: AuthService,
    protected apiService: ApiService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected accountService: AccountService,
    protected keyService: KeyService,
    protected policyService: PolicyService,
    protected twoFactorService: TwoFactorService,
    protected syncService: SyncService,
    protected keyConnectorService: KeyConnectorService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected orgService: OrganizationService,
    protected logoutCallback: () => Promise<void>,
    protected kdfConfigService: KdfConfigService,
    protected ssoUrlService: SsoUrlService,
  ) {}

  async run(email: string, password: string, options: OptionValues) {
    this.options = options;
    this.email = email;

    this.canInteract = process.env.BW_NOINTERACTION !== "true";

    let ssoCodeVerifier: string = null;
    let ssoCode: string = null;
    let orgIdentifier: string = null;

    let clientId: string = null;
    let clientSecret: string = null;

    let selectedProvider: any = null;

    if (options.apikey != null) {
      const apiIdentifiers = await this.apiIdentifiers();
      clientId = apiIdentifiers.clientId;
      clientSecret = apiIdentifiers.clientSecret;
      if (clientId == null || clientId.trim() === "") {
        return Response.badRequest("client_id is required.");
      }
      if (clientSecret == null || clientSecret === "") {
        return Response.badRequest("client_secret is required.");
      }
    } else if (options.sso != null && this.canInteract) {
      const passwordOptions: any = {
        type: "password",
        length: 64,
        uppercase: true,
        lowercase: true,
        numbers: true,
        special: false,
      };
      const state = await this.passwordGenerationService.generatePassword(passwordOptions);
      ssoCodeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
      const codeVerifierHash = await this.cryptoFunctionService.hash(ssoCodeVerifier, "sha256");
      const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);
      try {
        const ssoParams = await this.openSsoPrompt(codeChallenge, state);
        ssoCode = ssoParams.ssoCode;
        orgIdentifier = ssoParams.orgIdentifier;
      } catch {
        return Response.badRequest("Something went wrong. Try again.");
      }
    } else {
      if ((email == null || email === "") && this.canInteract) {
        const answer: inquirer.Answers = await inquirer.createPromptModule({
          output: process.stderr,
        })({
          type: "input",
          name: "email",
          message: "Email address:",
        });
        email = answer.email;
      }
      if (email == null || email.trim() === "") {
        return Response.badRequest("Email address is required.");
      }
      if (email.indexOf("@") === -1) {
        return Response.badRequest("Email address is invalid.");
      }
      this.email = email;

      if (password == null || password === "") {
        if (options.passwordfile) {
          password = await NodeUtils.readFirstLine(options.passwordfile);
        } else if (options.passwordenv && process.env[options.passwordenv]) {
          password = process.env[options.passwordenv];
        } else if (this.canInteract) {
          const answer: inquirer.Answers = await inquirer.createPromptModule({
            output: process.stderr,
          })({
            type: "password",
            name: "password",
            message: "Master password:",
          });
          password = answer.password;
        }
      }

      if (password == null || password === "") {
        return Response.badRequest("Master password is required.");
      }
    }

    let twoFactorToken: string = options.code;
    let twoFactorMethod: TwoFactorProviderType = null;
    try {
      if (options.method != null) {
        twoFactorMethod = parseInt(options.method, null);
      }
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return Response.error("Invalid two-step login method.");
    }

    const twoFactor =
      twoFactorToken == null
        ? null
        : new TokenTwoFactorRequest(twoFactorMethod, twoFactorToken, false);

    try {
      await this.validatedParams();

      let response: AuthResult = null;
      if (clientId != null && clientSecret != null) {
        if (!clientId.startsWith("user")) {
          return Response.error("Invalid API Key; Organization API Key currently not supported");
        }
        try {
          response = await this.loginStrategyService.logIn(
            new UserApiLoginCredentials(clientId, clientSecret),
          );
        } catch (e) {
          // handle API key login failures
          // Handle invalid client error as server doesn't return a useful message
          if (
            e?.response?.error &&
            typeof e.response.error === "string" &&
            e.response.error === "invalid_client"
          ) {
            return Response.badRequest("client_id or client_secret is incorrect. Try again.");
          }
          // Pass error up to be handled by the outer catch block below
          throw e;
        }
      } else if (ssoCode != null && ssoCodeVerifier != null) {
        response = await this.loginStrategyService.logIn(
          new SsoLoginCredentials(
            ssoCode,
            ssoCodeVerifier,
            this.ssoRedirectUri,
            orgIdentifier,
            undefined, // email to look up 2FA token not required as CLI can't remember 2FA token
            twoFactor,
          ),
        );
      } else {
        response = await this.loginStrategyService.logIn(
          new PasswordLoginCredentials(email, password, null, twoFactor),
        );
      }
      if (response.requiresEncryptionKeyMigration) {
        return Response.error(
          "Encryption key migration required. Please login through the web vault to update your encryption key.",
        );
      }
      if (response.captchaSiteKey) {
        const credentials = new PasswordLoginCredentials(email, password);
        const handledResponse = await this.handleCaptchaRequired(twoFactor, credentials);

        // Error Response
        if (handledResponse instanceof Response) {
          return handledResponse;
        } else {
          response = handledResponse;
        }
      }
      if (response.requiresTwoFactor) {
        const twoFactorProviders = await this.twoFactorService.getSupportedProviders(null);
        if (twoFactorProviders.length === 0) {
          return Response.badRequest("No providers available for this client.");
        }

        if (twoFactorMethod != null) {
          try {
            selectedProvider = twoFactorProviders.filter((p) => p.type === twoFactorMethod)[0];
            // FIXME: Remove when updating file. Eslint update
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            return Response.error("Invalid two-step login method.");
          }
        }

        if (selectedProvider == null) {
          if (twoFactorProviders.length === 1) {
            selectedProvider = twoFactorProviders[0];
          } else if (this.canInteract) {
            const twoFactorOptions: (string | Separator)[] = twoFactorProviders.map((p) => p.name);
            twoFactorOptions.push(new inquirer.Separator());
            twoFactorOptions.push("Cancel");
            const answer: inquirer.Answers = await inquirer.createPromptModule({
              output: process.stderr,
            })({
              type: "list",
              name: "method",
              message: "Two-step login method:",
              choices: twoFactorOptions,
            });
            const i = twoFactorOptions.indexOf(answer.method);
            if (i === twoFactorOptions.length - 1) {
              return Response.error("Login failed.");
            }
            selectedProvider = twoFactorProviders[i];
          }
          if (selectedProvider == null) {
            return Response.error("Login failed. No provider selected.");
          }
        }

        if (
          twoFactorToken == null &&
          Object.keys(response.twoFactorProviders).length > 1 &&
          selectedProvider.type === TwoFactorProviderType.Email
        ) {
          const emailReq = new TwoFactorEmailRequest();
          emailReq.email = await this.loginStrategyService.getEmail();
          emailReq.masterPasswordHash = await this.loginStrategyService.getMasterPasswordHash();
          await this.apiService.postTwoFactorEmail(emailReq);
        }

        if (twoFactorToken == null) {
          if (this.canInteract) {
            const answer: inquirer.Answers = await inquirer.createPromptModule({
              output: process.stderr,
            })({
              type: "input",
              name: "token",
              message: "Two-step login code:",
            });
            twoFactorToken = answer.token;
          }
          if (twoFactorToken == null || twoFactorToken === "") {
            return Response.badRequest("Code is required.");
          }
        }

        response = await this.loginStrategyService.logInTwoFactor(
          new TokenTwoFactorRequest(selectedProvider.type, twoFactorToken),
          null,
        );
      }

      // Opting for not checking feature flag since the server will not respond with
      // requiresDeviceVerification if the feature flag is not enabled.
      if (response.requiresDeviceVerification) {
        let newDeviceToken: string = null;
        if (this.canInteract) {
          const answer: inquirer.Answers = await inquirer.createPromptModule({
            output: process.stderr,
          })({
            type: "input",
            name: "token",
            message: "New device login code:",
          });
          newDeviceToken = answer.token;
        }
        if (newDeviceToken == null || newDeviceToken === "") {
          return Response.badRequest("Code is required.");
        }
        response = await this.loginStrategyService.logInNewDeviceVerification(newDeviceToken);
      }

      if (response.captchaSiteKey) {
        const twoFactorRequest = new TokenTwoFactorRequest(selectedProvider.type, twoFactorToken);
        const handledResponse = await this.handleCaptchaRequired(twoFactorRequest);

        // Error Response
        if (handledResponse instanceof Response) {
          return handledResponse;
        } else {
          response = handledResponse;
        }
      }

      if (response.requiresTwoFactor) {
        return Response.error("Login failed.");
      }

      if (response.resetMasterPassword) {
        return Response.error(
          "In order to log in with SSO from the CLI, you must first log in" +
            " through the web vault to set your master password.",
        );
      }

      // Run full sync before handling success response or password reset flows (to get Master Password Policies)
      await this.syncService.fullSync(true);

      // Handle updating passwords if NOT using an API Key for authentication
      if (
        response.forcePasswordReset != ForceSetPasswordReason.None &&
        clientId == null &&
        clientSecret == null
      ) {
        if (response.forcePasswordReset === ForceSetPasswordReason.AdminForcePasswordReset) {
          return await this.updateTempPassword();
        } else if (response.forcePasswordReset === ForceSetPasswordReason.WeakMasterPassword) {
          return await this.updateWeakPassword(password);
        }
      }

      return await this.handleSuccessResponse(response);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async validatedParams() {
    const key = await this.cryptoFunctionService.randomBytes(64);
    process.env.BW_SESSION = Utils.fromBufferToB64(key);
  }

  private async handleSuccessResponse(response: AuthResult): Promise<Response> {
    const usesKeyConnector = await this.keyConnectorService.getUsesKeyConnector(response.userId);

    if (
      (this.options.sso != null || this.options.apikey != null) &&
      this.canInteract &&
      !usesKeyConnector
    ) {
      const res = new MessageResponse(
        "You are logged in!",
        "\n" + "To unlock your vault, use the `unlock` command. ex:\n" + "$ bw unlock",
      );
      return Response.success(res);
    }

    const res = new MessageResponse(
      "You are logged in!",
      "\n" +
        "To unlock your vault, set your session key to the `BW_SESSION` environment variable. ex:\n" +
        '$ export BW_SESSION="' +
        process.env.BW_SESSION +
        '"\n' +
        '> $env:BW_SESSION="' +
        process.env.BW_SESSION +
        '"\n\n' +
        "You can also pass the session key to any command with the `--session` option. ex:\n" +
        "$ bw list items --session " +
        process.env.BW_SESSION,
    );
    res.raw = process.env.BW_SESSION;
    return Response.success(res);
  }

  private async handleUpdatePasswordSuccessResponse(): Promise<Response> {
    await this.logoutCallback();
    this.authService.logOut(() => {
      /* Do nothing */
    });

    const res = new MessageResponse(
      "Your master password has been updated!",
      "\n" + "You have been logged out and must log in again to access the vault.",
    );

    return Response.success(res);
  }

  private async updateWeakPassword(currentPassword: string) {
    // If no interaction available, alert user to use web vault
    if (!this.canInteract) {
      await this.logoutCallback();
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return Response.error(
        new MessageResponse(
          "Your master password does not meet one or more of your organization policies. In order to access the vault, you must update your master password now via the web vault. You have been logged out.",
          null,
        ),
      );
    }

    try {
      const { newPasswordHash, newUserKey, hint } = await this.collectNewMasterPasswordDetails(
        "Your master password does not meet one or more of your organization policies. In order to access the vault, you must update your master password now.",
      );

      const request = new PasswordRequest();
      request.masterPasswordHash = await this.keyService.hashMasterKey(currentPassword, null);
      request.masterPasswordHint = hint;
      request.newMasterPasswordHash = newPasswordHash;
      request.key = newUserKey[1].encryptedString;

      await this.apiService.postPassword(request);

      return await this.handleUpdatePasswordSuccessResponse();
    } catch (e) {
      await this.logoutCallback();
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return Response.error(e);
    }
  }

  private async updateTempPassword() {
    // If no interaction available, alert user to use web vault
    if (!this.canInteract) {
      await this.logoutCallback();
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return Response.error(
        new MessageResponse(
          "An organization administrator recently changed your master password. In order to access the vault, you must update your master password now via the web vault. You have been logged out.",
          null,
        ),
      );
    }

    try {
      const { newPasswordHash, newUserKey, hint } = await this.collectNewMasterPasswordDetails(
        "An organization administrator recently changed your master password. In order to access the vault, you must update your master password now.",
      );

      const request = new UpdateTempPasswordRequest();
      request.key = newUserKey[1].encryptedString;
      request.newMasterPasswordHash = newPasswordHash;
      request.masterPasswordHint = hint;

      await this.apiService.putUpdateTempPassword(request);

      return await this.handleUpdatePasswordSuccessResponse();
    } catch (e) {
      await this.logoutCallback();
      this.authService.logOut(() => {
        /* Do nothing */
      });
      return Response.error(e);
    }
  }

  /**
   * Collect new master password and hint from the CLI. The collected password
   * is validated against any applicable master password policies, a new master
   * key is generated, and we use it to re-encrypt the user key
   * @param prompt - Message that is displayed during the initial prompt
   * @param error
   */
  private async collectNewMasterPasswordDetails(
    prompt: string,
    error?: string,
  ): Promise<{
    newPasswordHash: string;
    newUserKey: [SymmetricCryptoKey, EncString];
    hint?: string;
  }> {
    if (this.email == null || this.email === "undefined") {
      this.email = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.email)),
      );
    }

    // Get New Master Password
    const baseMessage = `${prompt}\n` + "Master password: ";
    const firstMessage = error != null ? error + baseMessage : baseMessage;
    const mp: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "password",
      name: "password",
      message: firstMessage,
    });
    const masterPassword = mp.password;

    // Master Password Validation
    if (masterPassword == null || masterPassword === "") {
      return this.collectNewMasterPasswordDetails(prompt, "Master password is required.\n");
    }

    if (masterPassword.length < Utils.minimumPasswordLength) {
      return this.collectNewMasterPasswordDetails(
        prompt,
        `Master password must be at least ${Utils.minimumPasswordLength} characters long.\n`,
      );
    }

    // Strength & Policy Validation
    const strengthResult = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.email,
    );

    const enforcedPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(),
    );

    // Verify master password meets policy requirements
    if (
      enforcedPolicyOptions != null &&
      !this.policyService.evaluateMasterPassword(
        strengthResult.score,
        masterPassword,
        enforcedPolicyOptions,
      )
    ) {
      return this.collectNewMasterPasswordDetails(
        prompt,
        "Your new master password does not meet the policy requirements.\n",
      );
    }

    // Get New Master Password Re-type
    const reTypeMessage = "Re-type New Master password (Strength: " + strengthResult.score + ")";
    const retype: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "password",
      name: "password",
      message: reTypeMessage,
    });
    const masterPasswordRetype = retype.password;

    // Re-type Validation
    if (masterPassword !== masterPasswordRetype) {
      return this.collectNewMasterPasswordDetails(
        prompt,
        "Master password confirmation does not match.\n",
      );
    }

    // Get Hint (optional)
    const hint: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "input",
      name: "input",
      message: "Master Password Hint (optional):",
    });
    const masterPasswordHint = hint.input;
    const kdfConfig = await this.kdfConfigService.getKdfConfig();

    // Create new key and hash new password
    const newMasterKey = await this.keyService.makeMasterKey(
      masterPassword,
      this.email.trim().toLowerCase(),
      kdfConfig,
    );
    const newPasswordHash = await this.keyService.hashMasterKey(masterPassword, newMasterKey);

    // Grab user key
    const userKey = await this.keyService.getUserKey();
    if (!userKey) {
      throw new Error("User key not found.");
    }

    // Re-encrypt user key with new master key
    const newUserKey = await this.keyService.encryptUserKeyWithMasterKey(newMasterKey, userKey);

    return { newPasswordHash, newUserKey: newUserKey, hint: masterPasswordHint };
  }

  private async handleCaptchaRequired(
    twoFactorRequest: TokenTwoFactorRequest,
    credentials: PasswordLoginCredentials = null,
  ): Promise<AuthResult | Response> {
    const badCaptcha = Response.badRequest(
      "Your authentication request has been flagged and will require user interaction to proceed.\n" +
        "Please use your API key to validate this request and ensure BW_CLIENTSECRET is correct, if set.\n" +
        "(https://bitwarden.com/help/cli-auth-challenges)",
    );

    try {
      const captchaClientSecret = await this.apiClientSecret(true);
      if (Utils.isNullOrWhitespace(captchaClientSecret)) {
        return badCaptcha;
      }

      let authResultResponse: AuthResult = null;
      if (credentials != null) {
        credentials.captchaToken = captchaClientSecret;
        credentials.twoFactor = twoFactorRequest;
        authResultResponse = await this.loginStrategyService.logIn(credentials);
      } else {
        authResultResponse = await this.loginStrategyService.logInTwoFactor(
          twoFactorRequest,
          captchaClientSecret,
        );
      }

      return authResultResponse;
    } catch (e) {
      if (
        e instanceof ErrorResponse ||
        (e.constructor.name === ErrorResponse.name &&
          (e as ErrorResponse).message.includes("Captcha is invalid"))
      ) {
        return badCaptcha;
      } else {
        return Response.error(e);
      }
    }
  }

  private async apiClientId(): Promise<string> {
    let clientId: string = null;

    const storedClientId: string = process.env.BW_CLIENTID;
    if (storedClientId == null) {
      if (this.canInteract) {
        const answer: inquirer.Answers = await inquirer.createPromptModule({
          output: process.stderr,
        })({
          type: "input",
          name: "clientId",
          message: "client_id:",
        });
        clientId = answer.clientId;
      } else {
        clientId = null;
      }
    } else {
      clientId = storedClientId;
    }

    return clientId;
  }

  private async apiClientSecret(isAdditionalAuthentication = false): Promise<string> {
    const additionalAuthenticationMessage = "Additional authentication required.\nAPI key ";
    let clientSecret: string = null;

    const storedClientSecret: string = this.clientSecret || process.env.BW_CLIENTSECRET;
    if (storedClientSecret == null) {
      if (this.canInteract) {
        const answer: inquirer.Answers = await inquirer.createPromptModule({
          output: process.stderr,
        })({
          type: "input",
          name: "clientSecret",
          message:
            (isAdditionalAuthentication ? additionalAuthenticationMessage : "") + "client_secret:",
        });
        clientSecret = answer.clientSecret;
      } else {
        clientSecret = null;
      }
    } else {
      clientSecret = storedClientSecret;
    }

    return clientSecret;
  }

  private async apiIdentifiers(): Promise<{ clientId: string; clientSecret: string }> {
    return {
      clientId: await this.apiClientId(),
      clientSecret: await this.apiClientSecret(),
    };
  }

  private async openSsoPrompt(
    codeChallenge: string,
    state: string,
  ): Promise<{ ssoCode: string; orgIdentifier: string }> {
    const env = await firstValueFrom(this.environmentService.environment$);

    return new Promise((resolve, reject) => {
      const callbackServer = http.createServer((req, res) => {
        const urlString = "http://localhost" + req.url;
        const url = new URL(urlString);
        const code = url.searchParams.get("code");
        const receivedState = url.searchParams.get("state");
        const orgIdentifier = this.getOrgIdentifierFromState(receivedState);
        res.setHeader("Content-Type", "text/html");
        if (code != null && receivedState != null && this.checkState(receivedState, state)) {
          res.writeHead(200);
          res.end(
            "<html><head><title>Success | Bitwarden CLI</title></head><body>" +
              "<h1>Successfully authenticated with the Bitwarden CLI</h1>" +
              "<p>You may now close this tab and return to the terminal.</p>" +
              "</body></html>",
          );
          callbackServer.close(() =>
            resolve({
              ssoCode: code,
              orgIdentifier: orgIdentifier,
            }),
          );
        } else {
          res.writeHead(400);
          res.end(
            "<html><head><title>Failed | Bitwarden CLI</title></head><body>" +
              "<h1>Something went wrong logging into the Bitwarden CLI</h1>" +
              "<p>You may now close this tab and return to the terminal.</p>" +
              "</body></html>",
          );
          callbackServer.close(() => reject());
        }
      });
      let foundPort = false;
      const webUrl = env.getWebVaultUrl();
      for (let port = 8065; port <= 8070; port++) {
        try {
          this.ssoRedirectUri = "http://localhost:" + port;
          callbackServer.listen(port, () => {
            const webAppSsoUrl = this.ssoUrlService.buildSsoUrl(
              webUrl,
              ClientType.Cli,
              this.ssoRedirectUri,
              state,
              codeChallenge,
            );
            this.platformUtilsService.launchUri(webAppSsoUrl);
          });
          foundPort = true;
          break;
        } catch {
          // Ignore error since we run the same command up to 5 times.
        }
      }
      if (!foundPort) {
        reject();
      }
    });
  }

  private getOrgIdentifierFromState(state: string): string {
    if (state === null || state === undefined) {
      return null;
    }

    const stateSplit = state.split("_identifier=");
    return stateSplit.length > 1 ? stateSplit[1] : null;
  }

  private checkState(state: string, checkState: string): boolean {
    if (state === null || state === undefined) {
      return false;
    }
    if (checkState === null || checkState === undefined) {
      return false;
    }

    const stateSplit = state.split("_identifier=");
    const checkStateSplit = checkState.split("_identifier=");
    return stateSplit[0] === checkStateSplit[0];
  }
}

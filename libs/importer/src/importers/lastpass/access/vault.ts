// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as papa from "papaparse";

import { decodeJwtTokenToJson } from "@bitwarden/auth/common";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { IdpProvider } from "./enums";
import {
  Account,
  ClientInfo,
  ExportedAccount,
  FederatedUserContext,
  ParserOptions,
  UserTypeContext,
} from "./models";
import { Client, CryptoUtils, Parser, RestClient } from "./services";
import { Ui } from "./ui";

export class Vault {
  accounts: Account[];
  userType: UserTypeContext;

  private client: Client;
  private cryptoUtils: CryptoUtils;

  constructor(private cryptoFunctionService: CryptoFunctionService) {
    this.cryptoUtils = new CryptoUtils(cryptoFunctionService);
    const parser = new Parser(cryptoFunctionService, this.cryptoUtils);
    this.client = new Client(parser, this.cryptoUtils);
  }

  async open(
    username: string,
    password: string,
    clientInfo: ClientInfo,
    ui: Ui,
    parserOptions: ParserOptions = ParserOptions.default,
  ): Promise<void> {
    this.accounts = await this.client.openVault(
      username,
      password,
      null,
      clientInfo,
      ui,
      parserOptions,
    );
  }

  async openFederated(
    federatedUser: FederatedUserContext,
    clientInfo: ClientInfo,
    ui: Ui,
    parserOptions: ParserOptions = ParserOptions.default,
  ): Promise<void> {
    if (federatedUser == null) {
      throw new Error("Federated user context is not set.");
    }
    const k1 = await this.getK1(federatedUser);
    const [k2, fragmentId] = await this.getK2FragmentId(federatedUser);
    const hiddenPasswordArr = await this.cryptoFunctionService.hash(
      this.cryptoUtils.ExclusiveOr(k1, k2),
      "sha256",
    );
    const hiddenPassword = Utils.fromBufferToB64(hiddenPasswordArr);
    this.accounts = await this.client.openVault(
      federatedUser.username,
      hiddenPassword,
      fragmentId,
      clientInfo,
      ui,
      parserOptions,
    );
  }

  async setUserTypeContext(username: string) {
    const lowercaseUsername = username.toLowerCase();
    const rest = new RestClient();
    rest.baseUrl = "https://lastpass.com";
    const endpoint = "lmiapi/login/type?username=" + encodeURIComponent(lowercaseUsername);
    const response = await rest.get(endpoint);
    if (response.status === HttpStatusCode.Ok) {
      const json = await response.json();
      this.userType = new UserTypeContext();
      this.userType.companyId = json.CompanyId;
      this.userType.identityProviderGUID = json.IdentityProviderGUID;
      this.userType.identityProviderURL = json.IdentityProviderURL;
      this.userType.isPasswordlessEnabled = json.IsPasswordlessEnabled;
      this.userType.openIDConnectAuthority = json.OpenIDConnectAuthority;
      this.userType.openIDConnectClientId = json.OpenIDConnectClientId;
      this.userType.pkceEnabled = json.PkceEnabled;
      this.userType.provider = json.Provider;
      this.userType.type = json.type;

      if (this.userType.provider === IdpProvider.Azure) {
        // Sometimes customers have malformed OIDC authority URLs. Try to fix them.
        const appQueryIndex = this.userType.openIDConnectAuthority.indexOf("?app");
        if (appQueryIndex > -1) {
          this.userType.openIDConnectAuthority = this.userType.openIDConnectAuthority.substring(
            0,
            appQueryIndex,
          );
        }
      }

      return;
    }
    throw new Error("Cannot determine LastPass user type.");
  }

  accountsToExportedCsvString(skipShared = false): string {
    if (this.accounts == null) {
      throw new Error("Vault has not opened any accounts.");
    }

    const exportedAccounts = this.accounts
      .filter((a) => !a.isShared || (a.isShared && !skipShared))
      .map((a) => new ExportedAccount(a));

    if (exportedAccounts.length === 0) {
      throw new Error("No accounts to transform");
    }
    return papa.unparse(exportedAccounts);
  }

  private async getK1(federatedUser: FederatedUserContext): Promise<Uint8Array> {
    if (this.userType == null) {
      throw new Error("User type is not set.");
    }

    if (!this.userType.isFederated()) {
      throw new Error("Cannot get k1 for LastPass user that is not federated.");
    }

    if (federatedUser == null) {
      throw new Error("Federated user is not set.");
    }

    let k1: Uint8Array = null;
    if (federatedUser.idpUserInfo?.LastPassK1 != null) {
      return Utils.fromByteStringToArray(federatedUser.idpUserInfo.LastPassK1);
    } else if (this.userType.provider === IdpProvider.Azure) {
      k1 = await this.getK1Azure(federatedUser);
    } else if (this.userType.provider === IdpProvider.Google) {
      k1 = await this.getK1Google(federatedUser);
    } else {
      const b64Encoded = this.userType.provider === IdpProvider.PingOne;
      k1 = await this.getK1FromAccessToken(federatedUser, b64Encoded);
    }

    if (k1 != null) {
      return k1;
    }

    throw new Error("Cannot get k1.");
  }

  private async getK1Azure(federatedUser: FederatedUserContext) {
    // Query the Graph API for the k1 field
    const rest = new RestClient();
    rest.baseUrl = "https://graph.microsoft.com";
    const response = await rest.get(
      "v1.0/me?$select=id,displayName,mail&$expand=extensions",
      new Map([["Authorization", "Bearer " + federatedUser.accessToken]]),
    );
    if (response.status === HttpStatusCode.Ok) {
      const json = await response.json();
      if (json?.extensions != null && json.extensions.length > 0) {
        const k1 = json.extensions[0].LastPassK1 as string;
        if (k1 != null) {
          return Utils.fromB64ToArray(k1);
        }
      }
    }
    return null;
  }

  private async getK1Google(federatedUser: FederatedUserContext) {
    // Query Google Drive for the k1.lp file
    const accessTokenAuthHeader = new Map([
      ["Authorization", "Bearer " + federatedUser.accessToken],
    ]);
    const rest = new RestClient();
    rest.baseUrl = "https://content.googleapis.com";
    const response = await rest.get(
      "drive/v3/files?pageSize=1" +
        "&q=name%20%3D%20%27k1.lp%27" +
        "&spaces=appDataFolder" +
        "&fields=nextPageToken%2C%20files(id%2C%20name)",
      accessTokenAuthHeader,
    );
    if (response.status === HttpStatusCode.Ok) {
      const json = await response.json();
      const files = json?.files as any[];
      if (files != null && files.length > 0 && files[0].id != null && files[0].name === "k1.lp") {
        // Open the k1.lp file
        rest.baseUrl = "https://www.googleapis.com";
        const response = await rest.get(
          "drive/v3/files/" + files[0].id + "?alt=media",
          accessTokenAuthHeader,
        );
        if (response.status === HttpStatusCode.Ok) {
          const k1 = await response.text();
          return Utils.fromB64ToArray(k1);
        }
      }
    }
    return null;
  }

  private async getK1FromAccessToken(federatedUser: FederatedUserContext, b64: boolean) {
    const decodedAccessToken = decodeJwtTokenToJson(federatedUser.accessToken);
    const k1 = decodedAccessToken?.LastPassK1 as string;
    if (k1 != null) {
      return b64 ? Utils.fromB64ToArray(k1) : Utils.fromByteStringToArray(k1);
    }
    return null;
  }

  private async getK2FragmentId(
    federatedUser: FederatedUserContext,
  ): Promise<[Uint8Array, string]> {
    if (this.userType == null) {
      throw new Error("User type is not set.");
    }

    if (!this.userType.isFederated()) {
      throw new Error("Cannot get k2 for LastPass user that is not federated.");
    }

    const rest = new RestClient();
    rest.baseUrl = this.userType.identityProviderURL;
    const response = await rest.postJson("federatedlogin/api/v1/getkey", {
      company_id: this.userType.companyId,
      id_token: federatedUser.idToken,
    });
    if (response.status === HttpStatusCode.Ok) {
      const json = await response.json();
      const k2 = json?.k2 as string;
      const fragmentId = json?.fragment_id as string;
      if (k2 != null && fragmentId != null) {
        return [Utils.fromB64ToArray(k2), fragmentId];
      }
    }
    throw new Error("Cannot get k2 and/or fragment ID.");
  }
}

import { ApiService } from "../../../../abstractions/api.service";
import { CryptoService } from "../../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../../platform/abstractions/encrypt.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { StateProvider } from "../../../../platform/state";
import { FASTMAIL_FORWARDER } from "../../key-definitions";
import { ForwarderGeneratorStrategy } from "../forwarder-generator-strategy";
import { Forwarders } from "../options/constants";
import { EmailPrefixOptions, ApiOptions } from "../options/forwarder-options";

/** Generates a forwarding address for Fastmail */
export class FastmailForwarder extends ForwarderGeneratorStrategy<ApiOptions & EmailPrefixOptions> {
  /** Instantiates the forwarder
   *  @param apiService used for ajax requests to the forwarding service
   *  @param i18nService used to look up error strings
   *  @param encryptService protects sensitive forwarder options
   *  @param keyService looks up the user key when protecting data.
   *  @param stateProvider creates the durable state for options storage
   */
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    encryptService: EncryptService,
    keyService: CryptoService,
    stateProvider: StateProvider,
  ) {
    super(encryptService, keyService, stateProvider);
  }

  /** {@link ForwarderGeneratorStrategy.key} */
  get key() {
    return FASTMAIL_FORWARDER;
  }

  /** {@link ForwarderGeneratorStrategy.generate} */
  generate = async (options: ApiOptions & EmailPrefixOptions) => {
    if (!options.token || options.token === "") {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.Fastmail.name);
      throw error;
    }

    const accountId = await this.getAccountId(options);
    if (!accountId || accountId === "") {
      const error = this.i18nService.t("forwarderNoAccountId", Forwarders.Fastmail.name);
      throw error;
    }

    const body = JSON.stringify({
      using: ["https://www.fastmail.com/dev/maskedemail", "urn:ietf:params:jmap:core"],
      methodCalls: [
        [
          "MaskedEmail/set",
          {
            accountId: accountId,
            create: {
              "new-masked-email": {
                state: "enabled",
                description: "",
                forDomain: options.website,
                emailPrefix: options.prefix,
              },
            },
          },
          "0",
        ],
      ],
    });

    const requestInit: RequestInit = {
      redirect: "manual",
      cache: "no-store",
      method: "POST",
      headers: new Headers({
        Authorization: "Bearer " + options.token,
        "Content-Type": "application/json",
      }),
      body,
    };

    const url = "https://api.fastmail.com/jmap/api/";
    const request = new Request(url, requestInit);

    const response = await this.apiService.nativeFetch(request);
    if (response.status === 200) {
      const json = await response.json();
      if (
        json.methodResponses != null &&
        json.methodResponses.length > 0 &&
        json.methodResponses[0].length > 0
      ) {
        if (json.methodResponses[0][0] === "MaskedEmail/set") {
          if (json.methodResponses[0][1]?.created?.["new-masked-email"] != null) {
            return json.methodResponses[0][1]?.created?.["new-masked-email"]?.email;
          }
          if (json.methodResponses[0][1]?.notCreated?.["new-masked-email"] != null) {
            const errorDescription =
              json.methodResponses[0][1]?.notCreated?.["new-masked-email"]?.description;
            const error = this.i18nService.t(
              "forwarderError",
              Forwarders.Fastmail.name,
              errorDescription,
            );
            throw error;
          }
        } else if (json.methodResponses[0][0] === "error") {
          const errorDescription = json.methodResponses[0][1]?.description;
          const error = this.i18nService.t(
            "forwarderError",
            Forwarders.Fastmail.name,
            errorDescription,
          );
          throw error;
        }
      }
    } else if (response.status === 401 || response.status === 403) {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.Fastmail.name);
      throw error;
    }

    const error = this.i18nService.t("forwarderUnknownError", Forwarders.Fastmail.name);
    throw error;
  };

  private async getAccountId(options: ApiOptions): Promise<string> {
    const requestInit: RequestInit = {
      cache: "no-store",
      method: "GET",
      headers: new Headers({
        Authorization: "Bearer " + options.token,
      }),
    };
    const url = "https://api.fastmail.com/.well-known/jmap";
    const request = new Request(url, requestInit);
    const response = await this.apiService.nativeFetch(request);
    if (response.status === 200) {
      const json = await response.json();
      if (json.primaryAccounts != null) {
        return json.primaryAccounts["https://www.fastmail.com/dev/maskedemail"];
      }
    }
    return null;
  }
}

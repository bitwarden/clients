import { ApiService } from "../../../../abstractions/api.service";
import { CryptoService } from "../../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../../platform/abstractions/encrypt.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { StateProvider } from "../../../../platform/state";
import { SIMPLE_LOGIN_FORWARDER } from "../../key-definitions";
import { ForwarderGeneratorStrategy } from "../forwarder-generator-strategy";
import { Forwarders } from "../options/constants";
import { SelfHostedApiOptions } from "../options/forwarder-options";

/** Generates a forwarding address for Simple Login */
export class SimpleLoginForwarder extends ForwarderGeneratorStrategy<SelfHostedApiOptions> {
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
    return SIMPLE_LOGIN_FORWARDER;
  }

  /** {@link ForwarderGeneratorStrategy.generate} */
  generate = async (options: SelfHostedApiOptions) => {
    if (!options.token || options.token === "") {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.SimpleLogin.name);
      throw error;
    }
    if (!options.baseUrl || options.baseUrl === "") {
      const error = this.i18nService.t("forwarderNoUrl", Forwarders.SimpleLogin.name);
      throw error;
    }

    let url = options.baseUrl + "/api/alias/random/new";
    let noteId = "forwarderGeneratedBy";
    if (options.website && options.website !== "") {
      url += "?hostname=" + options.website;
      noteId = "forwarderGeneratedByWithWebsite";
    }
    const note = this.i18nService.t(noteId, options.website ?? "");

    const request = new Request(url, {
      redirect: "manual",
      cache: "no-store",
      method: "POST",
      headers: new Headers({
        Authentication: options.token,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ note }),
    });

    const response = await this.apiService.nativeFetch(request);
    if (response.status === 401) {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.SimpleLogin.name);
      throw error;
    }

    const json = await response.json();
    if (response.status === 200 || response.status === 201) {
      return json.alias;
    } else if (json?.error) {
      const error = this.i18nService.t("forwarderError", Forwarders.SimpleLogin.name, json.error);
      throw error;
    } else {
      const error = this.i18nService.t("forwarderUnknownError", Forwarders.SimpleLogin.name);
      throw error;
    }
  };
}

import { ApiService } from "../../../../abstractions/api.service";
import { CryptoService } from "../../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../../platform/abstractions/encrypt.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { StateProvider } from "../../../../platform/state";
import { FIREFOX_RELAY_FORWARDER } from "../../key-definitions";
import { ForwarderGeneratorStrategy } from "../forwarder-generator-strategy";
import { Forwarders } from "../options/constants";
import { ApiOptions } from "../options/forwarder-options";

/** Generates a forwarding address for Firefox Relay */
export class FirefoxRelayForwarder extends ForwarderGeneratorStrategy<ApiOptions> {
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
    return FIREFOX_RELAY_FORWARDER;
  }

  /** {@link ForwarderGeneratorStrategy.generate} */
  generate = async (options: ApiOptions) => {
    if (!options.token || options.token === "") {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.FirefoxRelay.name);
      throw error;
    }

    const url = "https://relay.firefox.com/api/v1/relayaddresses/";

    let descriptionId = "forwarderGeneratedByWithWebsite";
    if (!options.website || options.website === "") {
      descriptionId = "forwarderGeneratedBy";
    }
    const description = this.i18nService.t(descriptionId, options.website ?? "");

    const request = new Request(url, {
      redirect: "manual",
      cache: "no-store",
      method: "POST",
      headers: new Headers({
        Authorization: "Token " + options.token,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        enabled: true,
        generated_for: options.website,
        description,
      }),
    });

    const response = await this.apiService.nativeFetch(request);
    if (response.status === 401) {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.FirefoxRelay.name);
      throw error;
    } else if (response.status === 200 || response.status === 201) {
      const json = await response.json();
      return json.full_address;
    } else {
      const error = this.i18nService.t("forwarderUnknownError", Forwarders.FirefoxRelay.name);
      throw error;
    }
  };
}

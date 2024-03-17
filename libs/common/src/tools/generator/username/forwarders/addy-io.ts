import { ApiService } from "../../../../abstractions/api.service";
import { CryptoService } from "../../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../../platform/abstractions/encrypt.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { StateProvider } from "../../../../platform/state";
import { ADDY_IO_FORWARDER } from "../../key-definitions";
import { ForwarderGeneratorStrategy } from "../forwarder-generator-strategy";
import { Forwarders } from "../options/constants";
import { EmailDomainOptions, SelfHostedApiOptions } from "../options/forwarder-options";

/** Generates a forwarding address for addy.io (formerly anon addy) */
export class AddyIoForwarder extends ForwarderGeneratorStrategy<
  SelfHostedApiOptions & EmailDomainOptions
> {
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
    return ADDY_IO_FORWARDER;
  }

  /** {@link ForwarderGeneratorStrategy.generate} */
  generate = async (options: SelfHostedApiOptions & EmailDomainOptions) => {
    if (!options.token || options.token === "") {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.AddyIo.name);
      throw error;
    }
    if (!options.domain || options.domain === "") {
      const error = this.i18nService.t("forwarderNoDomain", Forwarders.AddyIo.name);
      throw error;
    }
    if (!options.baseUrl || options.baseUrl === "") {
      const error = this.i18nService.t("forwarderNoUrl", Forwarders.AddyIo.name);
      throw error;
    }

    let descriptionId = "forwarderGeneratedByWithWebsite";
    if (!options.website || options.website === "") {
      descriptionId = "forwarderGeneratedBy";
    }
    const description = this.i18nService.t(descriptionId, options.website ?? "");

    const url = options.baseUrl + "/api/v1/aliases";
    const request = new Request(url, {
      redirect: "manual",
      cache: "no-store",
      method: "POST",
      headers: new Headers({
        Authorization: "Bearer " + options.token,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      }),
      body: JSON.stringify({
        domain: options.domain,
        description,
      }),
    });

    const response = await this.apiService.nativeFetch(request);
    if (response.status === 200 || response.status === 201) {
      const json = await response.json();
      return json?.data?.email;
    } else if (response.status === 401) {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.AddyIo.name);
      throw error;
    } else if (response?.statusText) {
      const error = this.i18nService.t(
        "forwarderError",
        Forwarders.AddyIo.name,
        response.statusText,
      );
      throw error;
    } else {
      const error = this.i18nService.t("forwarderUnknownError", Forwarders.AddyIo.name);
      throw error;
    }
  };
}

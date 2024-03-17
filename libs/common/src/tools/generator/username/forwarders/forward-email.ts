import { ApiService } from "../../../../abstractions/api.service";
import { CryptoService } from "../../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../../platform/abstractions/encrypt.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { Utils } from "../../../../platform/misc/utils";
import { StateProvider } from "../../../../platform/state";
import { FORWARD_EMAIL_FORWARDER } from "../../key-definitions";
import { ForwarderGeneratorStrategy } from "../forwarder-generator-strategy";
import { Forwarders } from "../options/constants";
import { EmailDomainOptions, ApiOptions } from "../options/forwarder-options";

/** Generates a forwarding address for Forward Email */
export class ForwardEmailForwarder extends ForwarderGeneratorStrategy<
  ApiOptions & EmailDomainOptions
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
    return FORWARD_EMAIL_FORWARDER;
  }

  /** {@link ForwarderGeneratorStrategy.generate} */
  generate = async (options: ApiOptions & EmailDomainOptions) => {
    if (!options.token || options.token === "") {
      const error = this.i18nService.t("forwaderInvalidToken", Forwarders.ForwardEmail.name);
      throw error;
    }
    if (!options.domain || options.domain === "") {
      const error = this.i18nService.t("forwarderNoDomain", Forwarders.ForwardEmail.name);
      throw error;
    }

    const url = `https://api.forwardemail.net/v1/domains/${options.domain}/aliases`;

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
        Authorization: "Basic " + Utils.fromUtf8ToB64(options.token + ":"),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        labels: options.website,
        description,
      }),
    });

    const response = await this.apiService.nativeFetch(request);
    const json = await response.json();

    if (response.status === 401) {
      const messageKey =
        "message" in json ? "forwaderInvalidTokenWithMessage" : "forwaderInvalidToken";
      const error = this.i18nService.t(messageKey, Forwarders.ForwardEmail.name, json.message);
      throw error;
    } else if (response.status === 200 || response.status === 201) {
      const { name, domain } = await response.json();
      const domainPart = domain?.name || options.domain;
      return `${name}@${domainPart}`;
    } else if (json?.message) {
      const error = this.i18nService.t(
        "forwarderError",
        Forwarders.ForwardEmail.name,
        json.message,
      );
      throw error;
    } else if (json?.error) {
      const error = this.i18nService.t("forwarderError", Forwarders.ForwardEmail.name, json.error);
      throw error;
    } else {
      const error = this.i18nService.t("forwarderUnknownError", Forwarders.ForwardEmail.name);
      throw error;
    }
  };
}

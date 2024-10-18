import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ApiSettings,
  IntegrationRequest,
  RestClient,
} from "@bitwarden/common/tools/integration/rpc";
import { GenerationRequest } from "@bitwarden/common/tools/types";

import { CredentialGenerator, GeneratedCredential } from "../types";

import { AccountRequest, ForwarderConfiguration } from "./forwarder-configuration";
import { ForwarderContext } from "./forwarder-context";
import { CreateForwardingAddressRpc, GetAccountIdRpc } from "./rpc";

/** Generation algorithms that produce randomized email addresses */
export class Forwarder implements CredentialGenerator<ApiSettings> {
  /** Instantiates the email randomizer
   *  @param random data source for random data
   */
  constructor(
    private configuration: ForwarderConfiguration<ApiSettings>,
    private client: RestClient,
    private i18nService: I18nService,
  ) {}

  async generate(request: GenerationRequest, settings: ApiSettings) {
    const requestOptions: IntegrationRequest & AccountRequest = { website: request.website };

    const getAccount = await this.getAccountId(this.configuration, settings);
    if (getAccount) {
      requestOptions.accountId = await this.client.fetchJson(getAccount, requestOptions);
    }

    const create = this.createForwardingAddress(this.configuration, settings);
    const result = await this.client.fetchJson(create, requestOptions);
    const id = { forwarder: this.configuration.id };

    return new GeneratedCredential(result, id, Date.now());
  }

  private createContext<Settings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    return new ForwarderContext(configuration, settings, this.i18nService);
  }

  private createForwardingAddress<Settings extends ApiSettings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    const context = this.createContext(configuration, settings);
    const rpc = new CreateForwardingAddressRpc<Settings>(configuration, context);
    return rpc;
  }

  private getAccountId<Settings extends ApiSettings>(
    configuration: ForwarderConfiguration<Settings>,
    settings: Settings,
  ) {
    if (!configuration.forwarder.getAccountId) {
      return null;
    }

    const context = this.createContext(configuration, settings);
    const rpc = new GetAccountIdRpc<Settings>(configuration, context);

    return rpc;
  }
}

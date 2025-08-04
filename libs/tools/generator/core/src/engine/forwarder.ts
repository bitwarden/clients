// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ApiSettings,
  IntegrationRequest,
  RestClient,
} from "@bitwarden/common/tools/integration/rpc";
import { GenerationRequest } from "@bitwarden/common/tools/types";

import { Type } from "../metadata";
import { CredentialGenerator, GeneratedCredential } from "../types";

import { AccountRequest, ForwarderConfiguration } from "./forwarder-configuration";
import { ForwarderContext } from "./forwarder-context";
import { CreateForwardingAddressRpc, GetAccountIdRpc } from "./rpc";

/** Generation algorithms that query an email forwarding service to
 *  create anonymized email addresses.
 */
export class Forwarder implements CredentialGenerator<ApiSettings> {
  /** Instantiates the email forwarder engine
   *  @param configuration The forwarder to query
   *  @param client requests data from the forwarding service
   *  @param i18nService localizes messages sent to the forwarding service
   *   and user-addressable errors
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

    return new GeneratedCredential(result, Type.email, Date.now());
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

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { IntegrationContext } from "@bitwarden/common/tools/integration";
import { JsonRpc, IntegrationRequest, ApiSettings } from "@bitwarden/common/tools/integration/rpc";

import { ForwarderConfiguration } from "../forwarder-configuration";
import { ForwarderContext } from "../forwarder-context";

export class GetAccountIdRpc<
  Settings extends ApiSettings,
  Req extends IntegrationRequest = IntegrationRequest,
> implements JsonRpc<Req, string>
{
  constructor(
    readonly requestor: ForwarderConfiguration<Settings>,
    readonly context: ForwarderContext<Settings>,
  ) {}

  hasJsonPayload(response: Response) {
    return this.requestor.forwarder.getAccountId.hasJsonPayload(response, this.context);
  }

  processJson(json: any) {
    return this.requestor.forwarder.getAccountId.processJson(json, this.context);
  }

  toRequest(req: Req) {
    const url = this.requestor.forwarder.getAccountId.url(req, this.context);
    const token = this.requestor.authenticate(req, this.context as IntegrationContext<Settings>);

    const request = new Request(url, {
      redirect: "manual",
      cache: "no-store",
      method: "GET",
      headers: new Headers({
        ...token,
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
    });

    return request;
  }
}

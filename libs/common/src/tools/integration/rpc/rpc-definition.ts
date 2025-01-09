import { IntegrationRequest } from "./integration-request";

/** Defines how an integration processes an RPC call.
 *  @remarks This interface should not be used directly. Your integration should specialize
 *  it to fill a specific use-case. For example, the forwarder provides two specializations as follows:
 *
 *  // optional; supplements the `IntegrationRequest` with an integrator-supplied account Id
 *  type GetAccountId = RpcConfiguration<IntegrationRequest, ForwarderContext<Settings>, ForwarderRequest>
 *
 *  // generates a forwarding address
 *  type CreateForwardingEmail = RpcConfiguration<ForwarderRequest, ForwarderContext<Settings>, string>
 */
export interface RpcConfiguration<Request extends IntegrationRequest, Helper, Result> {
  /** determine the URL of the lookup
   *  @param request describes the state of the integration site
   *  @param helper supplies logic from bitwarden specific to the integration site
   */
  url(request: Request, helper: Helper): string;

  /** format the body of the rpc call; when this method is not supplied, the request omits the body
   *  @param request describes the state of the integration site
   *  @param helper supplies logic from bitwarden specific to the integration site
   *  @returns a JSON object supplied as the body of the request
   */
  body?(request: Request, helper: Helper): any;

  /** returns true when there's a JSON payload to process
   *  @param response the fetch API response returned by the RPC call
   *  @param helper supplies logic from bitwarden specific to the integration site
   */
  hasJsonPayload(response: Response, helper: Helper): boolean;

  /** map body parsed as json payload of the rpc call.
   *  @param json the object to map
   *  @param helper supplies logic from bitwarden specific to the integration site
   *  @returns When the JSON is processed successfully, a 1-tuple whose value is the processed result.
   *  Otherwise, a 2-tuple whose first value is undefined, and whose second value is an error message.
   */
  processJson(json: any, helper: Helper): [Result?, string?];
}

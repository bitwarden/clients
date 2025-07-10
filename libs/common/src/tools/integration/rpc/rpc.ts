import { IntegrationMetadata } from "../integration-metadata";

import { IntegrationRequest } from "./integration-request";

/** A runtime RPC request that returns a JSON-encoded payload.
 */
export interface JsonRpc<Parameters extends IntegrationRequest, Result> {
  /** information about the integration requesting RPC */
  requestor: Readonly<IntegrationMetadata>;

  /** creates a fetch request for the RPC
   *  @param request describes the state of the integration site
   */
  toRequest(request: Parameters): Request;

  /** returns true when there should be a JSON payload to process
   *  @param response the fetch API response returned by the RPC call
   */
  hasJsonPayload(response: Response): boolean;

  /** processes the json payload
   * @param json the object to map
   * @returns on success returns [Result], on failure returns [undefined, string]
   */
  processJson(json: any): [Result?, string?];
}

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../../abstractions/api.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";

import { IntegrationRequest } from "./integration-request";
import { JsonRpc } from "./rpc";

/** Makes remote procedure calls using a RESTful interface. */
export class RestClient {
  constructor(
    private api: ApiService,
    private i18n: I18nService,
  ) {}

  /** uses the fetch API to request a JSON payload. */
  // FIXME: once legacy password generator is removed, replace forwarder-specific error
  //   messages with RPC-generalized ones.
  async fetchJson<Parameters extends IntegrationRequest, Result>(
    rpc: JsonRpc<Parameters, Result>,
    params: Parameters,
  ): Promise<Result> {
    // run the request
    const request = rpc.toRequest(params);
    const response = await this.api.nativeFetch(request);

    let result: Result = undefined;
    let errorKey: string = undefined;
    let errorMessage: string = undefined;

    const commonError = await this.detectCommonErrors(response);
    if (commonError) {
      [errorKey, errorMessage] = commonError;
    } else if (rpc.hasJsonPayload(response)) {
      [result, errorMessage] = rpc.processJson(await response.json());
    }

    if (result) {
      return result;
    }

    // handle failures
    errorKey ??= errorMessage ? "forwarderError" : "forwarderUnknownError";
    const error = this.i18n.t(errorKey, rpc.requestor.name, errorMessage);
    throw error;
  }

  private async detectCommonErrors(response: Response): Promise<[string, string] | undefined> {
    if (response.status === 401) {
      const message = await this.tryGetErrorMessage(response);
      const key = message ? "forwaderInvalidTokenWithMessage" : "forwaderInvalidToken";
      return [key, message];
    } else if (response.status === 403) {
      const message = await this.tryGetErrorMessage(response);
      const key = message ? "forwaderInvalidOperationWithMessage" : "forwaderInvalidOperation";
      return [key, message];
    } else if (response.status >= 400) {
      const message = await this.tryGetErrorMessage(response);
      const key = message ? "forwarderError" : "forwarderUnknownError";
      return [key, message];
    }
  }

  private async tryGetErrorMessage(response: Response) {
    const body = (await response.text()) ?? "";

    // nullish continues processing; false returns undefined
    // FIXME: inspect content-type header to determine extraction process
    const error =
      this.tryFindErrorAsJson(body) ?? this.tryFindErrorAsText(body) ?? response.statusText;

    return error || undefined;
  }

  private tryFindErrorAsJson(body: string) {
    // tryParse JSON object or string
    const parsable = body.startsWith("{") || body.startsWith(`'`) || body.startsWith(`"`);
    if (!parsable) {
      // fail-and-continue because it's not JSON
      return undefined;
    }
    let parsed = undefined;
    try {
      parsed = JSON.parse(body);
    } catch {
      // fail-and-exit in case `body` is malformed JSON
      return false;
    }

    // could be a string
    if (parsed && typeof parsed === "string") {
      return parsed;
    }

    // could be { error?: T, message?: U }
    const error = parsed.error?.toString() ?? null;
    const message = parsed.message?.toString() ?? null;

    // `false` signals no message found
    const result = error && message ? `${error}: ${message}` : (error ?? message ?? false);

    return result;
  }

  private tryFindErrorAsText(body: string) {
    if (!body.length || body.includes("<")) {
      return undefined;
    }

    return body;
  }
}

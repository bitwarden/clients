import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import { ApiSettings, IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";

import {
  ForwarderConfiguration,
  ForwarderContext,
  EmailDomainSettings,
  AccountRequest,
  EmailPrefixSettings,
} from "../engine";
import { CreateForwardingEmailRpcDef, GetAccountIdRpcDef } from "../engine/forwarder-configuration";
import { ApiOptions, EmailPrefixOptions } from "../types";

// integration types
export type FastmailSettings = ApiSettings & EmailPrefixSettings & EmailDomainSettings;
export type FastmailOptions = ApiOptions & EmailPrefixOptions & AccountRequest;
export type FastmailRequest = IntegrationRequest & AccountRequest;
export type FastmailConfiguration = ForwarderConfiguration<FastmailSettings, FastmailRequest>;

// default values
const defaultSettings = Object.freeze({
  domain: "",
  prefix: "",
  token: "",
});

// supported RPC calls
const getAccountId = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<FastmailSettings>) {
    // cannot use "/.well-known/jmap" because integration RPCs
    // never follow redirects
    return context.baseUrl() + "/jmap/session";
  },
  hasJsonPayload(response: Response) {
    return response.status === 200;
  },
  processJson(json: any, context: ForwarderContext<FastmailSettings>) {
    const result = json.primaryAccounts?.["https://www.fastmail.com/dev/maskedemail"] ?? undefined;

    return [result, result ? undefined : context.missingAccountIdCause()];
  },
} as GetAccountIdRpcDef<FastmailSettings>);

const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<FastmailSettings>) {
    return context.baseUrl() + "/jmap/api/";
  },
  body(request: FastmailRequest, context: ForwarderContext<FastmailSettings>) {
    const body = {
      using: ["https://www.fastmail.com/dev/maskedemail", "urn:ietf:params:jmap:core"],
      methodCalls: [
        [
          "MaskedEmail/set",
          {
            accountId: request.accountId,
            create: {
              "new-masked-email": {
                state: "enabled",
                description: "",
                forDomain: context.website(request),
                emailPrefix: "",
              },
            },
          },
          "0",
        ],
      ],
    };

    return body;
  },
  hasJsonPayload(response: Response) {
    return response.status === 200;
  },
  processJson(json: any): [string?, string?] {
    if (
      json.methodResponses != null &&
      json.methodResponses.length > 0 &&
      json.methodResponses[0].length > 0
    ) {
      if (json.methodResponses[0][0] === "MaskedEmail/set") {
        if (json.methodResponses[0][1]?.created?.["new-masked-email"] != null) {
          const email: string = json.methodResponses[0][1]?.created?.["new-masked-email"]?.email;
          return [email];
        }
        if (json.methodResponses[0][1]?.notCreated?.["new-masked-email"] != null) {
          const errorDescription: string =
            json.methodResponses[0][1]?.notCreated?.["new-masked-email"]?.description;
          return [undefined, errorDescription];
        }
      } else if (json.methodResponses[0][0] === "error") {
        const errorDescription: string = json.methodResponses[0][1]?.description;
        return [undefined, errorDescription];
      }
    }
  },
} as CreateForwardingEmailRpcDef<FastmailSettings, FastmailRequest>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  settings: new UserKeyDefinition<FastmailSettings>(GENERATOR_DISK, "fastmailForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<FastmailSettings>(GENERATOR_DISK, "fastmailBuffer", {
    deserializer: (value) => value,
    clearOn: ["logout"],
  }),
  createForwardingEmail,
  getAccountId,
} as const);

// integration-wide configuration
export const Fastmail = Object.freeze({
  id: "fastmail" as IntegrationId,
  name: "Fastmail",
  baseUrl: "https://api.fastmail.com",
  selfHost: "maybe",
  extends: ["forwarder"],
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },
  forwarder,
} as FastmailConfiguration);

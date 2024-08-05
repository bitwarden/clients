import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import {
  ApiSettings,
  IntegrationRequest,
  SelfHostedApiSettings,
} from "@bitwarden/common/tools/integration/rpc";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";

import { ForwarderConfiguration, ForwarderContext } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { SelfHostedApiOptions } from "../types";

// integration types
export type SimpleLoginSettings = SelfHostedApiSettings;
export type SimpleLoginOptions = SelfHostedApiOptions;
export type SimpleLoginConfiguration = ForwarderConfiguration<SimpleLoginSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
  domain: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(request: IntegrationRequest, context: ForwarderContext<SimpleLoginSettings>) {
    const endpoint = context.baseUrl() + "/api/alias/random/new";
    const hostname = context.website(request);
    const url = hostname !== "" ? `${endpoint}?hostname=${hostname}` : endpoint;

    return url;
  },
  body(request: IntegrationRequest, context: ForwarderContext<SimpleLoginSettings>) {
    return { note: context.generatedBy(request) };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [json?.alias];
  },
} as CreateForwardingEmailRpcDef<SimpleLoginSettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  settings: new UserKeyDefinition<SimpleLoginSettings>(GENERATOR_DISK, "simpleLoginForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<SimpleLoginSettings>(
    GENERATOR_DISK,
    "simpleLoginBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
  createForwardingEmail,
} as const);

// integration-wide configuration
export const SimpleLogin = Object.freeze({
  id: "simplelogin" as IntegrationId,
  name: "SimpleLogin",
  selfHost: "maybe",
  extends: ["forwarder"],
  baseUrl: "https://app.simplelogin.io",
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authentication: context.authenticationToken() };
  },
  forwarder,
} as SimpleLoginConfiguration);

import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { IntegrationContext, IntegrationId } from "@bitwarden/common/tools/integration";
import { ApiSettings, IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { ForwarderConfiguration, ForwarderContext } from "../engine";
import { CreateForwardingEmailRpcDef } from "../engine/forwarder-configuration";
import { ApiOptions } from "../types";

// integration types
export type FirefoxRelaySettings = ApiSettings;
export type FirefoxRelayOptions = ApiOptions;
export type FirefoxRelayConfiguration = ForwarderConfiguration<FirefoxRelaySettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
} as FirefoxRelaySettings);

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<FirefoxRelaySettings>) {
    return context.baseUrl() + "/v1/relayaddresses/";
  },
  body(request: IntegrationRequest, context: ForwarderContext<FirefoxRelaySettings>) {
    return {
      enabled: true,
      generated_for: context.website(request),
      description: context.generatedBy(request),
    };
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [json.full_address];
  },
} as CreateForwardingEmailRpcDef<FirefoxRelaySettings>);

// forwarder configuration
const forwarder = Object.freeze({
  defaultSettings,
  createForwardingEmail,
  request: ["token"],
  settingsConstraints: {
    token: { required: true },
  },
  local: {
    settings: {
      // FIXME: integration should issue keys at runtime
      // based on integrationId & extension metadata
      // e.g. key: "forwarder.Firefox.local.settings",
      key: "firefoxRelayForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<FirefoxRelaySettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<FirefoxRelaySettings>,
    import: {
      key: "forwarder.Firefox.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<FirefoxRelaySettings>(["token"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<FirefoxRelaySettings, Record<string, never>, FirefoxRelaySettings>,
  },
  settings: new UserKeyDefinition<FirefoxRelaySettings>(GENERATOR_DISK, "firefoxRelayForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<FirefoxRelaySettings>(
    GENERATOR_DISK,
    "firefoxRelayBuffer",
    {
      deserializer: (value) => value,
      clearOn: ["logout"],
    },
  ),
} as const);

// integration-wide configuration
export const FirefoxRelay = Object.freeze({
  id: "firefoxrelay" as IntegrationId,
  name: "Firefox Relay",
  baseUrl: "https://relay.firefox.com/api",
  selfHost: "never",
  extends: ["forwarder"],
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Token " + context.authenticationToken() };
  },
  forwarder,
} as FirefoxRelayConfiguration);

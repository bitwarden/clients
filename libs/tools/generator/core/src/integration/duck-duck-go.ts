import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { VendorId } from "@bitwarden/common/tools/extension";
import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
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
export type DuckDuckGoSettings = ApiSettings;
export type DuckDuckGoOptions = ApiOptions;
export type DuckDuckGoConfiguration = ForwarderConfiguration<DuckDuckGoSettings>;

// default values
const defaultSettings = Object.freeze({
  token: "",
});

// supported RPC calls
const createForwardingEmail = Object.freeze({
  url(_request: IntegrationRequest, context: ForwarderContext<DuckDuckGoSettings>) {
    return context.baseUrl() + "/email/addresses";
  },
  body(_request: IntegrationRequest, _context: ForwarderContext<DuckDuckGoSettings>) {
    return undefined;
  },
  hasJsonPayload(response: Response) {
    return response.status === 200 || response.status === 201;
  },
  processJson(json: any) {
    return [`${json.address}@duck.com`];
  },
} as CreateForwardingEmailRpcDef<DuckDuckGoSettings>);

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
      // e.g. key: "forwarder.DuckDuckGo.local.settings",
      key: "duckDuckGoForwarder",
      target: "object",
      format: "secret-state",
      frame: 512,
      classifier: new PrivateClassifier<DuckDuckGoSettings>(),
      state: GENERATOR_DISK,
      initial: defaultSettings,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<DuckDuckGoSettings>,
    import: {
      key: "forwarder.DuckDuckGo.local.import",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<DuckDuckGoSettings>(["token"]),
      state: GENERATOR_MEMORY,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout", "lock"],
      },
    } satisfies ObjectKey<DuckDuckGoSettings, Record<string, never>, DuckDuckGoSettings>,
  },
  settings: new UserKeyDefinition<DuckDuckGoSettings>(GENERATOR_DISK, "duckDuckGoForwarder", {
    deserializer: (value) => value,
    clearOn: [],
  }),
  importBuffer: new BufferedKeyDefinition<DuckDuckGoSettings>(GENERATOR_DISK, "duckDuckGoBuffer", {
    deserializer: (value) => value,
    clearOn: ["logout"],
  }),
} as const);

// integration-wide configuration
export const DuckDuckGo = Object.freeze({
  id: Vendor.duckduckgo as IntegrationId & VendorId,
  name: "DuckDuckGo",
  baseUrl: "https://quack.duckduckgo.com/api",
  selfHost: "never",
  extends: ["forwarder"],
  authenticate(_request: IntegrationRequest, context: IntegrationContext<ApiSettings>) {
    return { Authorization: "Bearer " + context.authenticationToken() };
  },
  forwarder,
} as DuckDuckGoConfiguration);

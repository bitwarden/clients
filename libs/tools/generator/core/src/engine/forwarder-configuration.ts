import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { IntegrationConfiguration } from "@bitwarden/common/tools/integration/integration-configuration";
import { ApiSettings, SelfHostedApiSettings } from "@bitwarden/common/tools/integration/rpc";
import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc/integration-request";
import { RpcConfiguration } from "@bitwarden/common/tools/integration/rpc/rpc-definition";
import { BufferedKeyDefinition } from "@bitwarden/common/tools/state/buffered-key-definition";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";
import { Constraints } from "@bitwarden/common/tools/types";

import { ForwarderContext } from "./forwarder-context";
import { EmailDomainSettings, EmailPrefixSettings } from "./settings";

/** Mixin for transmitting `getAccountId` result. */
export type AccountRequest = {
  accountId?: string;
};

/** definition of the create forwarding request api call for an integration */
export type CreateForwardingEmailRpcDef<
  Settings extends ApiSettings,
  Request extends IntegrationRequest = IntegrationRequest,
> = RpcConfiguration<Request, ForwarderContext<Settings>, string>;

/** definition of the get account id api call for an integration */
export type GetAccountIdRpcDef<
  Settings extends ApiSettings,
  Request extends IntegrationRequest = IntegrationRequest,
> = RpcConfiguration<Request, ForwarderContext<Settings>, string>;

export type ForwarderRequestFields = keyof (ApiSettings &
  SelfHostedApiSettings &
  EmailDomainSettings &
  EmailPrefixSettings);

/** Forwarder-specific static definition */
export type ForwarderConfiguration<
  // FIXME: simply forwarder settings to an object that has all
  //   settings properties. The runtime dynamism should be limited
  //   to which have values, not which have properties listed.
  Settings extends ApiSettings,
  Request extends IntegrationRequest = IntegrationRequest,
> = IntegrationConfiguration & {
  /** forwarder endpoint definition */
  forwarder: {
    /** default value of all fields */
    defaultSettings: Partial<Settings>;

    settingsConstraints: Constraints<Settings>;

    /** Well-known fields to display on the forwarder screen */
    request: readonly ForwarderRequestFields[];

    /** forwarder settings storage
     * @deprecated use local.settings instead
     */
    settings: UserKeyDefinition<Settings>;

    /** forwarder settings import buffer; `undefined` when there is no buffer.
     * @deprecated use local.settings import
     */
    importBuffer?: BufferedKeyDefinition<Settings>;

    /** locally stored data; forwarder-partitioned */
    local: {
      /** integration settings storage */
      settings: ObjectKey<Settings>;

      /** plaintext import buffer - used during data migrations */
      import?: ObjectKey<Settings, Record<string, never>, Settings>;
    };

    /** createForwardingEmail RPC definition */
    createForwardingEmail: CreateForwardingEmailRpcDef<Settings, Request>;

    /** getAccountId RPC definition; the response updates `accountId` which has a
     *  structural mixin type `RequestAccount`.
     */
    getAccountId?: GetAccountIdRpcDef<Settings, Request>;
  };
};

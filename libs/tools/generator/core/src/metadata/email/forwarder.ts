import { ExtensionMetadata, ExtensionStorageKey } from "@bitwarden/common/tools/extension/type";
import { SelfHostedApiSettings } from "@bitwarden/common/tools/integration/rpc";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";

import { getForwarderConfiguration } from "../../data";
import { EmailDomainSettings, EmailPrefixSettings } from "../../engine";
import { Forwarder } from "../../engine/forwarder";
import { GeneratorDependencyProvider } from "../../types";
import { Profile, Type } from "../data";
import { GeneratorMetadata } from "../generator-metadata";
import { ForwarderProfileMetadata } from "../profile-metadata";

// These options are used by all forwarders; each forwarder uses a different set,
// as defined by `GeneratorMetadata<T>.capabilities.fields`.
type ForwarderOptions = Partial<EmailDomainSettings & EmailPrefixSettings & SelfHostedApiSettings>;

// update the extension metadata
export function toForwarderMetadata(
  extension: ExtensionMetadata,
): GeneratorMetadata<ForwarderOptions> {
  if (extension.site.id !== "forwarder") {
    throw new Error(
      `expected forwarder extension; received ${extension.site.id} (${extension.product.vendor.id})`,
    );
  }

  const name = { literal: extension.product.name ?? extension.product.vendor.name };

  const generator: GeneratorMetadata<ForwarderOptions> = {
    id: { forwarder: extension.product.vendor.id },
    category: Type.email,
    weight: 300,
    i18nKeys: {
      name,
      description: "forwardedEmailDesc",
      generateCredential: "generateEmail",
      credentialGenerated: "emailGenerated",
      useCredential: "useThisEmail",
      credentialType: "email",
      copyCredential: "copyEmail",
    },
    capabilities: {
      autogenerate: false,
      fields: [...extension.requestedFields],
    },
    engine: {
      create(dependencies: GeneratorDependencyProvider) {
        const config = getForwarderConfiguration(extension.product.vendor.id);
        return new Forwarder(config, dependencies.client, dependencies.i18nService);
      },
    },
    profiles: {
      [Profile.account]: {
        type: "extension",
        site: "forwarder",
        storage: {
          key: "forwarder",
          frame: 512,
          options: {
            deserializer: (value) => value,
            clearOn: ["logout"],
          },
        } satisfies ExtensionStorageKey<ForwarderOptions>,
        constraints: {
          default: {},
          create() {
            return new IdentityConstraint<ForwarderOptions>();
          },
        },
      } satisfies ForwarderProfileMetadata<ForwarderOptions>,
    },
  };

  return generator;
}

import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { deepFreeze } from "@bitwarden/common/tools/util";
import { Constraints, StateConstraints } from "@bitwarden/common/tools/types";

import { GeneratorDependencyProvider } from "../../providers";
import {
  CredentialGenerator,
  GenerateRequest,
  GeneratedCredential,
  LoginEmailGenerationOptions,
} from "../../types";
import { Algorithm, Type, Profile } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

/** Constraint that seeds the email from the active account's verified email address */
class LoginEmailConstraints implements StateConstraints<LoginEmailGenerationOptions> {
  constructor(readonly email: string) {}

  constraints: Readonly<Constraints<LoginEmailGenerationOptions>> = {};

  adjust(state: LoginEmailGenerationOptions): LoginEmailGenerationOptions {
    if ((state.email ?? "").trim() !== "") {
      return state;
    }
    return { ...state, email: this.email };
  }

  fix(state: LoginEmailGenerationOptions): LoginEmailGenerationOptions {
    return state;
  }
}

/** Engine that generates a credential from the stored login email setting */
class LoginEmailEngine implements CredentialGenerator<LoginEmailGenerationOptions> {
  async generate(
    request: GenerateRequest,
    settings: LoginEmailGenerationOptions,
  ): Promise<GeneratedCredential> {
    const email = (settings.email ?? "").trim();
    if (!email) {
      throw new Error("Cannot generate login email without a verified account email.");
    }
    return new GeneratedCredential(email, Type.email, new Date(), request.source, request.website);
  }
}

const loginEmail: GeneratorMetadata<LoginEmailGenerationOptions> = deepFreeze({
  id: Algorithm.loginEmail,
  type: Type.email,
  weight: 220,
  i18nKeys: {
    name: "loginEmail",
    description: "loginEmailDesc",
    credentialType: "email",
    generateCredential: "generateEmail",
    credentialGenerated: "emailGenerated",
    copyCredential: "copyEmail",
    useCredential: "useThisEmail",
  },
  capabilities: {
    autogenerate: true,
    fields: [],
  },
  engine: {
    create(_dependencies: GeneratorDependencyProvider): CredentialGenerator<LoginEmailGenerationOptions> {
      return new LoginEmailEngine();
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "loginEmailGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<LoginEmailGenerationOptions>(["email"]),
        state: GENERATOR_DISK,
        initial: { email: "" },
        options: {
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      },
      constraints: {
        default: {},
        create(_policies, context) {
          return new LoginEmailConstraints(context.email ?? "");
        },
      },
    },
  },
});

export default loginEmail;

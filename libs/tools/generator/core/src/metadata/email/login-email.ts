import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { deepFreeze } from "@bitwarden/common/tools/util";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";
import { firstValueFrom } from "rxjs";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import {
  CredentialGenerator,
  GenerateRequest,
  GeneratedCredential,
} from "../../types";
import { Algorithm, Type, Profile } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

import { GeneratorDependencyProvider } from "../../providers";

class LoginEmailEngine implements CredentialGenerator<object> {
  constructor(private accountService?: AccountService) {}

  async generate(request: GenerateRequest, settings: object): Promise<GeneratedCredential> {
    const account = this.accountService
      ? await firstValueFrom(this.accountService.activeAccount$)
      : null;

    if (!account?.email) {
      throw new Error("Cannot generate login email without an active account.");
    }

    return new GeneratedCredential(
      account.email,
      Type.email,
      new Date(),
      request.source,
      request.website,
    );
  }
}

const loginEmail: GeneratorMetadata<object> = deepFreeze({
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
    create(dependencies: GeneratorDependencyProvider): CredentialGenerator<object> {
      return new LoginEmailEngine(dependencies.accountService);
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "loginEmailGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<object>([]),
        state: GENERATOR_DISK,
        initial: {},
        options: {
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      },
      constraints: {
        default: {} as any,
        create(_policies, _context) {
          return new IdentityConstraint<object>();
        },
      },
    },
  },
});

export default loginEmail;

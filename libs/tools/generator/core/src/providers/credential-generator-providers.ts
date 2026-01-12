import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";

import { GeneratorDependencyProvider } from "./generator-dependency-provider";
import { GeneratorMetadataProvider } from "./generator-metadata-provider";
import { GeneratorProfileProvider } from "./generator-profile-provider";

// FIXME: find a better way to manage common dependencies than smashing them all
//   together into a mega-type.
export type CredentialGeneratorProviders = {
  readonly userState: UserStateSubjectDependencyProvider;
  readonly generator: GeneratorDependencyProvider;
  readonly profile: GeneratorProfileProvider;
  readonly metadata: GeneratorMetadataProvider;
};

import { PamNameResolver, PamSdkService } from "@bitwarden/bit-common/pam/shared";

import { ServiceContainer } from "../../service-container";

/**
 * Builds the shared PAM services from fields the container already has. The container itself is
 * not extended, so adding a group never touches `service-container.ts`. Every service is stateless,
 * so each command run can build its own.
 */
export function createPamSdkService(container: ServiceContainer): PamSdkService {
  return new PamSdkService(container.sdkService, container.accountService, container.logService);
}

/** For commands run with `--names`. */
export function createPamNameResolver(container: ServiceContainer): PamNameResolver {
  return new PamNameResolver(
    container.cipherService,
    container.collectionService,
    container.organizationService,
    container.accountService,
  );
}

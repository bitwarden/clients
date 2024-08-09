import { UserId } from "@bitwarden/common/types/guid";

/**
 * The LockComponentService is a service which allows the single libs/auth LockComponent to delegate all
 * client specific functionality to client specific services implementations of LockComponentService.
 */
export abstract class LockComponentService {
  // Extension
  abstract isFido2Session(): Promise<boolean>;

  // Desktop only
  abstract isWindowVisible(): Promise<boolean>;
  abstract biometricsEnabled(userId: UserId): Promise<boolean>;
}

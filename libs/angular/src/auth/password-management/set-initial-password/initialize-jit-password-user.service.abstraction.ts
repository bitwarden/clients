import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

export interface InitializeJitPasswordCredentials {
  newPasswordHint: string;
  orgSsoIdentifier: string;
  orgId: OrganizationId;
  resetPasswordAutoEnroll: boolean;
  newPassword: string;
  salt: MasterPasswordSalt;
}

export abstract class InitializeJitPasswordUserService {
  abstract initializeUser(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void>;
}

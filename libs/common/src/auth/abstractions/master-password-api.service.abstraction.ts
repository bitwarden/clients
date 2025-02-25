import { PasswordRequest } from "../models/request/password.request";
import { SetPasswordRequest } from "../models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "../models/request/update-tde-offboarding-password.request";
import { UpdateTempPasswordRequest } from "../models/request/update-temp-password.request";

export abstract class MasterPasswordApiService {
  /**
   * POSTs a SetPasswordRequest to "/accounts/set-password"
   */
  abstract setPassword: (request: SetPasswordRequest) => Promise<any>;

  /**
   * POSTs a PasswordRequest to "/accounts/password"
   */
  abstract postPassword: (request: PasswordRequest) => Promise<any>;

  /**
   * PUTs an UpdateTempPasswordRequest to "/accounts/update-temp-password"
   */
  abstract putUpdateTempPassword: (request: UpdateTempPasswordRequest) => Promise<any>;

  /**
   * PUTs an UpdateTdeOffboardingPasswordRequest to "/accounts/update-tde-offboarding-password"
   */
  abstract putUpdateTdeOffboardingPassword: (
    request: UpdateTdeOffboardingPasswordRequest,
  ) => Promise<any>;
}

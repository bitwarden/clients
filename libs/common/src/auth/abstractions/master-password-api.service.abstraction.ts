import { PasswordRequest } from "../models/request/password.request";
import { SetPasswordRequest } from "../models/request/set-password.request";
import { UpdateTdeOffboardingPasswordRequest } from "../models/request/update-tde-offboarding-password.request";
import { UpdateTempPasswordRequest } from "../models/request/update-temp-password.request";

export abstract class MasterPasswordApiService {
  abstract setPassword: (request: SetPasswordRequest) => Promise<any>;
  abstract postPassword: (request: PasswordRequest) => Promise<any>;
  abstract putUpdateTempPassword: (request: UpdateTempPasswordRequest) => Promise<any>;
  abstract putUpdateTdeOffboardingPassword: (
    request: UpdateTdeOffboardingPasswordRequest,
  ) => Promise<any>;
}

import { VerificationType } from "../enums/verification-type";

import { TwoFactorResponse } from "./two-factor-response";

export type AuthResponseBase = {
  secret: string;
  verificationType: VerificationType;
};

export type AuthResponse<T extends TwoFactorResponse> = AuthResponseBase & {
  response: T;
};

import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";

export interface TwoFactorProviderDetails {
  type: TwoFactorProviderType;
  name: string;
  description: string;
  priority: number;
  sort: number;
  premium: boolean;
}

export abstract class TwoFactorService {
  init: () => void;
  getSupportedProviders: (win: Window) => TwoFactorProviderDetails[];
  getDefaultProvider: (webAuthnSupported: boolean) => TwoFactorProviderType;
  setSelectedProvider: (type: TwoFactorProviderType) => void;
  clearSelectedProvider: () => void;

  setProviders: (response: IdentityTwoFactorResponse) => void;
  clearProviders: () => void;
  getProviders: () => Map<TwoFactorProviderType, { [key: string]: string }>;
}

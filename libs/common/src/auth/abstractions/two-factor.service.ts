// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  getSupportedProviders: (win: Window) => Promise<TwoFactorProviderDetails[]>;
  getDefaultProvider: (webAuthnSupported: boolean) => Promise<TwoFactorProviderType>;
  setSelectedProvider: (type: TwoFactorProviderType) => Promise<void>;
  clearSelectedProvider: () => Promise<void>;

  setProviders: (response: IdentityTwoFactorResponse) => Promise<void>;
  clearProviders: () => Promise<void>;
  getProviders: () => Promise<Map<TwoFactorProviderType, { [key: string]: string }>>;
}

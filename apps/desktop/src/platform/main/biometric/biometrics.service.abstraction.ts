export abstract class BiometricsServiceAbstraction {
  osSupportsBiometric: () => Promise<boolean>;
  canAuthBiometric: ({
    service,
    key,
    userId,
  }: {
    service: string;
    key: string;
    userId: string;
  }) => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  getBiometricKey: (service: string, key: string) => Promise<string | null>;
  setBiometricKey: (service: string, key: string, value: string) => Promise<void>;
  setEncryptionKeyHalf: ({
    service,
    key,
    value,
  }: {
    service: string;
    key: string;
    value: string;
  }) => void;
  deleteBiometricKey: (service: string, key: string) => Promise<void>;
}

export interface OsBiometricService {
  osSupportsBiometric: () => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  getBiometricKey: (
    service: string,
    key: string,
    clientKeyHalfB64: string | undefined,
  ) => Promise<string | null>;
  setBiometricKey: (
    service: string,
    key: string,
    value: string,
    clientKeyHalfB64: string | undefined,
  ) => Promise<void>;
  deleteBiometricKey: (service: string, key: string) => Promise<void>;
}

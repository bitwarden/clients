// eslint-disable-next-line no-restricted-imports
import { CsprngString } from "@bitwarden/legacy-crypto";

export type BiometricKey = {
  key: string;
  clientEncKeyHalf: CsprngString;
};

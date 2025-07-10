import { CsprngString } from "../../types/csprng";

export type BiometricKey = {
  key: string;
  clientEncKeyHalf: CsprngString;
};

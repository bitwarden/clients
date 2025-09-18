import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ExposedPasswordDetail, WeakPasswordDetail } from "./password-health";

// This is a temp file until https://github.com/bitwarden/clients/pull/16448 is merged
// TODO Remove these types and import from appropriate files when above PR is merged
/**
 * Flattened member details that associates an
 * organization member to a cipher
 */
export type MemberDetails = {
  userGuid: string;
  userName: string;
  email: string;
  cipherId: string;
};

/**
 * Associates a cipher with it's essential information.
 * Gets the password health details, cipher members, and
 * the trimmed uris for the cipher
 */
export type CipherHealthReport = {
  applications: string[];
  cipherMembers: MemberDetails[];
  healthData: PasswordHealthData;
  cipher: CipherView;
};

export type PasswordHealthData = {
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
};

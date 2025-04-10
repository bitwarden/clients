import { CipherView } from "../models/view/cipher.view";

/**
 * The ViewPasswordHistoryService is responsible for displaying the password history for a cipher.
 */
export abstract class ViewPasswordHistoryService {
  abstract viewPasswordHistory(cipher: CipherView): Promise<void>;
}

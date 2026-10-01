import { BreachAccountResponse } from "../dirt/models/response/breach-account.response";

export abstract class AuditService {
  /**
   * Checks how many times a password has been leaked.
   * @param password The password to check.
   * @returns A promise that resolves to the number of times the password has been leaked.
   */
  abstract passwordLeaked: (password: string, addPadding?: boolean) => Promise<number>;

  /**
   * Like {@link passwordLeaked}, but rejects instead of reporting not leaked when the lookup fails.
   * @throws If the lookup returns a non-2xx status or times out.
   */
  abstract passwordLeakedStrict: (password: string, addPadding?: boolean) => Promise<number>;

  /**
   * Retrieves accounts that have been breached for a given username.
   * @param username The username to check for breaches.
   * @returns A promise that resolves to an array of BreachAccountResponse objects.
   */
  abstract breachedAccounts: (username: string) => Promise<BreachAccountResponse[]>;
}

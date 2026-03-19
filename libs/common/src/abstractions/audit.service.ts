import { BreachAccountResponse } from "../dirt/models/response/breach-account.response";

export abstract class AuditService {
  /**
   * Checks how many times a password has been leaked.
   * @param password The password to check.
   * @returns A promise that resolves to the number of times the password has been leaked.
   */
  abstract passwordLeaked: (password: string) => Promise<number>;

  /**
   * Retrieves accounts that have been breached for a given username.
   * @param username The username to check for breaches.
   * @returns A promise that resolves to an array of BreachAccountResponse objects.
   */
  abstract breachedAccounts: (username: string) => Promise<BreachAccountResponse[]>;
}

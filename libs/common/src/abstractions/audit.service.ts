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

  /**
   * Retrieves the latest known phishing domains and their checksum if changed
   * @param prevChecksum The previous checksum value to compare against.
   * @param checksumUrl The URL to fetch the latest checksum.
   * @param domainsUrl The URL to fetch the list of phishing domains.
   * @returns A promise that resolves to an object containing the domains array and new checksum, or null if unchanged.
   */
  abstract getKnownPhishingDomainsIfChanged(
    prevChecksum: string,
    checksumUrl: string,
    domainsUrl: string,
  ): Promise<{ domains: string[]; checksum: string } | null>;

  /**
   * Retrieves the latest known phishing domains
   * @param domainsUrl The URL to fetch the list of phishing domains.
   */
  abstract getKnownPhishingDomains(domainsUrl: string): Promise<string[]>;
}

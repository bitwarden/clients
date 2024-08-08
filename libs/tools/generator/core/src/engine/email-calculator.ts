import { SUBADDRESS_PARSER } from "./data";

/** Generation algorithms that produce deterministic email addresses */
export class EmailCalculator {
  /**
   * Appends appendText to the subaddress of an email address.
   * @param appendText  The calculation fails if this is shorter than 1 character
   *   long, undefined, or null.
   * @param email the email address to alter.
   * @returns `email` with `appendText` added to its subaddress (the part
   *   following the "+"). If there is no subaddress, a subaddress is created.
   *   If the email address fails to parse, it is returned unaltered.
   */
  appendToSubaddress(appendText: string, email: string) {
    let result = (email ?? "").trim();

    const suffix = (appendText ?? "").trim();
    if (suffix.length < 1) {
      return result;
    }

    const parsed = SUBADDRESS_PARSER.exec(result);
    if (!parsed) {
      return result;
    }

    const subaddress = (parsed.groups.subaddress ?? "+") + suffix;
    result = `${parsed.groups.username}${subaddress}${parsed.groups.domain}`;

    return result;
  }

  /**
   * Derives an email address from a username and domain name.
   * @param username the username part of the email address. The calculation fails if this is
   *   shorter than 1 character long, undefined, or null.
   * @param domain the domain part of the email address. The calculation fails if this is empty,
   *   undefined, or null.
   * @returns an email address or `null` if the calculation fails.
   */
  concatenate(username: string, domain: string) {
    const emailDomain = domain?.startsWith("@") ? domain.substring(1, Infinity) : domain ?? "";
    if (emailDomain.length < 1) {
      return null;
    }

    const emailWebsite = username ?? "";
    if (emailWebsite.length < 1) {
      return null;
    }

    const result = `${emailWebsite}@${emailDomain}`;

    return result;
  }
}

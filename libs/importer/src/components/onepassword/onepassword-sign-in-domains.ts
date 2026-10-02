import { OnePasswordSignInDomain } from "../../sdk";

/**
 * The domains 1Password serves accounts on, labelled as they appear in its own sign-in form. The
 * first three are regions, each storing accounts in a different jurisdiction; an account belongs to
 * exactly one. Enterprise accounts sit on their own domain.
 *
 * See https://support.1password.com/regions/.
 */
export const onePasswordSignInDomains: { value: OnePasswordSignInDomain; label: string }[] = [
  { value: "Global", label: "1password.com" },
  { value: "Canada", label: "1password.ca" },
  { value: "Europe", label: "1password.eu" },
  { value: "Enterprise", label: "ent.1password.com" },
];

/** The domain as the user picked it, such as `1password.com`. */
export function onePasswordSignInDomainLabel(domain: OnePasswordSignInDomain): string {
  return onePasswordSignInDomains.find((d) => d.value === domain)?.label ?? "1password.com";
}

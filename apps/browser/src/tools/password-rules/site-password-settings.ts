import { CredentialGeneratorService, SitePasswordSettings } from "@bitwarden/generator-core";

import { findPasswordRules } from "./password-rules";

/** Password settings that follow the password rules of a URL's website.
 *  @returns the settings, or `null` when no rules apply or the rules can't be parsed
 */
export async function sitePasswordSettings(
  url: string | undefined,
  generatorService: CredentialGeneratorService,
): Promise<SitePasswordSettings | null> {
  const match = findPasswordRules(url);
  if (!match) {
    return null;
  }

  const settings = await generatorService.passwordRules(match.rules);
  return settings && { website: match.domain, settings };
}

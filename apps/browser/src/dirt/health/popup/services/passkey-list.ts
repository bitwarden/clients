import { PasskeyOpportunity } from "@bitwarden/common/dirt/vault-health/models";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/** The groups the passkey list splits logins into, in the order it shows them. */
export const PasskeyGroup = Object.freeze({
  /** The site lets the user log in with a passkey instead of a password. */
  Login: "login",
  /** The site takes a passkey only as a second step, after the password. */
  TwoStep: "twoStep",
} as const);

export type PasskeyGroup = (typeof PasskeyGroup)[keyof typeof PasskeyGroup];

/**
 * Which group an opportunity belongs in, first match wins: passkey login (whether or not the
 * site also takes a passkey for two-step login), otherwise two-step login. Login comes first
 * because it is the bigger benefit: it replaces the password.
 *
 * The one place this rule lives, so it can move to the SDK as a field on `PasskeyOpportunity`
 * without the list changing.
 */
export function passkeyGroupOf(opportunity: PasskeyOpportunity): PasskeyGroup {
  return opportunity.supportsPasskeyLogin ? PasskeyGroup.Login : PasskeyGroup.TwoStep;
}

/** One list row: an opportunity joined to its login, with what the row shows worked out once. */
export type PasskeyListRow = Readonly<{
  /** The cipher id, which is also the opportunity's id. */
  id: string;
  cipher: CipherView;
  group: PasskeyGroup;
  name: string;
  /** The username, or the site's hostname when there is none; undefined when neither exists. */
  secondary: string | undefined;
  /** Where "Set up" goes: the site's passkey instructions, or the login's own site. */
  setUpUrl: string | undefined;
  folderId: string | null;
  /** Lower-cased name, username and site hostnames, for search. */
  searchText: string;
}>;

/** The list's filter values, keyed as `bit-table-v2` collects them. */
export type PasskeyListFilters = {
  search?: string;
  folder?: string[];
};

const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

function isHttpUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }
  try {
    return SAFE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function hostnames(cipher: CipherView): string[] {
  return (cipher.login?.uris ?? [])
    .map((loginUri) => (loginUri.uri ? Utils.getHostname(loginUri.uri) : null))
    .filter((host): host is string => !!host);
}

/**
 * Where "Set up" opens: the site's passkey instructions when the directory has them, otherwise
 * the login's own site, where passkeys are usually added in account settings. Only http(s)
 * links, since the popup launches them. Undefined when there is neither; the row still opens
 * the item.
 */
export function passkeySetUpUrl(
  opportunity: PasskeyOpportunity,
  cipher: CipherView,
): string | undefined {
  if (isHttpUrl(opportunity.instructions)) {
    return opportunity.instructions;
  }
  const launchUri = cipher.login?.launchUri;
  return isHttpUrl(launchUri) ? launchUri : undefined;
}

/**
 * The opportunities that still have a login, as list rows. An opportunity whose login was
 * deleted since the last check drops out here, so the overview count and the page agree.
 */
export function buildPasskeyListRows(
  opportunities: readonly PasskeyOpportunity[],
  ciphers: ReadonlyMap<string, CipherView>,
): PasskeyListRow[] {
  return opportunities.flatMap((opportunity) => {
    const cipher = ciphers.get(opportunity.id);
    if (cipher == null) {
      return [];
    }
    const hosts = hostnames(cipher);
    const username = cipher.login?.username || undefined;
    return [
      {
        id: opportunity.id,
        cipher,
        group: passkeyGroupOf(opportunity),
        name: cipher.name ?? "",
        secondary: username ?? hosts[0],
        setUpUrl: passkeySetUpUrl(opportunity, cipher),
        folderId: cipher.folderId ?? null,
        searchText: [cipher.name, username, ...hosts].filter(Boolean).join(" ").toLowerCase(),
      },
    ];
  });
}

/** Whether search or a filter narrows the list. */
export function isFilteringPasskeys(filters: PasskeyListFilters): boolean {
  return (filters.search ?? "").trim() !== "" || (filters.folder ?? []).length > 0;
}

/** The list's filter: search over the name, username and site, and the Folder filter. */
export function matchesPasskeyFilters(row: PasskeyListRow, filters: PasskeyListFilters): boolean {
  const search = (filters.search ?? "").trim().toLowerCase();
  if (search !== "" && !row.searchText.includes(search)) {
    return false;
  }
  const folders = filters.folder ?? [];
  return folders.length === 0 || (row.folderId != null && folders.includes(row.folderId));
}

/** Name A to Z with the locale collator, ties broken by the second line. */
export function passkeyComparator(
  collator: Intl.Collator,
): (a: PasskeyListRow, b: PasskeyListRow) => number {
  return (a, b) =>
    collator.compare(a.name, b.name) || collator.compare(a.secondary ?? "", b.secondary ?? "");
}

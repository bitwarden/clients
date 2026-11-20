import {
  SETTINGS_SEARCH_PAGES,
  SettingsSearchEntry,
  SettingsSearchPage,
  SettingsSearchTranslate,
  SettingsSearchVisibility,
} from "./settings-search.registry";

/** How strongly a result matched; lower ranks sort first. */
export const SettingsSearchRank = Object.freeze({
  /** The label starts with the query. */
  LabelPrefix: 0,
  /** Every query word appears in the label. */
  LabelContains: 1,
  /** At least one query word only appears in the description, keywords, or page name. */
  Other: 2,
} as const);
export type SettingsSearchRank = (typeof SettingsSearchRank)[keyof typeof SettingsSearchRank];

export interface SettingsSearchResult {
  readonly entry: SettingsSearchEntry;
  readonly page: SettingsSearchPage;
  readonly rank: SettingsSearchRank;
  /** Translated label, for display. */
  readonly label: string;
  /** Translated description, for display. */
  readonly description?: string;
}

/** Lower-cases text and strips diacritics so "Résumé" matches "resume". */
export function normalizeSettingsSearchText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(normalizedQuery: string): string[] {
  return normalizedQuery.split(" ").filter((token) => token.length > 0);
}

/**
 * Finds the visible settings matching `query`. Every query word must appear somewhere in the
 * translated label, description, keywords, or page name (case and diacritic insensitive).
 * Results are ranked label prefix, then label contains, then other matches; ties keep the order
 * of `entries`.
 */
export function searchSettings(
  entries: readonly SettingsSearchEntry[],
  query: string,
  translate: SettingsSearchTranslate,
  isVisible: SettingsSearchVisibility,
): SettingsSearchResult[] {
  const normalizedQuery = normalizeSettingsSearchText(query);
  const tokens = tokenize(normalizedQuery);
  if (tokens.length === 0) {
    return [];
  }

  const matches: SettingsSearchResult[] = [];
  for (const entry of entries) {
    if (!isVisible(entry.id)) {
      continue;
    }

    const label = translate(entry.labelKey);
    const description = entry.descriptionKey ? translate(entry.descriptionKey) : undefined;
    const pageInfo = SETTINGS_SEARCH_PAGES[entry.page];

    const normalizedLabel = normalizeSettingsSearchText(label);
    const haystack = [
      normalizedLabel,
      description,
      ...(entry.keywords ?? []).map(translate),
      translate(pageInfo.labelKey),
      translate(pageInfo.scopeLabelKey),
    ]
      .filter((text): text is string => !!text)
      .map(normalizeSettingsSearchText)
      .join("\n");

    if (!tokens.every((token) => haystack.includes(token))) {
      continue;
    }

    let rank: SettingsSearchRank = SettingsSearchRank.Other;
    if (normalizedLabel.startsWith(normalizedQuery)) {
      rank = SettingsSearchRank.LabelPrefix;
    } else if (tokens.every((token) => normalizedLabel.includes(token))) {
      rank = SettingsSearchRank.LabelContains;
    }

    matches.push({ entry, page: entry.page, rank, label, description });
  }

  // Array.prototype.sort is stable, so equal ranks keep registry order.
  return matches.sort((a, b) => a.rank - b.rank);
}

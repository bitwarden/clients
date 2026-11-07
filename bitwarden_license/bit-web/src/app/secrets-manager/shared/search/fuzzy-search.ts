import { FilterFn, TableDataSource } from "@bitwarden/components";

/**
 * Builds a table filter that forgives small typos in the fields you choose.
 *
 * An item matches if the search text appears exactly in any of its columns (the same
 * check the table already does, so ids, dates and other columns still match when
 * typed correctly), or if every word in the search is close enough to part of one
 * of the `fuzzyFields`. Only those fields get the typo tolerance; an id with a typo
 * in it will not match.
 *
 * "Close enough" means a few edits: a wrong letter, a missing letter, an extra
 * letter, or two letters swapped. Longer words are allowed more edits than short
 * ones, so a short word does not match everything.
 *
 * @param search The text typed into the search box.
 * @param fuzzyFields Returns the strings from an item that a typo should be forgiven in,
 *   such as the item's name. Fields that are null or undefined are skipped.
 */
export function fuzzySearchFilter<T>(
  search: string,
  fuzzyFields: (item: T) => (string | null | undefined)[],
): FilterFn<T> {
  const exactFilter = TableDataSource.simpleStringFilter<T>(search);
  const words = normalize(search ?? "")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return (item: T): boolean => {
    if (words.length === 0 || exactFilter(item)) {
      return true;
    }

    const fields = fuzzyFields(item)
      .filter((field): field is string => field != null)
      .map(normalize);

    return words.every((word) =>
      fields.some((field) => substringEditDistance(word, field) <= allowedEdits(word)),
    );
  };
}

/** Lowercases the text and strips accents so "é" and "e" compare equal. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** How many typos to forgive in a search word of this length. */
function allowedEdits(word: string): number {
  if (word.length < 4) {
    return 0;
  }
  if (word.length < 8) {
    return 1;
  }
  return 2;
}

/**
 * The smallest number of edits needed to turn `word` into some part of `text`.
 * Edits are inserting, deleting or replacing one letter, or swapping two neighbours.
 * An exact substring match costs 0.
 */
function substringEditDistance(word: string, text: string): number {
  if (word.length === 0) {
    return 0;
  }
  if (text.length === 0) {
    return word.length;
  }

  // Each row holds the cost of matching the first `i` letters of the word against
  // text ending at every position. The first row is all zeros because the match
  // may start anywhere in the text.
  let twoRowsBack = new Array<number>(text.length + 1).fill(0);
  let previous = new Array<number>(text.length + 1).fill(0);
  let current = new Array<number>(text.length + 1);

  for (let i = 1; i <= word.length; i++) {
    current[0] = i;
    for (let j = 1; j <= text.length; j++) {
      const sameLetter = word[i - 1] === text[j - 1];
      current[j] = Math.min(
        previous[j] + 1, // letter missing from the text
        current[j - 1] + 1, // extra letter in the text
        previous[j - 1] + (sameLetter ? 0 : 1), // same or replaced letter
      );

      const swapped = i > 1 && j > 1 && word[i - 1] === text[j - 2] && word[i - 2] === text[j - 1];
      if (swapped) {
        current[j] = Math.min(current[j], twoRowsBack[j - 2] + 1);
      }
    }
    [twoRowsBack, previous, current] = [previous, current, twoRowsBack];
  }

  return Math.min(...previous);
}

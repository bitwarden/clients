import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { FieldType } from "../enums/field-type.enum";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

import { normalizeSearchQuery } from "./search.service";

/**
 * Token-based substring search across multiple cipher fields.
 *
 * This is the "smart search" replacement for the legacy basic search. The legacy search
 * required the entire query to appear as a single contiguous substring of a single field,
 * which meant the user had to type the words in the exact order they appear. Smart search
 * instead matches the words independently, in any order, across any of the search targets.
 *
 * Rules:
 *  1. Search targets — the fields of a cipher a token can match against:
 *       - name
 *       - login URIs (url)
 *       - login username
 *       - subtitle
 *       - notes
 *       - custom fields (field name, and field value for Text fields only)
 *       - the cipher's short id (uuid), matched as a prefix for tokens of 8+ characters
 *     Hidden/non-text custom field values are intentionally excluded so they are not exposed
 *     to search.
 *  2. The query is split into a list of tokens, separated by whitespace and lower-cased.
 *  3. A cipher matches when *every* token matches *at least one* target — logical AND across
 *     tokens, logical OR across targets. Token order does not matter.
 *
 * NOTE: The long-term goal is to port this matching logic into the SDK so it can be shared
 * across all clients. This TypeScript implementation is the reference behavior for that port;
 * keep it in sync with the SDK once the port lands.
 */
export class SmartSearchService {
  searchCiphersBasic<C extends CipherViewLike>(ciphers: C[], query: string): C[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) {
      return ciphers;
    }

    return ciphers.filter((cipher) => {
      const targets = this.searchTargets(cipher);
      const shortId = uuidAsString(cipher.id);

      // Every token must match at least one target for the cipher to be included.
      return tokens.every(
        (token) =>
          targets.some((target) => target.indexOf(token) > -1) ||
          (token.length >= 8 && shortId.startsWith(token)),
      );
    });
  }

  /** Splits the query into normalized, lower-cased tokens separated by whitespace. */
  private tokenize(query: string): string[] {
    return normalizeSearchQuery(query.trim().toLowerCase())
      .split(/\s+/)
      .filter((token) => token !== "");
  }

  /** Collects all searchable target strings for a cipher, normalized and lower-cased. */
  private searchTargets<C extends CipherViewLike>(cipher: C): string[] {
    const targets: string[] = [];

    const addTarget = (value: string | null | undefined) => {
      if (value != null && value !== "") {
        targets.push(normalizeSearchQuery(value.toLowerCase()));
      }
    };

    addTarget(cipher.name);
    addTarget(CipherViewLikeUtils.subtitle(cipher));
    addTarget(CipherViewLikeUtils.getNotes(cipher));

    const login = CipherViewLikeUtils.getLogin(cipher);
    if (login) {
      addTarget(login.username);
      login.uris?.forEach((loginUri) => addTarget(loginUri?.uri));
    }

    CipherViewLikeUtils.getFields(cipher)?.forEach((field) => {
      addTarget(field.name);
      // Only include the value for Text fields. For CipherListView, value is only populated
      // for Text fields; for CipherView, check the type explicitly so Hidden field values
      // are not exposed to search.
      const fieldType = (field as { type?: FieldType }).type;
      if (fieldType === undefined || fieldType === FieldType.Text) {
        addTarget(field.value);
      }
    });

    return targets;
  }
}

import { BehaviorSubject, Observable } from "rxjs";

import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { SendView } from "../../tools/send/models/view/send.view";
import { OrganizationId, UserId } from "../../types/guid";
import { SearchService as SearchServiceAbstraction } from "../abstractions/search.service";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

import { LunrSearchService } from "./lunr-search.service";

// Time to wait before performing a search after the user stops typing.
export const SearchTextDebounceInterval = 100; // milliseconds

export class SearchService implements SearchServiceAbstraction {
  private readonly immediateSearchLocales: string[] = ["zh-CN", "zh-TW", "ja", "ko", "vi"];
  // Immediately search for CJK characters as they can represent complete search terms, regardless of the active locale.
  private readonly immediateSearchQueryRegex =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  private readonly defaultSearchableMinLength: number = 2;
  private searchableMinLength: number = this.defaultSearchableMinLength;

  private _isCipherSearching$ = new BehaviorSubject<boolean>(false);
  isCipherSearching$: Observable<boolean> = this._isCipherSearching$.asObservable();

  private _isSendSearching$ = new BehaviorSubject<boolean>(false);
  isSendSearching$: Observable<boolean> = this._isSendSearching$.asObservable();

  private lunrSearchService: LunrSearchService;

  constructor(
    private logService: LogService,
    private i18nService: I18nService,
  ) {
    this.lunrSearchService = new LunrSearchService(this.logService);
    this.i18nService.locale$.subscribe((locale) => {
      if (this.immediateSearchLocales.indexOf(locale) !== -1) {
        this.searchableMinLength = 1;
      } else {
        this.searchableMinLength = this.defaultSearchableMinLength;
      }
    });
  }

  async isSearchable(query: string | null): Promise<boolean> {
    if (query == null || query.trim() === "") {
      return false;
    }

    query = normalizeSearchQuery(query);

    if (this.immediateSearchQueryRegex.test(query)) {
      return true;
    }

    // Regular queries only require a minimum length
    return query.length >= this.searchableMinLength;
  }

  private isLunrQuery(query: string): boolean {
    return query != null && query.length > 1 && query.indexOf(">") === 0;
  }

  async searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    organizationId: OrganizationId | null,
    query: string,
    ciphers: C[],
  ): Promise<C[]> {
    // Callers may still pass in null even though they are not supposed to per the parameter type
    if (query == null || query.trim() === "") {
      return ciphers;
    }

    this._isCipherSearching$.next(true);
    const searchStartTime = performance.now();
    query = normalizeSearchQuery(query.trim().toLowerCase());
    if (!(await this.isSearchable(query))) {
      this._isCipherSearching$.next(false);
      return ciphers;
    }

    // Important: Only ever route to the lunr service when this is actually a lunr query.
    // Lunr is very performance heavy, and querying it will invoke an index build.
    if (this.isLunrQuery(query)) {
      const lunrResults = await this.lunrSearchService.searchCiphers(
        userId,
        organizationId,
        query,
        ciphers,
      );
      this._isCipherSearching$.next(false);
      return lunrResults;
    } else {
      // Use basic search if the query is not a lunr query
      const basicResults = this.searchCiphersBasic(ciphers, query);
      this.logService.measure(searchStartTime, "Vault", "SearchService", "basic search complete");
      this._isCipherSearching$.next(false);
      return basicResults;
    }
  }

  searchCiphersBasic<C extends CipherViewLike>(ciphers: C[], query: string) {
    // Basic search works by splitting the query into parts. Each part must occur somewhere in the vault item.
    // A vault item consists of targets. A target is extracted from the various information in the vault item, such as name, notes.
    //
    // For each part in the query, at least one target must contain the part.
    // If all query parts are found in the vault item target, then the vault item matches the search.
    //
    // Example:
    // {
    //    name: "Email Work MyCompany",
    //    username: "alice@mycompany.com",
    //    notes: "Archived"
    // }
    //
    // Valid queries:
    // - "email work"
    // - "alice mycompany"
    // - "alice archived"
    // - "work email"
    // - "mycomp mail" (matches on MyCompany and Email)
    //
    // This allows a user to not have to remember the exact order they used when creating the item,
    // leading to a more consistent search experience.
    const terms = normalizeSearchQuery(query.trim().toLowerCase()).split(/\s+/).filter(Boolean);

    return ciphers.filter((c) => {
      return terms.every((term) => {
        if (c.name != null && normalizeSearchQuery(c.name.toLowerCase()).indexOf(term) > -1) {
          return true;
        }
        if (term.length >= 8 && uuidAsString(c.id).startsWith(term)) {
          return true;
        }
        const subtitle = CipherViewLikeUtils.subtitle(c);
        if (subtitle != null && normalizeSearchQuery(subtitle.toLowerCase()).indexOf(term) > -1) {
          return true;
        }

        const login = CipherViewLikeUtils.getLogin(c);
        if (
          login &&
          login.uris?.length &&
          login.uris?.some((loginUri) => {
            if (!loginUri?.uri) {
              return false;
            }
            const hostname = CipherViewLikeUtils.getUriHostname(loginUri);
            if (hostname === undefined) {
              return false;
            }
            return normalizeSearchQuery(hostname.toLowerCase()).indexOf(term) > -1;
          })
        ) {
          return true;
        }

        const notes = CipherViewLikeUtils.getNotes(c);
        if (notes && normalizeSearchQuery(notes.toLowerCase()).indexOf(term) > -1) {
          return true;
        }
        return false;
      });
    });
  }

  searchSends(sends: SendView[], query: string) {
    this._isSendSearching$.next(true);
    query = normalizeSearchQuery(query.trim().toLocaleLowerCase());
    if (query === null) {
      this._isSendSearching$.next(false);
      return sends;
    }
    const sendsMatched: SendView[] = [];
    const lowPriorityMatched: SendView[] = [];
    sends.forEach((s) => {
      if (s.name != null && s.name.toLowerCase().indexOf(query) > -1) {
        sendsMatched.push(s);
      } else if (
        query.length >= 8 &&
        (s.id.startsWith(query) ||
          s.accessId.toLocaleLowerCase().startsWith(query) ||
          (s.file?.id != null && s.file.id.startsWith(query)))
      ) {
        lowPriorityMatched.push(s);
      } else if (s.notes != null && s.notes.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      } else if (s.text?.text != null && s.text.text.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      } else if (s.file?.fileName != null && s.file.fileName.toLowerCase().indexOf(query) > -1) {
        lowPriorityMatched.push(s);
      }
    });
    this._isSendSearching$.next(false);
    return sendsMatched.concat(lowPriorityMatched);
  }
}

// Remove accents/diacritics characters from text. This regex is equivalent to the Diacritic unicode property escape, i.e. it will match all diacritic characters.
export function normalizeSearchQuery(query: string): string {
  return query?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

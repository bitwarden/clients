// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  BehaviorSubject,
  Observable,
} from "rxjs";

import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { StateProvider } from "../../platform/state";
import { SendView } from "../../tools/send/models/view/send.view";
import { UserId } from "../../types/guid";
import { SearchService as SearchServiceAbstraction } from "../abstractions/search.service";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";
import { LunrSearchService } from "./lunr-search.service";

// Time to wait before performing a search after the user stops typing.
export const SearchTextDebounceInterval = 200; // milliseconds

export class SearchService implements SearchServiceAbstraction {
  private readonly immediateSearchLocales: string[] = ["zh-CN", "zh-TW", "ja", "ko", "vi"];
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
    private stateProvider: StateProvider,
  ) {
    this.lunrSearchService = new LunrSearchService(this.stateProvider, this.logService);
    this.i18nService.locale$.subscribe((locale) => {
      if (this.immediateSearchLocales.indexOf(locale) !== -1) {
        this.searchableMinLength = 1;
      } else {
        this.searchableMinLength = this.defaultSearchableMinLength;
      }
    });
  }

  async ciphersUpdated(userId: UserId): Promise<void> {
    await this.lunrSearchService.ciphersUpdated(userId);
  }

  async isSearchable(query: string | null): Promise<boolean> {
    query = normalizeSearchQuery(query);

    // Nothing to search if the query is null
    if (query == null || query === "") {
      return false;
    }

    // Regular queries only require a minimum length
    return query.length >= this.searchableMinLength;
  }

  private isLunrQuery(query: string): boolean {
    return query != null && query.length > 1 && query.indexOf(">") === 0;
  }

  async searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    ciphers: C[],
  ): Promise<C[]> {
    this.logService.info("Starting cipher search", { query });
    this._isCipherSearching$.next(true);
    const searchStartTime = performance.now();
    query = normalizeSearchQuery(query.trim().toLowerCase());
    if (query === "") {
      query = null;
    }

    if (!(await this.isSearchable(query))) {
      this._isCipherSearching$.next(false);
      return ciphers;
    }

    // Important: Only ever route to the lunr service when this is actually a lunr query.
    // Lunr is very performance heavy, and querying it will invoke an index build.
    if (this.isLunrQuery(query)) {
      const lunrResults = await this.lunrSearchService.searchCiphers(userId, query, ciphers);
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

  searchCiphersBasic<C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted = false,
    archived = false,
  ) {
    query = normalizeSearchQuery(query.trim().toLowerCase());
    return ciphers.filter((c) => {
      if (deleted !== CipherViewLikeUtils.isDeleted(c)) {
        return false;
      }
      if (archived !== CipherViewLikeUtils.isArchived(c)) {
        return false;
      }
      if (c.name != null && c.name.toLowerCase().indexOf(query) > -1) {
        return true;
      }
      if (query.length >= 8 && uuidAsString(c.id).startsWith(query)) {
        return true;
      }
      const subtitle = CipherViewLikeUtils.subtitle(c);
      if (subtitle != null && subtitle.toLowerCase().indexOf(query) > -1) {
        return true;
      }

      const login = CipherViewLikeUtils.getLogin(c);

      if (
        login &&
        login.uris?.length &&
        login.uris?.some(
          (loginUri) => loginUri?.uri && loginUri.uri.toLowerCase().indexOf(query) > -1,
        )
      ) {
        return true;
      }
      return false;
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

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SearchService } from "@bitwarden/common/services/search.service";

export class PopupSearchService extends SearchService {
  constructor(
    consoleLogService: ConsoleLogService,
    i18nService: I18nService,
    stateProvider: StateProvider,
  ) {
    super(consoleLogService, i18nService, stateProvider);
  }

  clearIndex() {
    throw new Error("Not available.");
  }

  indexCiphers(): Promise<void> {
    throw new Error("Not available.");
  }

  async getIndexForSearch() {
    return await super.getIndexForSearch();
  }
}

import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherListView } from "@bitwarden/sdk-internal";

import { CIPHER_LIST_VIEWS_CHANGED } from "../services/foreground-cipher.service";

import { ListViewsAnnouncerService } from "./list-views-announcer.service";

describe("ListViewsAnnouncerService", () => {
  const userId = "user-id" as UserId;

  let activeAccount$: BehaviorSubject<Account | null>;
  let listViews$: Subject<CipherListView[] | null>;
  let cipherService: MockProxy<CipherService>;
  let messageSender: MockProxy<MessageSender>;

  beforeEach(() => {
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    listViews$ = new Subject();
    cipherService = mock<CipherService>();
    cipherService.cipherListViewsIncludingRestricted$.mockReturnValue(listViews$);
    messageSender = mock<MessageSender>();

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;
    new ListViewsAnnouncerService(accountService, cipherService, messageSender).init();
  });

  it("announces each list-view change, so an open popup fetches them again", () => {
    listViews$.next([]);
    listViews$.next([]);

    expect(cipherService.cipherListViewsIncludingRestricted$).toHaveBeenCalledWith(userId);
    expect(messageSender.send).toHaveBeenCalledTimes(2);
    expect(messageSender.send).toHaveBeenCalledWith(CIPHER_LIST_VIEWS_CHANGED);
  });

  it("stays quiet while list views are cleared or decrypting", () => {
    listViews$.next(null);

    expect(messageSender.send).not.toHaveBeenCalled();
  });

  it("stays quiet without an active account", () => {
    activeAccount$.next(null);
    listViews$.next([]);

    expect(messageSender.send).not.toHaveBeenCalled();
  });
});

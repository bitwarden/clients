import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RecentUsernamesService } from "./recent-usernames.service";

type FakeUserState = {
  state$: BehaviorSubject<string[] | null>;
  update: (updater: (current: string[] | null) => string[] | null) => Promise<void>;
  value: () => string[] | null;
};

const createUserState = (initial: string[] | null = null): FakeUserState => {
  const subject = new BehaviorSubject<string[] | null>(initial);
  return {
    state$: subject,
    update: async (updater) => {
      const next = updater(subject.getValue());
      subject.next(next);
    },
    value: () => subject.getValue(),
  };
};

describe("RecentUsernamesService", () => {
  const userId = "user-id" as UserId;

  let accountService: MockProxy<AccountService>;
  let cipherService: MockProxy<CipherService>;

  const buildService = (userState: FakeUserState, accounts?: Record<UserId, Account>) => {
    const stateProvider: StateProvider = {
      getUser: jest.fn().mockReturnValue(userState) as any,
    } as StateProvider;

    accountService = mock<AccountService>();
    cipherService = mock<CipherService>();

    accountService.accounts$ = new BehaviorSubject<Record<UserId, Account>>(
      accounts ?? {},
    ).asObservable();
    accountService.activeAccount$ = new BehaviorSubject<Account | null>(null).asObservable();

    return new RecentUsernamesService(accountService, stateProvider, cipherService);
  };

  it("deduplicates and keeps most recent first when adding usernames", async () => {
    const userState = createUserState([]);
    const service = buildService(userState);

    await service.addUsername(userId, "alice");
    await service.addUsername(userId, "bob");
    await service.addUsername(userId, "alice");

    expect(userState.value()).toEqual(["alice", "bob"]);
  });

  it("enforces the max history length of 20", async () => {
    const userState = createUserState([]);
    const service = buildService(userState);

    for (let i = 0; i <= 20; i++) {
      await service.addUsername(userId, `user${i}`);
    }

    const final = userState.value()!;
    expect(final.length).toBe(20);
    expect(final[0]).toBe("user20");
    expect(final.at(-1)).toBe("user1");
    expect(final).not.toContain("user0");
  });

  it("seeds from identity cipher emails when history is empty", async () => {
    const userState = createUserState(null);
    const service = buildService(userState);

    const aliceCipher = { identity: { email: "alice@example.com" } } as CipherView;
    const bobCipher = { identity: { email: "bob@example.com" } } as CipherView;
    cipherService.getAllDecrypted.mockResolvedValue([aliceCipher, bobCipher]);

    const result = await service.getRecent(userId, 5);

    expect(cipherService.getAllDecrypted).toHaveBeenCalledWith(userId);
    expect(result).toEqual(["bob@example.com", "alice@example.com"]);
    expect(userState.value()).toEqual(["bob@example.com", "alice@example.com"]);
  });

  it("falls back to account email seeding when no identity emails exist", async () => {
    const userState = createUserState(null);
    const accounts = {
      [userId]: {
        id: userId,
        email: "account@example.com",
        emailVerified: true,
        name: "Account",
        creationDate: undefined,
      },
    } as Record<UserId, Account>;
    const service = buildService(userState, accounts);

    cipherService.getAllDecrypted.mockResolvedValue([]);

    const result = await service.getRecent(userId, 3);

    expect(cipherService.getAllDecrypted).toHaveBeenCalledWith(userId);
    expect(result).toEqual(["account@example.com"]);
    expect(userState.value()).toEqual(["account@example.com"]);
  });
});

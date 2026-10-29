import { mock } from "jest-mock-extended";
import { firstValueFrom, Subject } from "rxjs";

import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { CipherListView } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";

import { ForegroundCipherService, GET_CIPHER_LIST_VIEWS } from "./foreground-cipher.service";

describe("ForegroundCipherService", () => {
  const userId = "user-id" as UserId;
  let messages$: Subject<Message<Record<string, unknown>>>;
  let sendMessageWithResponse: jest.SpyInstance;
  let service: ForegroundCipherService;

  const listViews = (name: string) => [{ id: "cipher-id", name }] as unknown as CipherListView[];

  beforeEach(() => {
    messages$ = new Subject();
    sendMessageWithResponse = jest
      .spyOn(BrowserApi, "sendMessageWithResponse")
      .mockResolvedValue({ result: listViews("first") });

    // Only the list-view stream is under test; the inherited dependencies stay mocks.
    const cipherServiceDeps = Array.from({ length: 15 }, () =>
      mock<any>(),
    ) as ConstructorParameters<typeof CipherService>;
    service = new ForegroundCipherService(new MessageListener(messages$), ...cipherServiceDeps);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("takes the list views from the background instead of decrypting them", async () => {
    const views = await firstValueFrom(service.cipherListViewsIncludingRestricted$(userId));

    expect(views).toEqual(listViews("first"));
    expect(sendMessageWithResponse).toHaveBeenCalledWith(GET_CIPHER_LIST_VIEWS, { userId });
  });

  it("fetches again when the background announces new list views", async () => {
    const emitted: (CipherListView[] | null)[] = [];
    service.cipherListViewsIncludingRestricted$(userId).subscribe((views) => emitted.push(views));
    await Promise.resolve();

    sendMessageWithResponse.mockResolvedValue({ result: listViews("second") });
    messages$.next({ command: "updateOverlayCiphers" });
    await Promise.resolve();
    await Promise.resolve();

    expect(emitted.at(-1)).toEqual(listViews("second"));
    expect(sendMessageWithResponse).toHaveBeenCalledTimes(2);
  });

  it("drops its copy of the list views when the cache is cleared", async () => {
    const emitted: (CipherListView[] | null)[] = [];
    service.cipherListViewsIncludingRestricted$(userId).subscribe((views) => emitted.push(views));
    await Promise.resolve();

    jest.spyOn(Object.getPrototypeOf(ForegroundCipherService.prototype), "clearCache");
    Object.getPrototypeOf(ForegroundCipherService.prototype).clearCache.mockResolvedValue(
      undefined,
    );
    await service.clearCache(userId);

    expect(emitted.at(-1)).toBeNull();
  });
});

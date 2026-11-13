// @ts-strict-ignore
import { of } from "rxjs";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ListCommand } from "./list.command";

function fullView(id: string, name: string, extra: Partial<CipherView> = {}): CipherView {
  const view = new CipherView();
  view.id = id;
  view.name = name;
  view.type = CipherType.SecureNote;
  view.secureNote = new SecureNoteView();
  return Object.assign(view, extra);
}

describe("ListCommand items", () => {
  let command: ListCommand;
  let cipherService: any;

  beforeEach(() => {
    cipherService = {
      cipherViews$: jest
        .fn()
        .mockReturnValue(
          of([
            fullView("c1", "Alpha"),
            fullView("c2", "Beta"),
            fullView("c3", "Trashed", { deletedDate: new Date() }),
          ]),
        ),
      getAllDecrypted: jest.fn(),
      getAllDecryptedForUrl: jest.fn().mockResolvedValue([fullView("c9", "Url match")]),
    };
    const searchService = {
      searchCiphersBasic: jest
        .fn()
        .mockImplementation((ciphers: CipherView[], query: string) =>
          ciphers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
        ),
    };

    command = new ListCommand(
      cipherService,
      null,
      null,
      null,
      searchService as any,
      null,
      null,
      { collectMany: jest.fn() } as any,
      { activeAccount$: of({ id: "user-1" }) } as any,
      null,
      { filterRestrictedCiphers: jest.fn().mockImplementation(async (c) => c) } as any,
      { userCanArchive$: jest.fn().mockReturnValue(of(false)) } as any,
      null,
    );
  });

  const listedIds = (response: any): string[] => response.data.data.map((i: any) => i.id);

  it("reads the cached stream instead of decrypting the vault", async () => {
    const response = await command.run("items", {});

    expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
    expect(listedIds(response)).toEqual(["c1", "c2"]);
  });

  it("filters by search", async () => {
    const response = await command.run("items", { search: "beta" });

    expect(listedIds(response)).toEqual(["c2"]);
  });

  it("lists the trash on request", async () => {
    const response = await command.run("items", { trash: true });

    expect(listedIds(response)).toEqual(["c3"]);
  });

  it("matches a URL without the cached stream", async () => {
    const response = await command.run("items", { url: "https://example.com" });

    expect(cipherService.cipherViews$).not.toHaveBeenCalled();
    expect(listedIds(response)).toEqual(["c9"]);
  });

  // A failed write clears the stream and nothing re-emits it, so waiting would hang.
  it("decrypts directly when the cached stream was cleared", async () => {
    cipherService.cipherViews$.mockReturnValue(of(null));
    cipherService.getAllDecrypted.mockResolvedValue([fullView("c1", "Alpha")]);

    const response = await command.run("items", {});

    expect(listedIds(response)).toEqual(["c1"]);
  });
});

// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { GetCommand } from "./get.command";

describe("GetCommand", () => {
  let command: GetCommand;

  beforeEach(() => {
    // The template objects do not touch any injected service.
    command = new (GetCommand as any)(...new Array(16).fill(null).map(() => mock()));
  });

  describe("template aliases", () => {
    it.each([
      ["folder", "my-folder"],
      ["collection", "shared-folder"],
      ["item-collections", "item-shared-folders"],
      ["org-collection", "org-shared-folder"],
    ])("returns the same template for %s and %s", async (original, alias) => {
      const expected = await command.run("template", original, {});
      const actual = await command.run("template", alias, {});

      expect(expected.success).toBe(true);
      expect(actual.success).toBe(true);
      expect(actual.data).toEqual(expected.data);
    });
  });

  describe("item lookup by search term", () => {
    const listViews = [
      { id: "c1", name: "Alpha", type: { login: {} } },
      { id: "c2", name: "Beta", type: { login: {} } },
      { id: "c3", name: "Alpha trashed", type: { login: {} }, deletedDate: "2024-01-01" },
    ];

    function build(listViews$: Observable<unknown>) {
      const alpha = Object.assign(new CipherView(), { id: "c1", name: "Alpha" });
      const cipherService = {
        cipherListViews$: jest.fn().mockReturnValue(listViews$),
        getAllDecrypted: jest.fn().mockResolvedValue([alpha]),
        getAllDecryptedForIds: jest.fn().mockResolvedValue([alpha]),
      };
      const searchService = {
        searchCiphersBasic: jest
          .fn()
          .mockImplementation((ciphers: any[], query: string) =>
            ciphers.filter((c) => c.name.toLowerCase().includes(query)),
          ),
      };
      const args: any[] = new Array(16).fill(null).map(() => mock());
      args[0] = cipherService;
      args[8] = searchService;
      const getCommand = new (GetCommand as any)(...args);

      return { cipherService, getCommand };
    }

    it("decrypts only the matching ciphers", async () => {
      const { cipherService, getCommand } = build(of(listViews));

      await getCommand["getCipherView"]("alpha", "user-1");

      expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
      expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith("user-1", ["c1"]);
    });

    // A failed write clears the stream and nothing re-emits it, so waiting would hang.
    it("decrypts directly when the list views were cleared", async () => {
      const { cipherService, getCommand } = build(of(null));

      const result = await getCommand["getCipherView"]("alpha", "user-1");

      expect(cipherService.getAllDecrypted).toHaveBeenCalledWith("user-1");
      expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
      expect(result.id).toBe("c1");
    });
  });
});

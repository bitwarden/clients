import { of } from "rxjs";

import { ListCommand } from "./list.command";

describe("ListCommand", () => {
  it("requires explicit confirmation before listing every item", async () => {
    const accountService = { activeAccount$: of({ id: "user-id" }) };
    const cipherArchiveService = { userCanArchive$: () => of(false) };
    const command = new ListCommand(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      accountService as any,
      null,
      null,
      cipherArchiveService as any,
    );

    const response = await command.run("items", {}, true);

    expect(response.success).toBe(false);
    expect(response.message).toContain("including secrets");
    expect(response.message).toContain("--all");
  });
});

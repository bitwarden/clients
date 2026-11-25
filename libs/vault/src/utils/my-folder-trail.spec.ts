import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { resolveMyFolderTrail } from "./my-folder-trail";

const buildFolder = (id: string, name: string) => {
  const folder = new FolderView();
  folder.id = id;
  folder.name = name;
  return folder;
};

describe("resolveMyFolderTrail", () => {
  it("trails a top-level folder with no ancestors", () => {
    const folders = [buildFolder("work", "Work"), buildFolder("home", "Home")];

    expect(resolveMyFolderTrail(folders, "work")).toEqual({ ancestors: [], current: "Work" });
  });

  it("trails a nested folder through its ancestors, top-level folder first", () => {
    const folders = [
      buildFolder("work", "Work"),
      buildFolder("projects", "Work/Projects"),
      buildFolder("acme", "Work/Projects/Acme"),
    ];

    expect(resolveMyFolderTrail(folders, "acme")).toEqual({
      ancestors: [
        { id: "work", name: "Work" },
        { id: "projects", name: "Projects" },
      ],
      current: "Acme",
    });
  });

  it("leaves the folder's own children and siblings out of its trail", () => {
    const folders = [
      buildFolder("work", "Work"),
      buildFolder("projects", "Work/Projects"),
      buildFolder("clients", "Work/Clients"),
      buildFolder("acme", "Work/Projects/Acme"),
    ];

    expect(resolveMyFolderTrail(folders, "projects")).toEqual({
      ancestors: [{ id: "work", name: "Work" }],
      current: "Projects",
    });
  });

  it("names a folder whose parent folder does not exist by its own name", () => {
    const folders = [buildFolder("acme", "Work/Projects/Acme")];

    const trail = resolveMyFolderTrail(folders, "acme");

    expect(trail?.current).toBe("Acme");
    expect(trail?.ancestors).toEqual([]);
  });

  it("trails a folder with no name flat, under an em-dash", () => {
    const folders = [buildFolder("work", "Work"), buildFolder("unnamed", "")];

    expect(resolveMyFolderTrail(folders, "unnamed")).toEqual({ ancestors: [], current: "—" });
  });

  it("does not mutate the folders it is given", () => {
    const folders = [buildFolder("work", "Work"), buildFolder("projects", "Work/Projects")];

    resolveMyFolderTrail(folders, "projects");

    expect(folders.map((folder) => folder.name)).toEqual(["Work", "Work/Projects"]);
  });

  it("yields nothing for a folder the user does not hold", () => {
    expect(resolveMyFolderTrail([buildFolder("work", "Work")], "missing")).toBeUndefined();
    expect(resolveMyFolderTrail([], "missing")).toBeUndefined();
  });
});

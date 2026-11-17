import { countOptions } from "./option-counts";

type Row = { id: string; kind: "login" | "card"; folders: string[] };

const rows: Row[] = [
  { id: "a", kind: "login", folders: ["eng"] },
  { id: "b", kind: "login", folders: ["eng", "fin"] },
  { id: "c", kind: "login", folders: ["fin"] },
  { id: "d", kind: "login", folders: [] },
  { id: "e", kind: "card", folders: ["eng"] },
  { id: "f", kind: "login", folders: ["eng", "eng-backend"] },
  { id: "g", kind: "login", folders: ["eng-backend"] },
];

const isLogin = (row: Row) => row.kind === "login";
const folders = (row: Row) => row.folders;

/** The per-option count `countOptions` replaces: one pass over the rows for each pinned value. */
function countEachOption(pinned: readonly unknown[]): number[] {
  return pinned.map((value) => {
    const selected = value == null ? [] : Array.isArray(value) ? value : [value];
    return rows.filter(
      (row) =>
        isLogin(row) &&
        (selected.length === 0 || selected.some((folder) => row.folders.includes(folder))),
    ).length;
  });
}

describe("countOptions", () => {
  it("counts the rows that hold each value and pass the other filters", () => {
    expect(countOptions(rows, isLogin, folders, ["eng", "fin"])).toEqual([3, 2]);
  });

  it("counts a row once for a subtree that it reaches through two values", () => {
    expect(countOptions(rows, isLogin, folders, [["eng", "eng-backend"]])).toEqual([4]);
  });

  it("counts every passing row for null and an empty selection", () => {
    expect(countOptions(rows, isLogin, folders, [null, []])).toEqual([6, 6]);
  });

  it("counts zero for a value that no row holds", () => {
    expect(countOptions(rows, isLogin, folders, ["legal"])).toEqual([0]);
  });

  it("counts a value listed twice in one selection once for each row", () => {
    expect(countOptions(rows, isLogin, folders, [["fin", "fin"]])).toEqual([2]);
  });

  it("returns the same counts as one pass for each option", () => {
    const pinned = [
      null,
      [],
      "eng",
      "fin",
      "eng-backend",
      "legal",
      ["eng", "eng-backend"],
      ["fin", "eng-backend"],
      ["fin", "fin"],
    ];

    expect(countOptions(rows, isLogin, folders, pinned)).toEqual(countEachOption(pinned));
  });

  it("calls the row test once for each row", () => {
    const matches = jest.fn(isLogin);

    countOptions(rows, matches, folders, ["eng", "fin", ["eng", "eng-backend"]]);

    expect(matches).toHaveBeenCalledTimes(rows.length);
  });
});

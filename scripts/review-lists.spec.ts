import { lintReviewLists, ListFile, toRegex } from "./review-lists";

const CODEOWNERS = [
  "# Comments and blank lines are skipped.",
  "",
  "* @bitwarden/team-platform-dev",
  "/libs/auth/ @bitwarden/team-auth-dev",
  "libs/vault @bitwarden/team-vault-dev  # inline comments are skipped",
  "/libs/shared/ @bitwarden/team-auth-dev @bitwarden/team-vault-dev",
  "/libs/gone/ @bitwarden/team-auth-dev",
  "libs/auth/legacy.ts @bitwarden/team-vault-dev",
  "apps/cli/src/locales @bitwarden/team-platform-dev",
  "apps/cli/src/locales/en/messages.json",
  "**/Dockerfile @bitwarden/team-appsec @someone a@example.com",
  "docs/*.md @bitwarden/team-docs",
  "!negated @bitwarden/team-ghost",
].join("\n");

const TRACKED = [
  "README.md",
  "libs/auth/login.ts",
  "libs/auth/login.spec.ts",
  "libs/auth/legacy.ts",
  "libs/vault/folder.ts",
  "libs/shared/format.ts",
  "apps/cli/src/locales/en/messages.json",
  "apps/web/Dockerfile",
  "docs/guide.md",
  "docs/api/ref.md",
];

const HEADER = "# A header comment.\n#\n# Another line.\n\n";

/** Returns a list file for a team with the given body. */
function list(team: string, body: string): ListFile {
  return { name: `${team}.yml`, text: HEADER + body };
}

/** Lints the given lists against the fixture CODEOWNERS and tracked files. */
function lint(...lists: ListFile[]): string[] {
  return lintReviewLists(CODEOWNERS, lists, TRACKED);
}

describe("toRegex", () => {
  it.each([
    ["*.md", "README.md", true],
    ["*.md", "docs/guide.md", true],
    ["Dockerfile", "apps/web/Dockerfile", true],
    ["/libs/auth/", "libs/auth/login.ts", true],
    ["/libs/auth/", "apps/libs/auth/login.ts", false],
    ["libs/auth", "libs/auth/login.ts", true],
    ["libs/auth", "apps/libs/auth/login.ts", false],
    ["libs/auth", "libs/auth", true],
    ["libs/auth/", "libs/auth", false],
    ["libs/auth.ts", "libs/auth.ts", true],
    ["libs/auth.ts", "libs/authxts", false],
    ["docs/*", "docs/guide.md", true],
    ["docs/*", "docs/api/ref.md", false],
    ["docs/**", "docs/api/ref.md", true],
    ["**/Dockerfile", "Dockerfile", true],
    ["**/Dockerfile", "apps/web/Dockerfile", true],
    ["apps/**/auth", "apps/web/src/auth/a.ts", true],
    ["apps/**/auth", "apps/auth/a.ts", true],
    ["apps/**/auth", "libs/auth/a.ts", false],
    ["libs/a?.ts", "libs/ab.ts", true],
    ["libs/a?.ts", "libs/a/b.ts", false],
    ["*.spec.ts", "libs/auth/login.spec.ts", true],
    ["*.spec.ts", "libs/auth/login.ts", false],
    ["libs/a**b.ts", "libs/axyzb.ts", true],
    ["libs/a**b.ts", "libs/a/b.ts", false],
  ])("'%s' against '%s' is %s", (pattern, path, expected) => {
    expect(toRegex(pattern)!.test(path)).toBe(expected);
  });

  it.each(["!libs/auth", "libs/[ab]", "libs//auth", "/", ""])(
    "rejects unsupported pattern '%s'",
    (pattern) => {
      expect(toRegex(pattern)).toBeNull();
    },
  );
});

describe("lintReviewLists", () => {
  describe("valid lists", () => {
    it("accepts include entries that are the team's own CODEOWNERS lines", () => {
      expect(lint(list("team-auth-dev", "include:\n  - /libs/auth/\n"))).toEqual([]);
    });

    it("accepts a subset of the team's lines, not all of them", () => {
      expect(lint(list("team-auth-dev", "include:\n  - /libs/shared/\n"))).toEqual([]);
    });

    it("accepts group comments, blank lines, and a comment after a key", () => {
      const body =
        "include: # always reviewed\n  ## Auth ##\n  - /libs/auth/\n\n  # Shared\n  - /libs/shared/\n";
      expect(lint(list("team-auth-dev", body))).toEqual([]);
    });

    it("accepts an exclude that matches some of the team's files", () => {
      const body = 'include:\n  - /libs/auth/\nexclude:\n  - "*.spec.ts"\n';
      expect(lint(list("team-auth-dev", body))).toEqual([]);
    });

    it("accepts an empty include and an empty exclude", () => {
      expect(lint(list("team-auth-dev", "include: []\nexclude: []\n"))).toEqual([]);
    });

    it("accepts double- and single-quoted patterns and compares them without the quotes", () => {
      expect(lint(list("team-appsec", 'include:\n  - "**/Dockerfile"\n'))).toEqual([]);
      expect(lint(list("team-appsec", "include:\n  - '**/Dockerfile'\n"))).toEqual([]);
    });

    it("counts a co-owned line for each of its owners", () => {
      expect(
        lint(
          list("team-auth-dev", "include:\n  - /libs/shared/\n"),
          list("team-vault-dev", "include:\n  - /libs/shared/\n"),
        ),
      ).toEqual([]);
    });

    it("ignores files in .github/review that aren't lists", () => {
      expect(lint({ name: "README.md", text: "not a list" })).toEqual([]);
    });

    it("accepts no lists at all", () => {
      expect(lint()).toEqual([]);
    });
  });

  describe("format", () => {
    it("reports a missing include key", () => {
      expect(lint(list("team-auth-dev", 'exclude:\n  - "*.spec.ts"\n'))).toEqual([
        ".github/review/team-auth-dev.yml: missing the required include key.",
      ]);
    });

    it("reports an unknown key and the items under it", () => {
      expect(lint(list("team-auth-dev", "include: []\nowners:\n  - /libs/auth/\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 unknown key 'owners'. Only include and exclude are allowed.",
        ".github/review/team-auth-dev.yml:7 expected '- <pattern>' under include or exclude.",
      ]);
    });

    it("reports a duplicate key", () => {
      expect(lint(list("team-auth-dev", "include: []\ninclude: []\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 duplicate key 'include'.",
      ]);
    });

    it("reports an item before any key", () => {
      expect(lint(list("team-auth-dev", "  - /libs/auth/\ninclude: []\n"))).toEqual([
        ".github/review/team-auth-dev.yml:5 expected '- <pattern>' under include or exclude.",
      ]);
    });

    it("reports an item after an empty [] value", () => {
      expect(lint(list("team-auth-dev", "include: []\n  - /libs/auth/\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 expected '- <pattern>' under include or exclude.",
      ]);
    });

    it("reports a line that isn't a key, an item, or a comment", () => {
      expect(lint(list("team-auth-dev", "include:\n  /libs/auth/\ninclude-ish\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 expected '- <pattern>' under include or exclude.",
        ".github/review/team-auth-dev.yml:7 expected '- <pattern>' under include or exclude.",
      ]);
    });

    it("reports an inline value on a key", () => {
      expect(lint(list("team-auth-dev", "include: /libs/auth/\n"))).toEqual([
        ".github/review/team-auth-dev.yml:5 expected '- <pattern>' under include or exclude.",
        ".github/review/team-auth-dev.yml: missing the required include key.",
      ]);
    });

    it.each([
      ["*.spec.ts", "starts with *"],
      ["libs/auth #legacy", "contains ' #'"],
      ["libs: auth", "contains ': '"],
    ])("reports unquoted '%s', which %s", (pattern) => {
      expect(
        lint(list("team-auth-dev", `include:\n  - /libs/auth/\nexclude:\n  - ${pattern}\n`)),
      ).toEqual([
        `.github/review/team-auth-dev.yml:8 quote '${pattern}'. YAML reads it differently unquoted.`,
      ]);
    });
  });

  describe("teams", () => {
    it("reports a list whose team CODEOWNERS doesn't name", () => {
      expect(lint(list("team-unknown", "include: []\n"))).toEqual([
        ".github/review/team-unknown.yml: @bitwarden/team-unknown is not a team in CODEOWNERS.",
      ]);
    });

    it("reports a list for a team named only on a line GitHub skips", () => {
      expect(lint(list("team-ghost", "include: []\n"))).toEqual([
        ".github/review/team-ghost.yml: @bitwarden/team-ghost is not a team in CODEOWNERS.",
      ]);
    });

    it("reports a list for a user or email owner, which isn't a team", () => {
      expect(lint(list("someone", "include: []\n"))).toEqual([
        ".github/review/someone.yml: @bitwarden/someone is not a team in CODEOWNERS.",
      ]);
    });
  });

  describe("include entries must be the team's CODEOWNERS lines", () => {
    it("reports an entry that isn't a CODEOWNERS line", () => {
      expect(lint(list("team-auth-dev", "include:\n  - libs/auth/login.ts\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 include 'libs/auth/login.ts' is not a CODEOWNERS line for @bitwarden/team-auth-dev.",
      ]);
    });

    it("reports another team's CODEOWNERS line", () => {
      expect(lint(list("team-auth-dev", "include:\n  - libs/vault\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 include 'libs/vault' is not a CODEOWNERS line for @bitwarden/team-auth-dev.",
      ]);
    });

    it("reports the team's line written differently, even when it matches the same files", () => {
      expect(lint(list("team-auth-dev", "include:\n  - libs/auth\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 include 'libs/auth' is not a CODEOWNERS line for @bitwarden/team-auth-dev.",
      ]);
    });
  });

  describe("entries must match a file the team owns", () => {
    it("reports an include line that matches no tracked file", () => {
      expect(lint(list("team-auth-dev", "include:\n  - /libs/gone/\n"))).toEqual([
        ".github/review/team-auth-dev.yml:6 include '/libs/gone/' matches no file @bitwarden/team-auth-dev owns, so it has no effect.",
      ]);
    });

    it("reports an include line a later line gives to no owner", () => {
      expect(lint(list("team-platform-dev", "include:\n  - apps/cli/src/locales\n"))).toEqual([
        ".github/review/team-platform-dev.yml:6 include 'apps/cli/src/locales' matches no file @bitwarden/team-platform-dev owns, so it has no effect.",
      ]);
    });

    it("accepts a line a later line overrides only in part", () => {
      expect(lint(list("team-vault-dev", "include:\n  - libs/auth/legacy.ts\n"))).toEqual([]);
      expect(lint(list("team-auth-dev", "include:\n  - /libs/auth/\n"))).toEqual([]);
    });

    it("reports an include line a later line gives entirely to another team", () => {
      const codeowners = `${CODEOWNERS}\n/libs/auth/ @bitwarden/team-vault-dev`;
      expect(
        lintReviewLists(
          codeowners,
          [list("team-auth-dev", "include:\n  - /libs/auth/\n")],
          TRACKED,
        ),
      ).toEqual([
        ".github/review/team-auth-dev.yml:6 include '/libs/auth/' matches no file @bitwarden/team-auth-dev owns, so it has no effect.",
      ]);
    });

    it("reports an exclude that matches only another team's files", () => {
      expect(lint(list("team-auth-dev", "include: []\nexclude:\n  - libs/vault\n"))).toEqual([
        ".github/review/team-auth-dev.yml:7 exclude 'libs/vault' matches no file @bitwarden/team-auth-dev owns, so it has no effect.",
      ]);
    });

    it("reports an exclude that matches no tracked file", () => {
      expect(lint(list("team-auth-dev", 'include: []\nexclude:\n  - "*.go"\n'))).toEqual([
        ".github/review/team-auth-dev.yml:7 exclude '*.go' matches no file @bitwarden/team-auth-dev owns, so it has no effect.",
      ]);
    });

    it.each(["!libs/auth", "libs/[ab]"])(
      "reports an exclude with unsupported syntax '%s'",
      (pattern) => {
        expect(lint(list("team-auth-dev", `include: []\nexclude:\n  - ${pattern}\n`))).toEqual([
          `.github/review/team-auth-dev.yml:7 '${pattern}' is not a valid CODEOWNERS pattern.`,
        ]);
      },
    );
  });

  it("reports every problem across every list, with file and line", () => {
    expect(
      lint(
        list("team-auth-dev", "include:\n  - /libs/auth/\n  - libs/vault\n  - /libs/gone/\n"),
        list("team-unknown", "include: []\n"),
        list("team-vault-dev", "exclude: []\n"),
      ),
    ).toEqual([
      ".github/review/team-auth-dev.yml:7 include 'libs/vault' is not a CODEOWNERS line for @bitwarden/team-auth-dev.",
      ".github/review/team-auth-dev.yml:8 include '/libs/gone/' matches no file @bitwarden/team-auth-dev owns, so it has no effect.",
      ".github/review/team-unknown.yml: @bitwarden/team-unknown is not a team in CODEOWNERS.",
      ".github/review/team-vault-dev.yml: missing the required include key.",
    ]);
  });
});

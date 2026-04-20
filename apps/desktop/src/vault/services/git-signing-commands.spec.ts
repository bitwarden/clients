import {
  buildCommitSignOptInCommand,
  buildGitSigningCommands,
  shellQuote,
} from "./git-signing-commands";

describe("buildGitSigningCommands", () => {
  const publicKey =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKey+/Base64Chars comment@host";

  it("returns gpg.format and user.signingkey commands in order", () => {
    const commands = buildGitSigningCommands(publicKey);

    expect(commands).toHaveLength(2);
    expect(commands[0].args).toEqual(["config", "--global", "gpg.format", "ssh"]);
    expect(commands[1].args).toEqual([
      "config",
      "--global",
      "user.signingkey",
      `key::${publicKey}`,
    ]);
  });

  it("embeds the public key verbatim using the key:: prefix", () => {
    const commands = buildGitSigningCommands(publicKey);
    expect(commands[1].args[3]).toBe(`key::${publicKey}`);
  });

  it("trims surrounding whitespace from the public key", () => {
    const commands = buildGitSigningCommands(`\n  ${publicKey}\n`);
    expect(commands[1].args[3]).toBe(`key::${publicKey}`);
  });

  it("preserves + and / characters from base64 in argv (no escaping applied)", () => {
    const commands = buildGitSigningCommands(publicKey);
    expect(commands[1].args[3]).toContain("+/");
  });

  it("shell-quotes the signing key in the display form", () => {
    const commands = buildGitSigningCommands(publicKey);
    expect(commands[1].display).toBe(
      `git config --global user.signingkey 'key::${publicKey}'`,
    );
  });

  it("throws when given an empty key", () => {
    expect(() => buildGitSigningCommands("")).toThrow(/publicKey/);
    expect(() => buildGitSigningCommands("   \n  ")).toThrow(/publicKey/);
  });
});

describe("buildCommitSignOptInCommand", () => {
  it("returns the commit.gpgsign=true command", () => {
    const command = buildCommitSignOptInCommand();
    expect(command.args).toEqual(["config", "--global", "commit.gpgsign", "true"]);
    expect(command.display).toBe("git config --global commit.gpgsign true");
  });
});

describe("shellQuote", () => {
  it("wraps plain strings in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes using the '\\'' idiom", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it("leaves shell metacharacters intact inside single quotes", () => {
    expect(shellQuote("$(pwd) && rm -rf /")).toBe("'$(pwd) && rm -rf /'");
  });
});

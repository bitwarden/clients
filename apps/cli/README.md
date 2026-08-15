[![Github Workflow build on main](https://github.com/bitwarden/clients/actions/workflows/build-cli.yml/badge.svg?branch=main)](https://github.com/bitwarden/clients/actions/workflows/build-cli.yml?query=branch:main)

# Bitwarden Command-line Interface

[![Platforms](https://imgur.com/AnTLX0S.png "Platforms")](https://help.bitwarden.com/article/cli/#download--install)

The Bitwarden CLI is a powerful, full-featured command-line interface (CLI) tool to access and manage a Bitwarden vault. The CLI is written with TypeScript and Node.js and can be run on Windows, macOS, and Linux distributions.

## Developer Documentation

Please refer to the [CLI section](https://contributing.bitwarden.com/getting-started/clients/cli/) of the [Contributing Documentation](https://contributing.bitwarden.com/) for build instructions, recommended tooling, code style tips, and lots of other great information to get you started.

## User Documentation

### Download/Install

You can install the Bitwarden CLI multiple different ways:

**NPM**

If you already have the Node.js runtime installed on your system, you can install the CLI using NPM. NPM makes it easy to keep your installation updated and should be the preferred installation method if you are already using Node.js.

```bash
npm install -g @bitwarden/cli
```

**Native Executable**

We provide natively packaged versions of the CLI for each platform which have no requirements on installing the Node.js runtime. You can obtain these from the [downloads section](https://help.bitwarden.com/article/cli/#download--install) in the documentation.

**Other Package Managers**

- [Chocolatey](https://chocolatey.org/packages/bitwarden-cli)
  ```powershell
  choco install bitwarden-cli
  ```
- [Homebrew](https://formulae.brew.sh/formula/bitwarden-cli)
  ```bash
  brew install bitwarden-cli
  ```
  > ⚠️ The homebrew version is not recommended for all users.
  >
  > Homebrew pulls the CLI's GPL build and does not include device approval commands for Enterprise SSO customers.
- [Snap](https://snapcraft.io/bw)
  ```bash
  sudo snap install bw
  ```

### Help Command

The Bitwarden CLI is self-documented with `--help` content and examples for every command. You should start exploring the CLI by using the global `--help` option:

```bash
bw --help
```

This option will list all available commands that you can use with the CLI.

Additionally, you can run the `--help` option on a specific command to learn more about it:

```bash
bw list --help
bw create --help
```

### Unlock with desktop biometrics

When `bw unlock` is run interactively without a password, the CLI first attempts to unlock through
the Bitwarden desktop app. This requires Bitwarden Desktop 2026.7.0 or newer to be running, with
biometric unlock enabled for the same account. If desktop biometric unlock is unavailable or is
cancelled, the CLI falls back to the master password prompt.

Passing a password, `--passwordenv`, or `--passwordfile` skips the biometric attempt. Biometric
unlock is also skipped when `BW_NOINTERACTION=true`.

### Help Center

We provide detailed documentation and examples for using the CLI in our help center at https://help.bitwarden.com/article/cli/.

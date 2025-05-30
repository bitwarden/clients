# Tools

This lib represents the public API of the Tools team at Bitwarden. Modules are imported using `@bitwarden/{feature-name}` for example `@bitwarden/generator-core` and `@bitwarden/send-ui`.

## Contributing

We're presently looking for help implementing our backlog of [ADRs](https://contributing.bitwarden.com/architecture/adr/).
An easy place to start could be aligning our `-ui` and `-component` modules with
[ADR-0011](https://contributing.bitwarden.com/architecture/adr/angular-folder-structure). Something like
[ADR-0014](https://contributing.bitwarden.com/architecture/adr/typescript-strict) is more challenging.

Before you begin:

- Familiarize yourself with our [code contribution guidelines](https://contributing.bitwarden.com/contributing/).
- Check out any [Deep Dive docs](https://contributing.bitwarden.com/architecture/deep-dives/) related to your contribution.
- [Reach out](https://github.com/orgs/bitwarden/discussions/new/choose) to the [tools engineers](https://github.com/orgs/bitwarden/teams/team-tools-dev) with your plans!

> [!TIP]
> **Want to contribute but don't know where to start?**
> 
> One of the realities of software is you can always do it better. Where we think
> there's opportunity for improvement, we're writing FIXMEs.
> 
> Many of these come from [new lints](https://github.com/bitwarden/clients/pull/14650/files),
> but that doesn't mean they're simple to solve!
> Try taking a look at one!

## Navigation

- [Exporters](./export/vault-export/README.md)
- [Generators](./generator/readme.md)
- [Sends](./send/README.md)
- [Tools Card Component](./card/README.md)

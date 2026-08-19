# Vault Routing

The vault's filter state lives in the URL. This folder holds the three pieces that depend on that:
resolving which vault a URL is showing, remembering the filters each vault was last viewed with, and
migrating URLs written before the filters moved into a namespace.

## The URL is the filter state

`bit-table-v2` mirrors its own filter state to the query string when given a `[queryParam]`
namespace, and the vault table passes `VAULT_FILTER_NAMESPACE` (`"vault"`). Every chip selection and
sort change therefore produces a navigation, and the resulting URL looks like:

```
/vault?vault.type=1&vault.folder=f-1&vault.sort=name&vault.direction=asc
```

There is no second copy of this state in a service — the URL is the source of truth, which is what
makes vault filters shareable and deep-linkable. Everything here reads from the URL rather than
tracking filters independently.

## Scopes

A **scope** is one vault the side nav can select, and the key its filters are remembered under.
[`vault-scope.ts`](./vault-scope.ts) defines the vocabulary:

| Scope               | Value     | Shows                     |
| ------------------- | --------- | ------------------------- |
| `ALL_ITEMS_SCOPE`   | `all`     | Every vault's items       |
| `MY_VAULT_SCOPE`    | `myVault` | The individual vault only |
| An `OrganizationId` | a guid    | One organization's vault  |

`VaultScope` is the union of those. Use `toVaultScope()` (or `isVaultScope()`) to narrow untrusted input,
such as a route param or a key read back from state.

### Routes opt in

`vaultScopeOf()` resolves a scope from the **route config**, not from the URL's shape. A route
declares itself in scope through its `data`, and names the vault it shows with a `:vaultId` param:

```typescript
{
  path: "vault",
  data: { vaultFilterScope: true } satisfies VaultScopeRouteData,
},
{
  path: "vault/:vaultId",
  data: { vaultFilterScope: true } satisfies VaultScopeRouteData,
},
```

A route with no `:vaultId` resolves to `ALL_ITEMS_SCOPE`. A route that doesn't opt in resolves to
`null` and is ignored entirely.

> [!IMPORTANT]
> A new vault route that forgets `vaultFilterScope` won't have its filters remembered, and nothing
> will fail loudly. If filters aren't sticking on a route, check its `data` first.

## Remembering filters

[`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts) records the filters each scope
was last viewed with, so the side nav can return the user to where they left off.

**Recording** happens on `NavigationEnd`. Because the table's URL sync triggers a navigation on every
chip change, the memory keeps up without the table knowing it exists. The service takes the
`rememberableParams()` subset of the query string — everything under the filter namespace except
`vault.search`, which is free text the user typed and isn't expected to come back.

**Restoring** is the caller's job. Read `paramsFor(scope)` and build the link:

```typescript
protected readonly vaultRoute = computed(() =>
  this.router.createUrlTree(["/vault"], {
    queryParams: this.vaultFilterMemory.paramsFor(ALL_ITEMS_SCOPE),
  }),
);
```

`paramsFor` reads from a signal, so a link built in a `computed` updates as the memory does.

### Persistence

Writes are debounced (`PERSIST_DEBOUNCE_INTERVAL`), so working through a few chips in a row costs one
write rather than one per change. They also merge per scope rather than replacing the record
wholesale — a navigation recorded before the stored value arrives would otherwise shadow every scope
it didn't touch.

State is kept on disk and cleared on **logout only**, not on lock. On web an unlock is the start of
most sessions, so clearing on lock would leave nothing to restore.

## Legacy URLs

[`vault-filter-legacy-redirect.guard.ts`](./vault-filter-legacy-redirect.guard.ts) exists because
vault filters used to live in un-namespaced params (`?type=login&folderId=…&vaultId=…`). Bookmarks,
emails, and links from other clients still carry that form.

When `FeatureFlag.VFO1Foundation` is on, the guard rewrites them to their namespaced equivalents and
redirects:

```
?type=login&folderId=abc     →    ?vault.type=1&vault.folder=abc
```

Params it doesn't own (`cipherId`, `action`, …) are carried through untouched. A `type` it can't
translate — `trash`, `archive` — is deliberately left in place so the legacy filter can still apply
it.

## Files

| File                                                                               | Responsibility                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`vault-scope.ts`](./vault-scope.ts)                                               | Scope vocabulary, route → scope resolution, param filtering |
| [`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts)               | Records and serves each scope's last-seen filters           |
| [`vault-filter-legacy-redirect.guard.ts`](./vault-filter-legacy-redirect.guard.ts) | Rewrites pre-namespace URLs                                 |

# Vault Routing

The vault's filter state lives in the URL. This folder holds the pieces that depend on that:
resolving which vault a URL is showing, remembering the filters each vault was last viewed with and
restoring them on the way back in, and migrating URLs written before the filters moved into a
namespace.

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

> [!WARNING]
> Only `/vault` (`ALL_ITEMS_SCOPE`) is registered today. Adding `/vault/myVault` or `/vault/:vaultId`
> needs a fix in `bit-table-v2` first — without it, filters leak from one scope into the next and are
> persisted under the wrong one. See [SCOPE-ROUTES-HANDOFF.md](./SCOPE-ROUTES-HANDOFF.md).

## Remembering filters

[`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts) records the filters each scope
was last viewed with, so the side nav can return the user to where they left off.

**Recording** happens on `NavigationEnd`. Because the table's URL sync triggers a navigation on every
chip change, the memory keeps up without the table knowing it exists. The service takes the
`rememberableParams()` subset of the query string — an allowlist, so a param that turns up under the
namespace later isn't persisted by accident. `vault.search` is left out (free text the user typed),
as is pagination.

Navigations the user reached with back or forward are skipped: they retrace URLs that were already
recorded on the way in, and a history entry holding a bare vault URL would otherwise erase the
scope's memory on the way past.

**Restoring** happens in [`vault-filter-restore.guard.ts`](./vault-filter-restore.guard.ts), on the
route rather than at each link. A filter-less vault URL is redirected to the same route carrying the
remembered params:

```
/vault    →    /vault?vault.type=1&vault.folder=f-1
```

It belongs on the route because most arrivals at the vault aren't a side nav click — the post-login
and post-unlock landing comes from `redirectGuard`, the product switcher and `orgPermissionsGuard`
navigate to `/vault` directly, and a bookmark skips the app's chrome entirely. A link that carried
the params itself would restore for one of those and not the rest.

Register it after `vaultFilterLegacyRedirectGuard`, whose rewrite produces namespaced params and so
takes precedence over the memory on its own. Register both only on the VFO1 route — they hang off
`featureFlaggedRoute`'s `flaggedRouteOptions`, so neither has to re-check the flag from the inside,
and the pre-VFO1 vault writes nothing.

The read is awaited. The memory lives on disk, so on the first vault navigation of a session it
hasn't been loaded yet — and a bookmark or the post-unlock landing is exactly the arrival this guard
exists for. Reading it synchronously would no-op on the cases that matter most.

The guard stands down in two cases:

- **The URL states its own filters.** Checked with `hasFilterParams()`, which is deliberately broader
  than `rememberableParams()` — a link carrying only `vault.search` states a filter the memory
  doesn't record, and layering a remembered type onto it would show something the link didn't ask
  for.
- **The navigation is a `popstate`.** Back and forward have to land on the URL held in the history
  stack; rewriting it would put the entry the user just left back in front of them.

### Clearing

There is no separate gesture. The toolbar's **Clear all** empties every chip, `queryParamStore` drops
a param whose key is empty, and the bare URL that leaves behind is recorded like any other — so the
scope's memory becomes `{}` and the guard has nothing to restore. Navigating to a bare `/vault` by
hand is _not_ a way to clear: a typed URL and a side nav click produce the identical URL, so nothing
downstream can tell them apart.

### Persistence

Writes are serialized on a single chain, and reads await it. That's what makes a scope switch — which
reads the memory mid-navigation, right after the outgoing scope was recorded — see the record instead
of racing it. A failed write is swallowed so it can't poison the chain for everything after it.

Each write names the user it recorded for, resolved when the navigation ended rather than when the
write lands. Going through the active-user alias would resolve it at write time, which mid-switch is
the account the filters didn't come from.

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

It checks the flag itself, unlike `vaultFilterRestoreGuard`, because desktop registers it on a plain
`/vault` route rather than a `featureFlaggedRoute` — there's no flagged route to hang it off there.

## Files

| File                                                                               | Responsibility                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`vault-scope.ts`](./vault-scope.ts)                                               | Scope vocabulary, route → scope resolution, param filtering |
| [`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts)               | Records and serves each scope's last-seen filters           |
| [`vault-filter-restore.guard.ts`](./vault-filter-restore.guard.ts)                 | Redirects a filter-less vault URL to the remembered filters |
| [`vault-filter-legacy-redirect.guard.ts`](./vault-filter-legacy-redirect.guard.ts) | Rewrites pre-namespace URLs                                 |

## Open work

[SCOPE-ROUTES-HANDOFF.md](./SCOPE-ROUTES-HANDOFF.md) — what has to change before the per-vault scope
routes can land. Delete it when they do.

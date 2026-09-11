# Vault Routing

This folder holds the vault's route helpers, in two groups:

- **Scope routing** — which vault a URL shows, and which `:vaultId` URLs are valid:
  [`vault-scope.guard.ts`](./vault-scope.guard.ts),
  [`organization-vault.guard.ts`](./organization-vault.guard.ts), and
  [`scoped-collection.ts`](./scoped-collection.ts).
- **Filter state** — the subject of this document: record the filters each vault was last viewed
  with, restore them on the next visit, and rewrite URLs written before the filters moved into a
  namespace.

## The URL is the filter state

`bit-table-v2` mirrors its filter state to the query string when it receives a `queryParam`
namespace, and the vault table passes `VAULT_FILTER_NAMESPACE` (`"vault"`). Each chip change and
each sort change therefore starts a navigation, and the URL looks like this:

```
/vault?vault.type=1&vault.folder=f-1&vault.sort=name&vault.direction=asc
```

No service holds a second copy of this state. The URL is the source of truth, which is what makes a
filtered vault shareable and deep-linkable. Every file here reads the URL.

## Scopes

A **scope** is one vault a page shows, and the key its filters are stored under.
[`../models/vault-scope.ts`](../models/vault-scope.ts) defines it, and the side nav and
`vaultScopeGuard` share it: All items, the individual vault, an organization, Trash, or the Archive
— and, for an organization, the shared folder the page has narrowed to.

`scopeKey()` flattens a scope to its storage key. An organization keys by its guid and every other
scope by its `VaultScopeType` name, so the two cannot collide. A shared folder keys apart from the
organization vault above it, because the two show different rows.

[`vault-filter-scope.ts`](./vault-filter-scope.ts) adds the route wiring: the `data` key a route
opts in with, and `vaultScopeOf()`, which resolves an activated route to a scope.

### Routes opt in

`vaultScopeOf()` reads the **route config**, not the shape of the URL. A route opts in through its
`data`, and names the vault it shows with a `:vaultId` param:

```typescript
{
  path: ":vaultId",
  canActivate: [
    canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
    vaultScopeGuard,
    vaultFilterRestoreGuard,
  ],
  data: { titleId: "vaults", vaultFilterScope: true } satisfies RouteDataProperties &
    VaultScopeRouteData,
}
```

`scopedCollectionSegment()` supplies the collection segment, so a shared folder route and the "My
items" route resolve the way they do for `vaultScopeGuard`.

A route without a `:vaultId` resolves to `ALL_ITEMS_SCOPE`. A route that does not opt in resolves to
`null`, and the memory ignores it.

> [!IMPORTANT]
> A new vault route that omits `vaultFilterScope` records no filters, and no error appears. If a
> route does not restore its filters, examine its `data` first.

> [!WARNING]
> A scope change depends on `bit-table-v2` to clear its chips. If filters pass from one scope into
> the next, the memory also stores them under the wrong key. Examine the table's URL sync before the
> memory.

## The filter memory

[`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts) records the filters each scope
was last viewed with, so the side nav can return the user to the same view.

**To record** — the service writes on `NavigationEnd`. The table's URL sync starts a navigation on
each chip change, so the memory stays current and the table does not know it exists. The service
stores the `rememberableParams()` subset of the query string. That subset is an allowlist, so it
does not store a param added under the namespace later. It omits `vault.search`, which is free text
the user typed, and it omits pagination.

The service records every vault URL the user reaches, back and forward included. The entry the user
reaches is the URL on screen, so the memory and the screen agree. The cost: a back navigation to an
older entry of the same scope stores that entry's filters again.

**To restore** — [`vault-filter-restore.guard.ts`](./vault-filter-restore.guard.ts) redirects a
vault URL that carries no filters to the same route with the remembered params:

```
/vault    →    /vault?vault.type=1&vault.folder=f-1
```

A guard does this rather than each link, because most arrivals are not a side nav click.
`redirectGuard` supplies the post-login and post-unlock landing, the product switcher and
`orgPermissionsGuard` navigate to `/vault` directly, and a bookmark enters the app at the URL. A
link that carried the params itself would restore for one of these and not the rest.

Register the guard after `vaultFilterLegacyRedirectGuard`. The legacy rewrite produces namespaced
params, which take precedence over the memory.

Register the guard only where the VFO1 vault renders. The web vault's `""` route declares it under
`featureFlaggedRoute`'s `flaggedRouteOptions`; each `:vaultId` route runs `canAccessFeature` first
in `canActivate`. Angular runs `canActivate` in order, so the flag is decided before the guard runs
and the guard does not check the flag itself.

The guard awaits the read. The memory is on disk, so the first vault navigation of a session has not
loaded it yet — and a bookmark or the post-unlock landing is exactly that arrival. A synchronous
read would return nothing on the cases that matter most.

The guard returns `true` when **the URL states its own filters**. `hasFilterParams()` decides this,
and it is broader than `rememberableParams()`: a link that carries only `vault.search` states a
filter the memory does not record, and a remembered type over that link would show rows the link did
not ask for.

That is the only precedence rule, and it covers back and forward too. A history entry with filters
keeps them, and one without filters takes the remembered params the way a bookmark does. Angular
replaces the entry rather than pushes when a guard redirects a browser navigation, so the history
stack keeps its shape.

### How a user clears the memory

There is no separate gesture. **Clear all** in the toolbar empties every chip, `queryParamStore`
drops a param whose value is empty, and the service records the bare URL that remains. The scope's
memory becomes `{}`, and the guard has nothing to restore.

A bare `/vault` the user types does _not_ clear the memory. A typed URL and a side nav click produce
the same URL, so no code downstream can separate them.

### Persistence

The service serializes writes on one chain, and each read awaits it. A scope change reads the memory
during the navigation, just after the service records the outgoing scope, so the read sees that
record rather than races it. The service catches a failed write, so one failure cannot block the
chain.

Each write names the user resolved at `NavigationEnd`, not the user active when the write lands. The
active-user alias resolves at write time, which during an account switch is the wrong account.

The state is on disk, and it clears on **logout only**, not on lock. On web an unlock starts most
sessions, so a clear on lock would leave nothing to restore.

## Legacy URLs

Vault filters used to live in un-namespaced params (`?type=login&folderId=…&vaultId=…`), and
bookmarks, emails, and links from other clients still carry that form.
[`vault-filter-legacy-redirect.guard.ts`](./vault-filter-legacy-redirect.guard.ts) rewrites them and
redirects when `FeatureFlag.VFO1Foundation` is on:

```
?type=login&folderId=abc     →    ?vault.type=1&vault.folder=abc
```

The guard passes through params it does not own (`cipherId`, `action`, …). It leaves a `type` it
cannot translate — `trash`, `archive` — in place, so the legacy filter can still apply it.

This guard checks the flag itself, unlike `vaultFilterRestoreGuard`. Desktop registers it on a plain
`/vault` route rather than a `featureFlaggedRoute`, and the web vault registers it on the unflagged
route as well as the flagged one, so no route decides the flag for it.

## Files

| File                                                                               | Responsibility                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`vault-filter-scope.ts`](./vault-filter-scope.ts)                                 | Route → scope resolution, route opt-in data, param allowlist |
| [`vault-filter-memory.service.ts`](./vault-filter-memory.service.ts)               | Records and serves each scope's last-seen filters            |
| [`vault-filter-restore.guard.ts`](./vault-filter-restore.guard.ts)                 | Redirects a filter-less vault URL to the remembered filters  |
| [`vault-filter-legacy-redirect.guard.ts`](./vault-filter-legacy-redirect.guard.ts) | Rewrites pre-namespace URLs                                  |
| [`vault-scope.guard.ts`](./vault-scope.guard.ts)                                   | Rejects a `:vaultId` that names no vault the user can reach  |
| [`organization-vault.guard.ts`](./organization-vault.guard.ts)                     | Narrows the `:vaultId` routes to organization vaults         |
| [`scoped-collection.ts`](./scoped-collection.ts)                                   | Reads the collection segment a vault route names             |
| [`exact-path.ts`](./exact-path.ts)                                                 | `IsActiveMatchOptions` for an exact vault nav link match     |

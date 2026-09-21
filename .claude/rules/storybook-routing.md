---
paths:
  - "**/*.stories.ts"
---

# Storybook: stories that need a router

Applies when the story's component injects `Router` / `ActivatedRoute`, renders `bit-breadcrumbs`,
or uses `routerLink`. Plain presentational stories need none of this.

## Never stub `ActivatedRoute` for a routed page

`{ provide: ActivatedRoute, useValue: { snapshot: { params } } }` looks harmless but breaks any
relative link in the template. Angular's `Router.createUrlTree` can't build a segment group from a
partial stub; it silently catches the failure and falls back to **the current URL**. A
`[route]="['..']"` breadcrumb then resolves to the page it's on and renders as the active page
instead of a link back to the parent.

Route the page for real instead — it also exercises the param reads the page actually does:

```ts
const routes: Routes = [
  {
    path: "organizations/:organizationId/access-rules",
    children: [
      { path: "", children: [] }, // the "up one level" target
      { path: "new", component: AccessRuleEditComponent },
      { path: ":accessRuleId", component: AccessRuleEditComponent },
    ],
  },
];

export default {
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({ providers: [provideRouter(routes, withHashLocation())] }),
  ],
} as Meta<AccessRuleEditComponent>;

export const Edit: Story = { decorators: [atUrl("/organizations/org-1/access-rules/rule-1")] };
```

Full example: `bitwarden_license/bit-web/src/app/pam/access-rules/access-rule-edit/access-rule-edit.component.stories.ts`.

## Give the story a URL, not just a router

`provideRouter([])` / `RouterModule.forRoot([])` can never match Storybook's own `/iframe.html?…`,
so the router URL stays pinned at `/`. Every crumb that resolves to `/` then reports itself active.
Register routes that match the URL you want, and put the story at it with a decorator:

```ts
/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };
```

The hash persists in the preview iframe after the story unmounts. That's inert for path-routed
stories, but if a story must leave no trace, navigate at bootstrap instead — `provideRouter(routes,
withDisabledInitialNavigation())` plus a `provideAppInitializer` calling
`router.navigateByUrl(url, { skipLocationChange: true })`.

For a component that takes inputs rather than route params, keep rendering it directly and derive
the URL from the story's args — see the `atFilterUrl` decorator in
`apps/web/src/app/admin-console/organizations/collections/vault-header/vault-header.component.stories.ts`.

## What `bit-breadcrumb` compares

`checkActiveRoute()` resolves the crumb's target exactly as `RouterLink` would — `route` plus
`queryParams`, `queryParamsHandling`, and `relativeTo` — then calls `router.isActive` with
`paths: "exact"` and `queryParams: "exact"`. So crumbs that navigate by query param
(`[route]="[]"` with a differing `collectionId`) only resolve correctly when the story's URL
carries those params.

Check the rendered markup, not just the screenshot: exactly one crumb should carry
`aria-current="page"`, and only when the trail includes the current page. Trails that end at the
page title (both vault headers, the PAM edit page) should have **no** active crumb — every crumb is
an ancestor link.

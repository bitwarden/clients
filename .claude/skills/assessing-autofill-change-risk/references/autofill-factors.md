# Autofill factors

Answer each `yes`, `no` or `unknown` with evidence. `unknown` counts as `yes`. Use these ids exactly. Each factor stands alone, so one can be added, removed or remapped without touching the others.

"Injected code" means anything that runs in or renders into the page: the `content/*` entries and the inline menu and notification bar pages in `apps/browser/webpack.base.js`, and the code they import. Most of it lives in `apps/browser/src/autofill/content/`, `overlay/`, `notification/` and `fido2/content/`.

The **Source** line says where the criterion comes from. `principles.md` is the Autofill principles document. Copy the section name into the output's `source` field, with the label the Sources section of SKILL.md sets.

## `vault-data-exposure`

Yes when the change sends new or more user data into the page context, sends a full model where a projection would do, sends data before the user engages, caches vault data in injected code longer than the experience needs it, or adds a stable Bitwarden-specific marker the page can observe.

- Look at: messages from background (`apps/browser/src/autofill/background/`) to injected code, and what injected code keeps in memory.
- Evidence: the message or property, and what newly reaches the page.
- Source: `principles.md`, "Keep the injected data footprint small".

## `content-script-dependencies`

Yes when injected code gains a third-party package, including one the repo already depends on. Also yes when a change adds an import chain that brings modules into a content script bundle that were not there before, including a change outside autofill to a shared module that injected code imports.

- Look at: imports added or changed in injected code, then what those modules import in turn.
- Import syntax settles nothing by itself. A narrowly imported module can itself import a barrel. Follow the chain or answer `unknown`.
- Source for third-party packages: `principles.md`, "Every dependency is attack surface", "A package approved for the repo is not approved for injected code".
- Source for import chains and barrels: review comment r4564778973 on clients PR 24688 ("Transitive dependencies of a narrow import can include a barrel"). `principles.md` only says to prefer narrow imports where a library supports tree shaking.

## `page-cost`

Yes when the change adds work on a content script hot path (field collection, mutation observers, scroll or resize handlers, timers), adds listeners, observers, timers or elements without teardown, or alters the page's DOM beyond what an injected experience renders.

- Look at: `apps/browser/src/autofill/content/` and `services/collect-autofill-content.service.ts`, `services/insert-autofill-content.service.ts`.
- A teardown path for each new listener, or before and after numbers from the content script instrumentation (`apps/browser/src/autofill/content/performance.md`), go in the evidence for the reviewer. The answer stays `yes`.
- Source: `.claude/rules/autofill-content-scripts.md` (teardown) and `principles.md`, "We are guests on the page".

### Proving `no`

`page-cost` has three disjuncts. "Not a hot path" alone is an assertion, not proof. To answer `no`, the evidence must rule out all three, each with a cited line, and should name a counter-example that would flip the answer so a reviewer can judge the gap between what was added and what would have been risky.

1. **Hot path.** Trace every new DOM read, DOM write, or `postMessage` back to the handler or caller that triggers it. State what the trigger is (event name, extension message, user action) and where it is attached. If the trigger is an event handler, confirm whether a cheap filter short-circuits before the new work runs, and cite its line. The factor's hot-path examples (field collection, mutation observers, scroll or resize handlers, timers) are a non-exhaustive list; a new continuous or per-event path can be a hot path even if it is not one of those four.
2. **Listeners, observers, timers, elements without teardown.** Grep the diff for `addEventListener`, `addListener`, `MutationObserver`, `IntersectionObserver`, `ResizeObserver`, `setInterval`, `setTimeout`, `requestAnimationFrame`, and element creation (`createElement`, `appendChild`, `insertBefore`, `insertAdjacentElement`). If any are added, cite the teardown. If none are added, say so and cite that the diff contains no such additions.
3. **DOM mutation beyond injected UI.** Confirm the diff adds no page-element writes: no `textContent =`, `innerHTML =`, `setAttribute`, `classList.*`, `style.*`, `.append*`, `.remove*`, `.replaceWith*` on anything other than injected elements the extension owns.

Then give at least one **counter-example**: a small plausible edit to the same diff that would make the answer `yes` (for example, lifting a query above a command filter, dropping a fallback gate, or attaching a scroll listener). A counter-example that changes nothing about the diff — because the diff already looks nothing like it — shows that the "no" is not accidental.

## `intent-and-policy`

Yes when the change alters when autofill acts without a user interaction (page-load autofill, auto-submit), changes a default setting, treats a page signal such as `autocomplete="off"` as a control, changes how organization policy applies, or changes what an organization can see of a personal vault.

- Look at: `content/auto-submit-login.ts`, `background/auto-submit-login.background.ts`, settings services, policy checks.
- Settings, policy and state-migration work often crosses into Vault, admin console and server code owned by other teams. Answer the baseline `contract-changes` and `persistent-data` factors for that part.
- Source: `principles.md`, "We are delegates of the user's intent", "Surface risk" and "Fail safe".

## `origin-matching`

Yes when the change alters how a fill is gated on the saved login's URIs matching where the fill lands, including iframe and cross-origin handling.

- Look at: URI matching and fill gating in `services/autofill.service.ts` and `services/default-fill-cipher-policy.ts`.
- Source: `principles.md`, "Hostile pages", "Fill only where the credential belongs".

## `injected-ui-integrity`

Yes when the change alters how the inline menu or notification bar is positioned, shown, layered or protected from being obscured, disguised or moved by the page.

- Look at: `apps/browser/src/autofill/overlay/` and `notification/`.
- Source: `principles.md`, "Hostile pages", "Protect injected UI from manipulation by the page".

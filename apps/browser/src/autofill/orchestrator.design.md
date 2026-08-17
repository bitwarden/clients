# The autofill orchestrator

> [!NOTE]
> Companion to [autofill.design.md](./autofill.design.md) — the autofill feature and its policies —
> and [lifecycle.design.md](./lifecycle.design.md) — _when_ a frame is worth engaging. This document
> covers how a fill is carried out safely once it is warranted.

The orchestrator is the single owner of fill execution. Every fill operation must flow through it.
It takes each request, reduces it to a concrete instruction — this cipher, into this target — hands
that to the autofill service, interprets the result, and reports an outcome.

It does not decide _when_ a fill is appropriate. The [monitoring lifecycle](./lifecycle.design.md)
decides that; the orchestrator consumes its decisions and executes them. Coordination is the
lifecycle's concern and execution is the orchestrator's, so the flow has a single source of
sequencing truth.

## Read, then commit

A fill separates into a step that only observes and a step that acts:

- A **read** collects a page's fields. It has no side effects and discloses no vault data, so it is
  safe wherever a frame is engaged.
- A **commit** places a credential. It is the one guarded, effectful step: it confirms the target is
  safe to fill, dispatches the fill, and — only if a credential was actually placed — runs the
  fill's user-visible effects.

Keeping these apart is load-bearing, not stylistic: every protection a credential needs belongs with
the commit, at the moment the credential is placed, and never with the harmless read. Between the two
sits selection — reducing a request to the single cipher the commit will place (see
[Cipher selection](#cipher-selection)).

## Invariants

The orchestrator exists to uphold the properties below. Each is a security boundary, not an
optimization; the [zero-knowledge model](https://contributing.bitwarden.com/architecture/security/definitions)
is what they protect.

### A credential fills only the tab the user is working in

A commit fills only the active, foreground tab — never a background one. Two layers uphold this. The
[monitoring lifecycle](./lifecycle.design.md) engages only the tab the user is working in, so a
page-load opportunity is aimed at the foreground from the start. The commit then re-verifies
foreground at the instant it fills — defense-in-depth against a race the first layer cannot close: an
opportunity can resolve, or a user-initiated fill be issued, and then the user switches tabs before
the fill reaches the commit. Re-checking as the credential is placed keeps it off a tab that was
foreground when the fill began but is not when it lands.

Verifying the target is foreground is the **default** for every fill, and exactly one path opts out:
the popup's fill round-trip. When a popout window is focused there is no active content tab for the
check to match, so it names its own target instead. Every other caller-supplied fill is supplied by
active-tab controls, and thus stays foreground-verified.

The opt-out is more than a convention. Two barriers keep it deliberate and contained. Only the
orchestrator's own code can request it. The key that disables the check is module-private, so no
other part of the extension can construct it. And the single unverified entry point is guarded by a
lint that flags every call site. Because the check is on-by-default, any _new_ fill path is
foreground-verified unless its author deliberately says otherwise.

### A credential reaches only the origin it was chosen for

A page-load fill targets the frame that produced the transition, re-resolved live by identity at the
moment of the fill, and proceeds only if that frame still shows the origin it reported. A transition
can be paused while its tab is away and resolved later; in the interval the frame may have navigated.
A fill carried from a stale snapshot would place a cipher chosen for the _old_ page into whatever now
occupies the frame — a credential handed to the wrong origin. Re-resolving by live identity and
re-validating the origin closes that gap; if the tab or frame is gone, or the frame has navigated,
the fill is abandoned rather than redirected.

A user-initiated fill acts on the tab the user just used, so its window is far narrower — but not
zero: the tab can navigate between the command and the fill. The commit guards _every_ fill against
this by proceeding only if the live tab at time-of-fill shows the URL the fill targeted.

### Each opportunity is executed once, on its own merits

The orchestrator runs each opportunity to a single conclusion and holds no retry of its own: the fill
either lands or is abandoned, and it keeps no memory that a given page was seen. A form still
rendering when the fill reaches it simply fills nothing. The re-attempt for such a form originates
upstream — the reporting frame notices it has not yet been filled and raises a fresh opportunity —
which the orchestrator then executes independently, judged only on its own merits. Keeping no
per-opportunity memory is what lets that stay correct without state to leak or desynchronize.

### Fills do not race

The orchestrator collects the details it fills rather than acting on details gathered elsewhere, so a
collect is always sequenced with the fill it feeds. Fills serialize at the granularity they target:
a page-load fill per frame, so a second arrival for a frame already filling waits its turn; a
user-initiated fill per tab, since it fills the whole tab in one pass. Sequencing collect-then-fill
this way prevents two fills of the same scope from interleaving into a double fill or a fill of the
wrong page.

### Recorded activity reflects a real fill

A fill records the account as recently active — which helps keep the extension unlocked — only when a
credential is actually placed, never on a mere attempt. A page that offers no fillable target cannot,
by asking to be filled, keep the vault unlocked. This bounds what a content script running outside an
isolated world can achieve.

## Cipher selection

The orchestrator, not the service, chooses which cipher a request fills. A page-load fill offers the
cipher the user most recently launched for the site, falling back to the last one used there. A
user-initiated command instead walks a rotation, so pressing the shortcut repeatedly cycles through
the ciphers that fit the page; card and identity requests walk their own rotations. A page-load fill
never advances a rotation — it consistently offers the same preferred cipher — while a command
advances it once a credential is placed, and steps past a cipher that demands re-prompt so the next
command offers the next candidate. Reprompt-protected ciphers are surfaced for confirmation only on a
user-initiated fill, never silently on page load.

## Automated login

Automated login both fills and submits, the highest-stakes fill of all. The orchestrator gives it no
special path: it runs through the same commit as any other fill — including the foreground
verification — so a credential is never submitted into a background tab. What makes a submit
_higher_ stakes, and the per-step host approval that authorizes one, belong to the feature and are
described in [autofill.design.md](./autofill.design.md#automated-login-auto-submit).

## The seam to the autofill service

The orchestrator reaches the page through a single fill operation: given one concrete cipher and one
target, it fills and reports whether it did. That operation makes no selection, targeting, or
foreground decision — the orchestrator supplies the cipher and target and runs the checks above the
seam. Keeping the fill contract this narrow is what lets the invariants live in one place rather than
being re-derived at each entry point. (The autofill service also carries older responsibilities that
sit outside this seam; see [autofill.design.md](./autofill.design.md#the-autofill-service).)

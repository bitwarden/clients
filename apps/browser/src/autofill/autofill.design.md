# Autofill

> [!NOTE]
> This document is **correct but incomplete**. Autofill
> has many other surfaces that this document does not yet cover.

## Autofill and the monitoring lifecycle

Autofill and the monitoring lifecycle are separate concerns. The
[monitoring lifecycle](./lifecycle.design.md) decides _when a frame is worth engaging_ — it
reconciles the page, account, extension, and tab lifecycles and, when a page transition resolves,
surfaces an **opportunity**: this frame has reached a point where a fill _may_ be appropriate.
Autofill decides _whether and how to fill_.

One rule spans every fill: autofill fills only the **committed** tab — the one the user is working in
(see the [tab lifecycle](./lifecycle.design.md#the-tab-lifecycle)) — and never an inactive one. The
lifecycle carries this for page loads, surfacing an opportunity only once a tab is committed and
holding it while the tab is away; a user-initiated fill acts on the active tab the user just used.
Either way a fill lands where the user is looking, never on a background tab.

## Autofill on page load

Autofill on page load is the response to a resolved page transition. When the lifecycle surfaces the
opportunity, autofill applies its policy before touching the page:

- **The autofill-on-page-load setting must be enabled.** It is off by default, and a user who has not
  opted in gets no page-load fill even on a committed, monitored frame. The monitoring lifecycle
  gates the _autofiller's injection_ on this same setting, but an already-injected autofiller is not
  re-evaluated when the setting changes — it keeps reporting transitions until logout or context
  loss — so this fill-time check, not the injection-time gate, is what enforces the setting when a
  user toggles it off mid-session.
- **A cipher must match the frame's page.** With no match there is nothing to fill, and the
  opportunity is discarded without collecting page details.
- **The frame's trust must permit filling.** A page-load fill into an untrusted iframe is refused as
  a policy decision, not retried.

Only when policy permits does autofill collect the frame's page details and fill it. A page-load
fill carries side effects that belong to the fill and must travel with
it: it records the account as recently active, copies a returned TOTP to the clipboard, and refreshes
the inline menu's cipher list so the overlay reflects what was filled.

The opportunity is per frame, so simultaneous page loads across frames are decided independently.

Every collect-and-fill runs through one dispatcher. A fill collects the page details it needs inside
the dispatcher rather than acting on details collected elsewhere, so collection is always sequenced
with the fill. Sequencing collect→fill this way keeps two fills of the same scope from racing each other
to perform a fill. This protects against sequencing errors, filling non-hot tabs, and double fills.

The two kinds of fill serialize at the granularity they target. A **page-load fill** is frame-scoped:
fills are serialized per (tab, frame), so one arriving for a frame already filling waits its turn. A
**user-initiated fill** is tab-scoped — it fills the active tab across its frames in
one pass — so these serialize per tab among themselves. The two kinds are not co-serialized against
each other; each holds its own ordering.

Stale-origin hazards are guarded independently of this ordering: on the page-load path by the fill-time
frame-URL re-check (see [Fill targeting](#fill-targeting)), and on the user-initiated path by collecting
and filling the active tab atomically at the moment the user acts.

## Automated login (auto-submit)

Automated login extends autofill with form submission logic. On identity-provider hosts an enterprise
administrator has approved, it carries the user through a multi-step sign-in without their intervention.
Filling and submitting are different stakes: a fill places a credential where the user can see it and
decide whether to send it, while a submit sends it. So the cost of acting on the wrong page rises from
a credential _shown_ to the wrong origin to a credential _transmitted_ to it. Automated login is gated
more tightly than any other fill to match.

Two constraints carry that weight. First, automated login runs only where policy permits: the
approved host set is administrator-configured and approval is re-checked at every
step rather than once at the start. A redirect can carry a frame off an approved host mid-login, so
the check that governs an action is the one taken at the moment of that action, not at injection.
Second, a frame is never trusted to declare itself part of an automated login. The frame
contributes only _timing_. It reports that its current step has rendered and is ready to be acted on.
Which frames are running the workflow is decided by trusted code from policy.

Automated login otherwise obeys the rules every fill obeys: it runs through the same single
dispatcher, which collects the details it fills so collection stays sequenced with the fill. The
wrong-page hazard is sharpest here, because a submit transmits. Automated login guards it at the
source: per-step host approval means a credential is submitted only into a frame that still
resolves to an approved host at the step that submits it.

## Fill targeting

A page-load fill targets **the frame that produced the transition**, resolved live, by id, at the
moment of the fill. It must not use a snapshot carried from when the transition was reported.

The distinction is a security boundary. A transition can be paused (see the
[tab lifecycle](./lifecycle.design.md#the-tab-lifecycle)): held while its tab is away and resolved
later, when the tab is committed again. Between report and fill, the frame may have navigated. Filling
from the transition's stale snapshot would put a cipher chosen for the _old_ page into whatever page
now occupies that frame — a credential handed to the wrong origin.

So the fill re-resolves the target tab by id and confirms the reporting frame still shows the URL it
reported with the transition message. If the tab or frame is gone, or the frame has navigated, the fill
is abandoned rather than redirected. Targeting the frame by its live identity and validating its origin
keeps a paused-then-resumed transition from filling the wrong page.

This applies to the page-load path specifically. Fills the user triggers directly — a keyboard
shortcut, or choosing a card or identity — legitimately target the active tab, because the user just
acted on the tab in front of them.

## Retry classification

A form that has not finished rendering when autofill reaches it looks, momentarily, like a page with
nothing to fill. Retrying blindly would spin on pages that genuinely have nothing; never retrying
would miss slow-rendering forms. Autofill distinguishes the two by the **outcome** of a fill attempt,
not by a "did I already fill this page" flag:

- **Retryable** — a cipher matched, but no field accepted a value yet. The form has most likely not
  rendered; the same attempt, made a moment later, may succeed. This is the only outcome that
  warrants a retry.
- **Terminal** — filling will not succeed by waiting: no cipher matched, the fill was refused on an
  untrusted iframe, or the target tab no longer matches the transition. A retry would re-run the same
  refusal. A successful fill is likewise terminal — there is nothing left to do.

A retry is a fresh attempt at the page-load opportunity after a short delay, gated on the tab still
being committed: if the tab has gone away or the transition has retired in the meantime, the retry is
abandoned. Because the decision to retry is made from the honest outcome of the attempt — not from a
flag set on the page — a page fills at most once per opportunity, whether it renders promptly or
slowly.

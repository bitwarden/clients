> **Scope:** This document describes the desired state for web browser autofill.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the design described within this document.

# Autofill

> [!WARNING]
> This document is **correct but incomplete**. Autofill
> has many other surfaces that this document does not yet cover.

## Autofill and the monitoring lifecycle

Autofill and the monitoring lifecycle are separate concerns. The
[monitoring lifecycle](./lifecycle.design.md) decides _when a frame is worth engaging_ — it
reconciles the page, account, extension, and tab lifecycles and, when a page transition resolves,
surfaces an **opportunity**: this frame has reached a point where a fill _may_ be appropriate.
Autofill decides _whether and how to fill_. The [orchestrator](./orchestrator.design.md) coordinates
the fill action, including resolving concurrent autofill requests. It decides which contexts are
targeted, how autofill operations are sequenced, and secures the autofill workflow at large.

One rule spans every fill: autofill fills only the **hot** tab — the active tab of the _focused_
window (see the
[tab lifecycle](./lifecycle.design.md#the-tab-lifecycle)) — and never a background or unfocused one.
The lifecycle carries this for page loads, surfacing an opportunity only when the tab is hot and
buffering it otherwise; a user-initiated fill acts on the active tab the user just used, which is
hot by construction. Either way a fill lands where the user is looking, never on a background
or background-window tab.

## Autofill on page load

Autofill on page load is the response to a resolved page transition. When the lifecycle surfaces the
opportunity, autofill applies its policy before it commits a fill:

- **The autofill-on-page-load setting must be enabled.** It is off by default, and a user who has not
  opted in gets no page-load fill even on a hot, monitored frame. The monitoring lifecycle
  gates the _autofiller's injection_ on this same setting, but an already-injected autofiller is not
  re-evaluated when the setting changes — it keeps reporting transitions until logout or context
  loss — so this fill-time check, not the injection-time gate, is what enforces the setting when a
  user toggles it off mid-session.
- **A cipher must match the frame's page.** Autofill reads the frame to learn its fields and selects
  the cipher saved for its URL; with no match there is nothing to fill and the opportunity is
  discarded.
- **The frame's trust must permit filling.** A page-load fill into an untrusted iframe is refused as
  a policy decision, not retried.

The opportunity is per frame, so simultaneous page loads across frames are decided independently.
Once policy permits, the fill is carried out by the [orchestrator](./orchestrator.design.md).

A page-load fill targets **the frame that produced the transition**, resolved live, by id, at the
moment of the fill. It must not use a snapshot carried from when the transition was reported.
This distinction is a security boundary. A transition can be buffered (see the
[tab lifecycle](./lifecycle.design.md#buffering-transitions)). Between report and fill, the frame may
have navigated. Filling from the transition's stale snapshot would put a cipher chosen for the _old_
page into whatever page now occupies that frame — a credential handed to the wrong origin.
Targeting the frame by its live identity and validating its origin keeps a buffered-then-resolved
transition from filling the wrong page.

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

The autosubmit code is susceptible to wrong-page fill hazards. Submit actions can change the URL
being filled, and fills happen at machine-speed. Per-step host approval means a credential is
submitted only into a frame that still resolves to an approved host at the step that submits it.
Beyond that gate, automated login obeys the rules every fill obeys, including the foreground
verification that keeps a submit off a background tab.

## Outcomes

Every fill attempt reports one of three outcomes:

- **Filled** — a credential reached the page and was placed.
- **Absent** — nothing was placed and nothing was refused: no field took the cipher. This is an
  ordinary result. A page that carries no fields for the chosen cipher reaches it, as does one whose
  frames report no fields at all.
- **Denied** — the attempt never reached the page, because a fill invariant did not hold. Often, denied
  attempts occur because the request was invalidated by a navigation event. Denial can also occur due
  to a policy control (the request is not permitted) or a failed security check.

Absent and denied outcomes are both forms of fill-failure. Their distinguishing feature is whether
autofill operations should terminate or continue. A denied response terminates the request. An
absent response may mitigate the failure (say, by copying a TOTP code).

A form that has not finished rendering when autofill reaches it looks, momentarily, like a page with
nothing to fill. A retry is a fresh attempt at the page-load opportunity after a short delay, gated
on the tab still being hot: if the tab has gone cold or the transition has been dropped in the meantime,
the retry is abandoned. Because the decision to retry is made from the honest outcome of the attempt,
a page should fill at most once per opportunity, whether it renders promptly or slowly.

### Reading an outcome

When a fill attempt uses a credential featuring a TOTP code, the current value of the code may be
included in the response. Releasing the code follows the user's auto-copy preference and their
entitlement to verification codes for that cipher. A denial forbids the release of a TOTP.

> [!IMPORTANT]
> Autofill performs TOTP fill operations onto the page. The outcome of a fill should not be
> used to perform a secondary fill operation. It is permitted, however, to copy the code into
> a different structure, such as the system clipboard,
> [as governed by our security principles](https://contributing.bitwarden.com/architecture/security/principles/).

## The autofill service

The autofill service's **fill operation** is a narrow primitive: given a concrete cipher and a
target, it fills and reports whether it did. It makes no selection, targeting, or foreground
decision. The [orchestrator](./orchestrator.design.md) chooses the cipher, verifies the tab the
user is working in, and sequences the collect with other autofill operations. Keeping the
fill contract narrow lets autofill's fill invariants live in one place rather than being
re-derived at every entry point.

The service applies **policy** during fill operations. This includes enforcing enterprise policy,
reading a user's settings, and checking whether licensing entitlements permit an action.

The service also carries broader, older autofill responsibilities including injecting the content scripts,
driving the reprompt popout, event and TOTP handling. These are under active migration. The direction
is to keep the fill operation the service's only hand in placing a credential, with selection and
coordination remaining the orchestrator's.

# Autofill

> [!NOTE]
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

One rule spans every fill: autofill fills only the **committed** tab — the one the user is working in
(see the [tab lifecycle](./lifecycle.design.md#the-tab-lifecycle)) — and never an inactive one. The
lifecycle carries this for page loads, surfacing an opportunity only once a tab is committed and
holding it while the tab is away; a user-initiated fill acts on the active tab the user just used.
Either way a fill lands where the user is looking, never on a background tab.

## Autofill on page load

Autofill on page load is the response to a resolved page transition. When the lifecycle surfaces the
opportunity, autofill applies its policy before it commits a fill:

- **The autofill-on-page-load setting must be enabled.** It is off by default, and a user who has not
  opted in gets no page-load fill even on a committed, monitored frame. The monitoring lifecycle
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
Once policy permits, the fill is carried out by the [orchestrator](./orchestrator.design.md), which
sequences the collect with the fill, targets the reporting frame by its live identity, and books the
fill's user-visible effects only when a credential is actually placed.

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

## The autofill service

The autofill service's **fill operation** is a narrow primitive: given a concrete cipher and a
target, it fills and reports whether it did. It makes no selection, targeting, or foreground
decision. The [orchestrator](./orchestrator.design.md) chooses the cipher, verifies the tab the
user is working in, and sequences the collect with other autofill operations. Keeping the
fill contract narrow lets autofill's fill invariants live in one place rather than being
re-derived at every entry point.

The service also carries broader, older autofill responsibilities including injecting the content scripts,
driving the reprompt popout, event and TOTP handling. These are under active migration. The direction
is to keep the fill operation the service's only hand in placing a credential, with selection and
coordination remaining the orchestrator's.

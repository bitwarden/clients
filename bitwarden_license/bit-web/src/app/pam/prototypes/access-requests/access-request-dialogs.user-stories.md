# Access Request Dialogs — User Stories

A single dialog shell is used for every access-request state across three contexts:

- **Approvals** — the approver's point of view, deciding on or managing a request they own.
- **My requests** — the requester's point of view, tracking or acting on their own request.
- **History** — read-only audit view, available to anyone who can see the record.

Each entry below captures the user story, job to be done, and acceptance criteria for one state in one context, so we can confirm the dialog is doing the right thing for the person looking at it.

---

## Approvals (approver's POV)

### Pending

**User story.** As an approver, I want to review a pending request with full context (who is asking, what they want, why, and for how long) so that I can confidently approve or deny.

**Job to be done.** Decide whether to grant a teammate access to a specific vault item.

**Acceptance criteria.**

- Requester identity, requested item, justification, and requested access window are all visible without scrolling past them.
- Approve and Deny are both reachable from the footer.
- Deny is visually separated from Approve so it cannot be mis-clicked.
- Status badge reads "Pending approval".

---

### Approved

**User story.** As an approver, I want to re-open a request I already approved so that I can confirm the terms, or withdraw the approval if circumstances changed before the requester uses it.

**Job to be done.** Audit an approval I made and reverse it if it should no longer stand.

**Acceptance criteria.**

- Decision summary (who approved, when, for how long) is visible.
- Withdraw approval action is available as the primary footer action.
- No approve or deny controls. The decision has already been made.

---

### Denied

**User story.** As an approver, I want a read-only view of a denial I made so that I can reference it later for compliance or follow-up without any risk of changing the decision.

**Job to be done.** Recall what I denied and why. Treat the record as closed.

**Acceptance criteria.**

- No actions available in the footer (Close only).
- Denial reason is visible if one was captured.
- Status badge reads "Denied".

---

### Expired

**User story.** As an approver, I want expired requests to read as clearly closed so that I don't try to act on a stale request after the approval window has passed.

**Job to be done.** Understand why a request didn't go through and recognize that the decision window is over.

**Acceptance criteria.**

- No actions available in the footer (Close only).
- Status badge reads "Expired" using the danger variant to match the "blocked" outcome.
- Shows when the request expired.

---

### Ready to use

Approved by me, requester has not yet opened the item. List badge reads "Ready to use".

**User story.** As an approver, I want to withdraw an approval before the requester activates it so that I can reverse the decision cleanly without disrupting a live session.

**Job to be done.** Pull back an approval while the window is still unused.

**Acceptance criteria.**

- Withdraw approval is the primary action.
- Status badge reads "Ready to use".
- Dialog surfaces who has access and the active window.

---

### Active

Approved by me, lease is active and healthy. List badge shows remaining time (e.g. "42m left").

**User story.** As an approver, I want to end a session that's currently in progress so that I can revoke access the moment I decide it should stop.

**Job to be done.** Cut a live session short because something changed since I approved.

**Acceptance criteria.**

- End session is the primary action and uses the destructive style.
- Status badge shows the remaining lease time (e.g. "42m left").
- Session details (requester, started at, ends at) are visible.

---

### Ending soon

Approved by me, lease is close to the end. List badge reads "Ending soon · 4m left".

**User story.** As an approver, I want to see when a session is minutes from ending so that I can decide whether to let it finish on its own or cut it immediately.

**Job to be done.** Monitor a session that's about to end and intervene if needed.

**Acceptance criteria.**

- Status badge reads "Ending soon · {N}m left" using the danger variant.
- End session action remains available for immediate cutoff.
- Remaining time is prominent enough that it drives the decision.

---

## My requests (requester's POV)

### Pending

**User story.** As a requester, I want to check on my pending request and cancel it if I no longer need access so that approvers don't waste time on stale asks.

**Job to be done.** Monitor the status of my own request and withdraw it if plans changed.

**Acceptance criteria.**

- Shows that the request is waiting on an approver.
- Cancel request action is the primary footer action.
- Shows who the approver(s) are so I can follow up out-of-band if needed.

---

### Approved

**User story.** As a requester, I want to start my session when I'm ready to work so that my access window doesn't start burning down until I actually need it.

**Job to be done.** Start the session I was approved for, on my timing.

**Acceptance criteria.**

- Start session is the primary action.
- Approved time window and who approved are visible.
- No countdown has started yet. The clock begins at activation.

---

### Denied

**User story.** As a requester, I want to see why my request was denied and resubmit if I still need access so that I can address the approver's concern instead of guessing.

**Job to be done.** Understand the denial and decide whether to try again.

**Acceptance criteria.**

- Denial reason is visible if the approver provided one.
- Submit new request action is the primary footer action.
- Status badge reads "Denied".

---

### Expired

**User story.** As a requester, I want to resubmit when my request expired so that I don't have to re-enter everything from scratch when nobody acted in time.

**Job to be done.** Restart the request flow after the decision window closed.

**Acceptance criteria.**

- Status badge reads "Expired".
- Submit new request action is available.
- Prior request context (item, justification, duration) stays visible for reference.

---

### Ready to use

My request was approved, I haven't opened the item yet.

**User story.** As a requester, I want to start my approved session when I'm ready so that the lease clock only starts when I actually begin work.

**Job to be done.** Activate my session on my own timing.

**Acceptance criteria.**

- Start session is the primary action.
- Shows the total approved duration (not a countdown yet).
- Status badge reads "Ready to use".

---

### Active

My session is active. "End my session" is the destructive-slot primary.

**User story.** As a requester, I want to end my own session when I'm done so that I release access cleanly instead of leaving a window open longer than I need.

**Job to be done.** Close out my session early and release access.

**Acceptance criteria.**

- End access is the primary action and uses the destructive style.
- Remaining time on the lease is clearly displayed.
- Session details confirm what I'm about to end.

---

### Ending soon

My session has minutes left. Nudges me to resubmit if I need more time.

**User story.** As a requester, I want a clear nudge when my session is almost over so that I can wrap up or kick off a new request to extend my access without losing continuity.

**Job to be done.** Know how much time is left and decide whether to extend.

**Acceptance criteria.**

- Status badge reads "Ending soon · {N}m left" using the danger variant.
- End access remains available for a clean shutdown.
- Remaining time is prominent enough to drive the decision.

---

## History (read-only, no actions)

Every record in History is terminal. The footer is always Close-only; the body varies with how the record closed.

### Session ended (historical)

**User story.** As anyone reviewing history, I want a read-only view of a completed session so that I can audit what happened without any risk of changing the record.

**Job to be done.** Reference a lease that ran to completion during an audit or follow-up.

**Acceptance criteria.**

- No action buttons in the footer (Close only).
- Full decision context (requester, approver, item, window, outcome) is visible.
- Status badge reads "Session ended" using the subtle variant.

---

### Denied (historical)

**User story.** As anyone reviewing history, I want a read-only view of a past denial so that I can audit the decision without any risk of changing the record.

**Job to be done.** Reference a historical denial during an audit or follow-up.

**Acceptance criteria.**

- No action buttons in the footer (Close only).
- Denial reason is visible if one was captured.
- Status badge reads "Denied".

---

### Revoked (historical)

**User story.** As anyone reviewing history, I want to see when an approver cut a live session short so that I can tell an interrupted lease apart from one that ended on its own.

**Job to be done.** Audit a lease that was ended early by the approver mid-session.

**Acceptance criteria.**

- No action buttons in the footer (Close only).
- Decision cluster shows who approved and includes the withdraw reason.
- Status badge reads "Revoked" using the danger variant so an approver-interrupted lease reads at the same weight as Denied or Expired.

---

### Canceled (historical)

**User story.** As anyone reviewing history, I want to see when the requester pulled their own request so that I can tell self-canceled asks apart from denials.

**Job to be done.** Audit a request the requester withdrew before any decision was recorded.

**Acceptance criteria.**

- No action buttons in the footer (Close only).
- No decision cluster is rendered. No approve or deny ever happened.
- Status badge reads "Canceled" using the subtle variant.

---

### Expired (historical)

**User story.** As anyone reviewing history, I want a read-only view of a request that expired without a decision so that I can see when approvers didn't act in time.

**Job to be done.** Audit a request that timed out of its approval window with no lease ever issued.

**Acceptance criteria.**

- No action buttons in the footer (Close only).
- No decision cluster is rendered. No decision was recorded before the window closed.
- Status badge reads "Expired" using the danger variant.

---

## Withdraw approval confirmation

Withdraw lives inside the same detail dialog. `step="withdraw"` swaps the body to the destructive ask plus reason input and swaps the title to match. The back arrow in the dialog header returns to the detail view.

**User story.** As an approver, I want to provide a reason when I withdraw an approval so that the requester understands why the decision changed and I'm forced to be deliberate about a destructive action.

**Job to be done.** Confirm a withdrawal with a short note that the requester will see.

**Acceptance criteria.**

- Reason field is required. "Withdraw approval" stays disabled until a reason is entered.
- Primary action is labeled "Withdraw approval" and uses the destructive style.
- Back arrow in the header returns to the detail view without discarding the typed reason.
- Cancel is available as a secondary action.
- Identity card (who, what) stays visible so the destructive action always has context.

---

## Feedback toasts

The page translates each action emitted by the detail dialog into a toast plus an optimistic update.

**Success feedback.**

- Request approved
- Request denied
- Approval withdrawn
- Request canceled
- Access activated
- Session ended

**Error feedback.**

- Couldn't approve request
- Couldn't withdraw approval
- Approval expired (warning variant)
- Connection failed

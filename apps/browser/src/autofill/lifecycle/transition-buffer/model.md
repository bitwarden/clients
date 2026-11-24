> **Scope:** This document describes the model of the transition buffer: its concepts, invariants, terminology, and semantics.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the model described within this document. It is prescriptive and broad. It is not a specification.

# The transition buffer

A page reports a transition when its document changes. The user may not be looking at the tab when
that happens. The buffer carries a reported transition from the moment it is reported to the moment
autofill may act on it, or to the moment it is known to be worthless. It does not decide whether a
fill happens.

## Concepts

- **Transition** — a fact about one document: the account that was active when it was reported, the
  tab and frame that reported it, the identity the browser assigned the document, the moment it was
  reported, and the deadline after which it no longer matters. A transition identifies a document
  without describing it. It carries nothing from the page.
- **Opportunity** — a transition that has resolved, as it leaves the module. It is a signal that this
  frame has reached a point where autofill _may_ act. It identifies the document, the account, the
  tab, and the frame, and it carries the deadline. It carries a cancellation token that is cancelled
  when the transition expires. It carries nothing the buffer keeps for its own bookkeeping, and it is
  not stored.
- **The buffer** — a store of transitions that are waiting. It holds at most one transition for each
  frame, the latest. It acts on instructions and knows nothing of tabs, accounts, or lifecycles.
- **Disposition** — what a transition reported on a tab deserves at that moment: to be buffered, to
  be resolved, or to be dropped. A tab's disposition follows from the last change of state the tab's
  lifecycle reported. It is a conclusion drawn from a transition of state, not a copy of the state.
- **The controller** — the role that reads signals from the environment and directs the buffer. The
  environment speaks of accounts, tabs, frames, and reloads. The buffer speaks of transitions. The
  controller translates between them and is the only party that instructs the buffer.

## Terminology

| Term              | Meaning                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Report**        | To tell the controller that a document has changed. Reports arrive without an account.                                |
| **Stamp**         | To attach the active account, the moment, and the deadline to a report, making it a transition.                       |
| **Buffer** (verb) | To hold a transition until its tab is hot.                                                                            |
| **Resolve**       | To release a transition as an opportunity.                                                                            |
| **Drop**          | To end a transition without it becoming an opportunity. A dropped transition is gone.                                 |
| **Clear**         | To drop every transition, whatever its tab or frame.                                                                  |
| **Forget**        | To drop every transition of a tab, and everything the buffer remembers about it.                                      |
| **Admission**     | Whether the buffer accepts transitions at all. It follows the active account.                                         |
| **Expiry**        | A transition is expired once the moment of its deadline arrives.                                                      |
| **Release**       | The span in which an opportunity may be acted on: while its tab is hot. An opportunity expires when its release ends. |
| **Hot**           | The tab is the active tab of the focused window and has settled. It is the only state in which a transition resolves. |

## Invariants

1. **The buffer never decides by tab state.** It buffers, resolves, and drops when told to. Whether
   a transition may resolve is decided before the buffer is instructed, and follows from what the
   tab's lifecycle has reported.
2. **Disposition follows transitions of state.** Nothing keeps a tab's state. What is kept is the
   conclusion a change of state implies. A tab's states are virtual, and consumers interpret changes,
   not states.
3. **An unseen tab buffers.** A tab whose lifecycle has reported no change is in its initial state,
   which buffers. The buffer fails open for tabs. It fails closed through admission, which is off
   whenever no signed-in account is active.
4. **Attention gates resolution.** Only a hot tab resolves, because only there is the user attending
   to the page.
5. **A transition belongs to one document and one account.** The account is the one active when the
   transition arrives, and the buffer is shared by every account.
6. **Only the latest transition for a frame is kept.** A transition never replaces a newer one for
   the same frame, whatever order they arrive in.
7. **A transition leaves for a reason.** It leaves the buffer only by resolving or by being dropped,
   and every drop has a cause. A transition that arrives before the buffer can judge it, such as
   before the accounts are known, waits and is judged in the order it arrived.
8. **An expired transition never leaves the buffer as an opportunity.** It may stay in storage until
   it is replaced or its tab is forgotten, because staying costs nothing. Forgetting a tab leaves
   none of its transitions behind.
9. **A transition that resolves on arrival is never stored.** There is nothing to carry across a
   restart, so nothing is written.
10. **Storage serves the buffer and never shapes it.** A stored buffer survives a restart of the
    extension. If storage fails, the buffer continues in memory with the same behavior, and
    transitions that were waiting at the moment of failure are lost. Persistence is a degradable
    property.
11. **The record is shared and opaque.** A stored record is shared across accounts and describes
    documents without describing pages, so it discloses no browsing activity.
12. **An opportunity expires when its release ends.** It is released while its tab is hot, so it
    expires when its tab leaves hot, when its tab is removed, and when a newer transition for its
    frame resolves. The older opportunity expires before the newer one leaves the module.
13. **One driver.** The buffer has exactly one controller, and a stored buffer has exactly one
    writer. A second driver would interleave instructions that were meant to be ordered.

## Semantics

### A transition arrives

The controller stamps the report with the active account and the moment it arrived. If admission is
off, or the tab was removed, the transition is dropped. Otherwise the tab's disposition decides what
happens:

| The tab's lifecycle last reported a change into | Disposition     |
| ----------------------------------------------- | --------------- |
| cold, warming up, or cooling down               | buffer          |
| hot                                             | resolve at once |
| warm or frozen                                  | drop            |
| no change has been reported                     | buffer          |

A transition that resolves at once passes by the buffer. A warm tab is deliberately a drop and not a
buffer: the active tab of a background window is out of scope for a page-load fill.

A tab that was removed stays removed. A transition that arrives for it afterwards is dropped.

### A tab changes state

- A change into hot resolves the tab's waiting transitions, unless a command caused the change. A
  command carries its own fill, so a page-load opportunity for the same tab would only repeat it. The
  command consumes the waiting transitions by dropping them.
- A change into warm drops them.
- A change that leaves a buffering state for any state but hot ends the waiting. A transition cannot
  wait on a tab that is neither buffering nor about to resolve.
- A change from one buffering state to another leaves the waiting transitions as they are.
- Stopping and starting monitoring is not a change in disposition. A tab that stops monitoring and
  still buffers keeps its transitions.

### The frame, the tab, and the extension change

- A frame that no longer exists, or that the extension no longer holds a connection to, drops its
  transition.
- A tab that is removed is forgotten.
- A reload of the autofill scripts clears the buffer and leaves admission as it was. The scripts that
  reported are replaced, and the scripts that replace them report afresh.
- A restart of the extension loses everything but the stored record. The record is restored while
  admission is on, and each restored transition is judged by its tab's disposition, as a transition
  that has just arrived is: it is buffered, resolved at once, or dropped. A restored transition that
  has expired is dropped.

### The account changes

The buffer follows the active account. Whether an account is locked or unlocked does not change
what it holds, only what autofill may do with it.

- Logout of the active account ends admission and clears the buffer.
- A lock of the active account, or a change of the active account, clears the buffer and leaves
  admission on. The session the transitions belonged to has ended. A transition reported afterwards
  is still a fact about a page and is kept.
- Admission resumes when the active account is a signed-in account again.
- Before the accounts are first observed, no judgment is possible. Transitions that arrive wait,
  and are judged when the observation arrives. A waiting transition keeps the moment it arrived, so
  waiting does not lengthen its life. It is dropped, as the buffer is, when the session or the scripts
  it belonged to end, and when its tab or frame is gone.

### Age

A transition stays actionable for a bounded time from the moment it was reported. The bound is a
tuned value. The deadline is an absolute moment, so it survives a restart. An opportunity may pass
its deadline after it leaves the buffer, and whoever acts on it confirms that it has not.

### An opportunity expires

The opportunity the buffer resolves leaves with a token, and the token is cancelled when the
opportunity expires. A tab that leaves hot, for any reason, expires the opportunities of its frames,
as does a tab that is removed. A newer transition that resolves for a frame expires the older
opportunity of the frame. If the module ends or fails, every opportunity it handed on expires as
a safeguard.

An opportunity that has expired never becomes unexpired. Passing the deadline does not expire it:
whoever acts on an opportunity refuses one that is past its deadline.

## What the model does not decide

- **When a tab is hot.** The tab lifecycle decides that.
- **Whether a fill happens.** Autofill decides that, from its own settings and policy, when the
  opportunity resolves.
- **How long a transition stays actionable.** A tuned value decides that, outside the model.
- **How a document is identified.** The browser assigns identity, and the model relies on it.

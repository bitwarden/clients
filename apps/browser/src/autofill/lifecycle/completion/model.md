> **Scope:** This document describes the model of lifecycle completion: its concepts, invariants, terminology, and semantics.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the model described within this document. It is prescriptive and broad. It is not a specification.

# Lifecycle completion

A frame exists within a tab, and a tab exists within the session of the active account. Each has a
lifecycle that ends. Completion states the moment one ends. It decides nothing, and it is unaware of
what listens.

## Concepts

- **Lifecycle** — the span of existence of a frame, a tab, or a session, which is not the tab's
  state machine. A frame's lifecycle lasts while the frame exists in an open tab and the active
  account has a session. A tab's lifecycle ends when the tab is removed, and a session's ends when the active
  account's session does. The end of a tab's ends the lifecycle of each of its frames, and the end of
  the session ends every lifecycle.
- **Completion** — the fact that a lifecycle has ended. It is momentary: it is stated once, when the
  lifecycle ends, and it is not restated to anyone who asks later.
- **Reach** — which lifecycles a completion applies to: one frame, one tab together with every frame
  in it, or all of them.

## Terminology

| Term         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| **Complete** | To state that the lifecycles within a reach have ended.                  |
| **Session**  | The span in which the active account is signed in, unlocked, and active. |
| **Frame**    | A frame of a tab. The top frame of a tab has no frame id.                |

## Invariants

1. **Completion states a fact and decides nothing.** It reports that a lifecycle ended. Reacting to
   a completion is the listener's responsibility.
2. **Completion is a single encapsulated signal, whatever the cause.** A listener hears one thing
   and never enumerates causes. A new cause is an addition to the module and no change to a listener.
3. **Completion is momentary.** It reaches the listeners present when it occurs, and the module
   never delivers it again to a listener that arrives later.
4. **A completion is as narrow as its cause.** The loss of a frame reaches that frame and no other
   frame of its tab. The removal of a tab reaches every frame of the tab. The end of a session
   reaches everything.
5. **Only the active account's session ends lifecycles.** A lock or logout of an account that is
   not active completes nothing. A change to another signed-in account as the active account does.
6. **The first observation of the accounts completes nothing.** It describes the accounts as found,
   and no change has happened yet. Only changes reported after it complete anything.
7. **A change of a tab's attention completes nothing.** Whether a tab is the one the user is working
   in is not a condition of its lifecycle.
8. **Completion reads facts and keeps no copy of them.** It keeps what a fact implies, such as which
   account is active and whether the accounts have been observed. It does not keep a tab's state, a
   frame's liveness, or an account's status.

## Semantics

### What completes a lifecycle

| Cause                       | Reaches                |
| --------------------------- | ---------------------- |
| The tab is removed          | Every frame of the tab |
| The frame is lost           | That frame             |
| The active account locks    | Every lifecycle        |
| The active account logs out | Every lifecycle        |
| The active account changes  | Every lifecycle        |

### What does not complete a lifecycle

- **A change in a tab's state.** A tab that becomes active, inactive, focused, or unfocused keeps its
  lifecycle.
- **A change to an account that is not active.** The session belongs to the active account.
- **A lock or logout that the first observation reports.** The first observation describes the
  accounts as found. It is not a change of them.

## What the model does not decide

- **What a listener does when a lifecycle ends.** The listener decides that.

The causes are stated to the module by other parts of the extension: the browser states that a tab
is removed, the frame monitor states that a frame is lost, and the account events state which
account is active and when it locks.

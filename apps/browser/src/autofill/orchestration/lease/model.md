> **Scope:** This document describes the model of fill ordering: its concepts, invariants, terminology, and semantics.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the model described within this document. It is prescriptive and broad. It is not a specification.

# Fill ordering

Fills and collects on the same page must not interleave. A collect renumbers the fields a fill
addresses, so a collect that runs between another fill's collect and its commit can redirect that
fill. Two fills of the same frame can overwrite each
other. And some fills depend on what an earlier request did: an eager fill's re-attempt, and a fill
the user confirmed after a reprompt denied an earlier one.

So every operation that touches a page holds a lease on the part of the page it touches. Collects
share their leases. A fill's lease is exclusive, and fills never wait in line for one: an arriving
fill preempts the lower-ranked fills in its way, waits for those already ending, or completes as
cancelled before it starts. A workflow decides how one fill is carried out; a lease decides whether, and when, it may
begin.

## Concepts

- **Request** — one fill or one collect, from the moment its entry point is called until it
  completes.
- **Arrival** — the moment an entry point is called, before it awaits anything. A request waits only
  for requests that arrived before it.
- **Scope** — the part of a tab a request touches: the whole tab, or one frame of it. A request's
  scope comes from its entry point: a report's frame, or the frame or tab its caller names.
- **Lease** — a request's permission to run on its scope. A collect holds a **shared** lease. A
  fill holds an **exclusive** lease.
- **Conflict** — two requests conflict when their scopes overlap and at least one lease is
  exclusive. A tab's scope overlaps each of its frames. Two frames' scopes do not overlap.
- **Source** — who started a fill: a policy, the user, or a transition report (an eager fill). A
  fill's source ranks it.
- **Preemption** — a fill cancelling conflicting fills that rank below it.

## Terminology

| Term           | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| **Holder**     | A request whose lease is granted, and which has not completed.              |
| **Waiting**    | A request that has arrived, and whose lease is not yet granted.             |
| **In the way** | A fill, holding or waiting, that conflicts with an arriving fill.           |
| **Ending**     | A fill whose token is cancelled, and which has not completed.               |
| **Complete**   | A request is done: a fill with its result, a collect with its page details. |

## Invariants

1. **Every collect and every fill holds a lease.** No entry point reaches the page without one.
2. **Fills never wait for fills, except for one that is ending.** At most one fill that is not
   ending holds or waits for a lease on any part of a tab. A request waits only for conflicting
   requests that arrived before it, so a fill can wait for a fill outside its way through a collect
   between them (see "Collects and fills").
3. **An arriving fill is decided against every fill in its way, at once.** When any fill in its way
   is not ending and does not rank below it, the arriving fill completes as cancelled before it
   starts, and cancels nothing. Otherwise it cancels each fill in its way that is not yet ending, and
   waits until every fill in its way has completed.
4. **A fill waits for the conflicting collects that arrived before it.**
5. **A collect waits for the conflicting fills that arrived before it,** holding or waiting. Collects
   never wait for one another.
6. **A fill's lease spans its whole workflow.** It is granted before the target phase and released
   when the fill completes, its re-attempt and its effects included, so no conflicting request runs
   between an attempt and its re-attempt.
7. **A collect's lease spans the collect, and the collect waits for monitoring inside it,** as a
   fill's read does (see the workflow's `model.md`, "A read waits for monitoring"). A collect on a
   tab that is not yet monitoring blocks until it is, because what it collects is what a waiting
   surface, such as the inline menu, shows.
8. **A fill collects inside its own lease.** It never fills from page details another request
   collected.
9. **Preemption does not reach past a commit.** It cancels through the fill's token, so a holder
   whose commit has begun completes, and the preempting fill waits for it.
10. **A request cancelled while it waits completes at once,** and delays nothing that arrived after
    it.
11. **Every request completes.** A fill that never runs, because it was cancelled or a fill in its
    way did not rank below it, completes as cancelled. A collect that never runs completes with no
    page details. The end of a request's tab cancels its token; its entry point composes that token,
    and the lease does not watch tabs.
12. **Leases order background work only.** The page's own fill, which runs after the background's
    commit resolves, and the collects the page starts itself, are not ordered by a lease.

## Semantics

### Scopes and sources by entry point

| Entry point                                       | Lease     | Scope                       | Source |
| ------------------------------------------------- | --------- | --------------------------- | ------ |
| Eager fill                                        | exclusive | the report's frame          | eager  |
| Keyboard command, cipher-type command             | exclusive | tab                         | user   |
| Context-menu fill                                 | exclusive | tab                         | user   |
| Popup fill                                        | exclusive | tab                         | user   |
| Inline-menu fill (a cipher, a generated password) | exclusive | tab                         | user   |
| Auto-submit step                                  | exclusive | the reporting frame         | policy |
| Collect (popup, page load, field focus)           | shared    | the frame named, or the tab | —      |
| Autofill triage                                   | shared    | the frame named, or the tab | —      |

A fill's source is its plan's target source: `Reported` is eager, `User` is user, and `Policy` is
policy. The top frame is frame `0`, so an eager fill of the top frame conflicts with a tab-wide
fill, as does an eager fill of any other frame.

### An arriving fill

| A fill in its way is…                  | The arriving fill…                       |
| -------------------------------------- | ---------------------------------------- |
| ending                                 | waits for it to complete                 |
| ranked below it, and not ending        | cancels it, and waits for it to complete |
| ranked with it or above it, not ending | completes as cancelled before it starts  |

| Arriving fill | Preempts    |
| ------------- | ----------- |
| Policy        | user, eager |
| User          | eager       |
| Eager         | nothing     |

A fill never preempts a fill of its own rank, so the earlier intent stands: a second keyboard
command during the first is cancelled, and the rotation advances once, after the first fill. A
preempted eager fill does not re-attempt, because a cancelled fill never does.

An eager fill superseded by a newer report for its frame is ending before the newer fill arrives,
because the lifecycle cancels the older fill's token when the newer report resolves. So the newer
fill waits for the older one, and is not cancelled by it.

The inline menu's fill is a user fill with the tab's scope, so it preempts every eager fill in the
tab, and its collect is its own (invariant 8).

### Collects and fills

A fill that waits for collects to complete is in the way of every conflicting fill that arrives
after it, as a holder is. A conflicting collect that arrives after it waits behind it, so a stream of
collects cannot hold a fill back.

## What the model does not decide

- **A deadline for monitoring.** A request blocks until its tab monitors. A tab that never does is
  the lifecycle's to correct.
- **The page's side.** Leases bound the runtime state of the extension code. Content script state
  is not managedf by leases.

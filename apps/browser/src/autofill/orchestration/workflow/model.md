> **Scope:** This document describes the model of the fill workflow: its concepts, invariants, terminology, and semantics.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the model described within this document. It is prescriptive and broad. It is not a specification.

# Fill workflow

A fill is a sequence of phases. Each phase verifies that the extension and the page are as it needs
them, and then acts. A workflow runs the phases of one fill in their fixed order, and stops the fill
at the first phase that ends it. The workflow knows the order and when a fill may still be
cancelled. It knows nothing of the systems a phase works with.

## Concepts

- **Phase** — one step of a fill: finding its target, reading the page, selecting a cipher,
  reprompting the user for the master password, and committing the fill. A phase encapsulates the
  systems it works with, and is built with only the services it needs.
- **Check** — the part of a phase that verifies its preconditions. It changes nothing. When a
  precondition fails, it reports the result that ends the fill.
- **Execute** — the part of a phase that acts. It runs only when its check passes. It adds what it
  learned to the fill's context, or reports the result that ends the fill.
- **Request** — what a fill was asked to do: the account it was made for, and what it carries, such
  as a tab, a report, a cipher, or a page. A phase whose sub-plan calls for a part of the request
  that the request lacks ends the fill as invalid.
- **Context** — what a fill knows. It begins as the request, and each execute adds to it. A phase
  reads what every earlier phase added.
- **Look** — the workflow's reading of the fill's cancellation token, immediately before an execute.
- **Commit** — the last phase, which fills the page. Its execute is the point of no return.
- **Effect** — work that follows a commit that filled, such as advancing a rotation or copying a
  code.
- **Re-attempt** — a second run of every phase, for a fill that was absent.
- **Plan** — the data that decides a fill: the kind of request it accepts, a sub-plan for each
  phase, the effects, and whether an absent fill is re-attempted. A plan is written for one entry
  point, so it states the actions that entry point's fill calls for.
- **Sub-plan** — the part of a plan that decides one phase: its variant, and the actions it takes.
- **Eager fill** — a fill triggered automatically. These are also known as "page load" fills; the
  workflow avoids this term due to ambiguity with a page's `onload` event.

## Terminology

| Term           | Meaning                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| **End**        | To stop a fill with a result. The commit's execute always ends the fill.         |
| **Cancelled**  | The fill's token says the fill must stop. A look reads it.                       |
| **Target**     | The tab a fill is anchored to, and the document the fill was requested for.      |
| **Monitoring** | The tab's content scripts are examining the page, so they answer a collect.      |
| **Variant**    | One implementation of a phase. A plan chooses one variant for each phase.        |
| **Absent**     | The fill affected no fields. Every absent result means this, whatever its cause. |

## Invariants

1. **The phases run in one order.** Target, read, select, reprompt, and commit. A plan chooses a
   variant for each phase, and never reorders, repeats, or omits one. A plan that skips a step
   says so, so the decision is visible in the plan.
2. **A check changes nothing.** It reads the extension, the browser, and the page, and it may wait
   for them. It never acts on them, and it never interacts with the user.
3. **A phase's result is final.** The workflow reports the result a phase ended the fill with, as
   the phase reported it.
4. **The workflow looks before each execute, and only then.** A cancelled fill ends as cancelled,
   and the execute does not run. Nothing waits between the look and the execute.
5. **An interaction with the user is an execute.** It is a phase of its own, so that its check can
   end the fill before the user is asked anything.
6. **The context only grows.** An execute adds to it and never replaces what the request or an
   earlier phase holds.
7. **The commit is the point of no return.** Its execute is not given the token. Once it begins,
   nothing cancels the attempt.
8. **Effects follow only a commit that filled.** Their order is arbitrary, and each appears in a
   plan at most once. The fill ends when they have run. They never change the fill's result. An
   effect that fails is reported, and the others still run. Work that must run before or after
   other work is a phase, not an effect.
9. **A fill is re-attempted at most once, and only when it was absent.** An absent result from any
   phase is re-attempted. The re-attempt begins when its plan's wait ends, and runs every phase
   again, its checks included. A cancellation ends the wait instead, and the fill keeps its absent
   result. A wait that errors rejects the fill in place of the re-attempt.
10. **Plans are data, and they belong to the orchestration.** A caller chooses an entry point,
    never a plan, and no plan is built outside the orchestration. Each phase is built from its own
    sub-plan. Any dependencies between phases are fixed within each sub-plan. Phases do not read
    each other's sub-plans during construction.
11. **The commit requires the active tab unless its plan opts out.** Only the place that builds
    plans can opt out, and only for fills the extension initiates. A plan that says nothing requires
    the active tab.
12. **The request names the account.** A fill that chooses its cipher chooses from the account it
    was requested for, and every fill commits for that account, after verifying it is still active
    and unlocked. The workflow does not select the account to fill from.
13. **A plan alone decides what no caller may.** Whether a fill submits, and whether it fills an
    untrusted iframe, come from the plan. A caller that needs either chooses an entry point whose
    plan allows it.
14. **A plan states the kind of request it accepts.** A request of another kind ends the fill as invalid
    before any phase runs.

## Semantics

### The phases

| Phase    | Checks                                                                                                                                                                                      | Executes                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Target   | The request's tab has an id, and its top frame's document was named when the fill was requested. A reported target's report holds.                                                          | Records the target.                                                                            |
| Read     | The tab is monitoring and holds the target's document. A reported target's report holds.                                                                                                    | Collects the page, or takes the page the request carries.                                      |
| Select   | A fill that chooses its cipher: the request's account is active and unlocked. A login's target has a URL.                                                                                   | Chooses the cipher, or takes the cipher the request carries.                                   |
| Reprompt | A fill that cannot prompt the user has a cipher that requires no reprompt. A fill the user confirmed the reprompt for has the cipher the request carries, or one that requires no reprompt. | A fill that can prompt the user asks for the master password when needed, which ends the fill. |
| Commit   | The tab is the active tab unless the plan opts out, and holds the target's document. A reported target's report holds. The request's account is active and unlocked.                        | Fills the page.                                                                                |

### The target

A fill is anchored to its tab. Its target's document is the document the tab's top frame held when
the fill was requested. Before they act, the read and the commit each verify that the tab still
holds that document. A fill whose target was reported also verifies the document of the frame that
reported it, within the report's deadline. A fill requested in response to a transition report
reads its target's document when its target resolves, so a re-attempt resolves its target again.

The target's URL selects the cipher. It does not verify the page.

### A read waits for monitoring

A tab that is not monitoring answers a collect with nothing. The read's check waits until the tab is
monitoring. A cancelled token ends the wait, and the fill, as cancelled. A tab that is already
monitoring does not wait.

## What the model does not decide

- **Which fills share a lane.** Lanes precede workflows and scope them. A workflow runs one fill.
- **How a tab that never monitors is reported.** The read's wait has no deadline.
- **Which variant a plan chooses.** The plans decide that, as data.

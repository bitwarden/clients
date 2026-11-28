> **Scope:** This document describes the patterns the autofill lifecycle module follows.
>
> **Audience:** Engineers should align their decisions and code generators should align their implementation with the patterns described within this document. It is prescriptive and broad. It is not a specification.

# Patterns of the autofill lifecycle module

> [!NOTE]
> Companion to [design.md](./design.md), which describes the lifecycle the module governs, and to
> [transition-buffer/model.md](./transition-buffer/model.md), which describes one object the module
> holds. This document describes how the module's parts are shaped, so that a new part can be shaped
> the same way.

## Tagged unions use an enum-like for their tags

A **tagged union** is a type whose members differ in shape and are told apart by one field, the
tag. A message from the environment, a signal for the tab lifecycles, and a request to fill are each
a tagged union.

The values of a tag come from an **enum-like**: a frozen object of named constants, and a type of the
same name that is the union of the constants' values. A member of the union names the constant's
type as its tag, never a primitive.

The reasons are practical:

- **A tag is a symbol.** A name that the compiler checks cannot be misspelled, and a rename is one
  edit that reaches every place that sends or handles the member.
- **A reader can find every use.** Searching for a constant finds each place a member is produced
  and each place it is handled. Searching for a string finds unrelated text as well.
- **Sending reads as what it is.** A member's name says which vocabulary a value belongs to. An event
  sent into a state machine is not mistaken for a request to fill, though both are plain objects.
- **Handling is exhaustive.** A `switch` over the constants is checked for completeness, and a new
  member is a compile error in every place that has not handled it.

The rules that follow from it:

- Every producer and every consumer names a member of the enum-like. This includes the tests.
- Each member documents the fact it stands for, in terms of the environment and not of the code that
  handles it.
- The enum-like lives beside the types that use it, and is shared when more than one file does.
- A union keeps one name for its tag.
- The values are strings, so that they read well in a log or a debugger. They are compared as
  constants all the same.
- When two vocabularies name the same moments from different sides, such as what is sent into a
  machine and what the machine reports out, each keeps its own constants, and the one that comes
  second says which of the first it repeats.

## The controller

A **controller** is an object in a feedback loop. It takes signals from its environment and directs
another object, so that the changes of the environment have the right effect on it. The environment
speaks of things the directed object does not know, such as tabs, frames, and accounts. The
controller translates what the environment says into what the directed object understands.

### Its shape

- **It reads signals and holds what it directs.** A controller is constructed with its signals, as
  observable streams, and with the object it directs. It subscribes when it is constructed, and ends
  its subscriptions when it is disposed.
- **It offers only what its owner needs.** That is a stream of results, or a query about what the
  controller derived. It does not offer the means to instruct the object it directs.
- **It has no hidden timing.** A signal is an event that has happened. A controller does not
  schedule a wait of its own for something the environment has not said.

### How it applies events

- **The signals become one ordered stream of events.** Each event carries a tag, from an enum-like.
  The merging is signal processing and is kept apart from the controller's decisions.
- **One event is applied at a time, in the order events arrive.** An event that arrives while
  another is applied, because applying it caused it, waits its turn. No signal has to be ordered
  against another by its source.
- **State is current before anyone hears of a change.** The controller updates what it keeps, and
  then instructs the object it directs, so that whatever hears of the instruction finds the
  controller as it is after the event.
- **A signal that cannot be judged yet waits, in order.** An event that depends on what has not yet
  been observed is held, and is judged when the observation arrives, in the order it came.

### What it keeps

- **It keeps conclusions, not copies.** A controller accumulates what a change of state implies, such
  as whether a tab's frames should be monitoring, as a flag for each tab. It does not keep another
  component's state. A state that no signal has reported is the initial state, and the controller
  declares what the initial state implies. It says whether a thing it has not seen is allowed or
  not, and it says so for each concern. It does not start from a read of every other component.
- **It forgets with its subject.** When the thing a flag belongs to ends, the flag ends with it. An
  ended thing stays ended: a signal that arrives for it afterwards is dropped.

### The object it directs

- **It is a domain object.** It holds what the domain holds, and its methods are commands in the
  domain's own terms. They are not signals, because the controller has already turned signals into
  decisions. Methods compose more cleanly than streams where decisions are made.
- **It never reads the environment.** It does not know how its instructions were decided.
- **It has one driver.** A second driver would interleave instructions that were meant to be ordered.
  Nothing outside the controller instructs the object.

### How it is built

- **Construction and signals are separate.** What is fixed for the life of the extension, such as the
  storage provider, the clock, tuned values, and the handlers for failure, is bound first, in a
  factory. The signals are bound later, when the integration site has them in place.
- **The factory returns the controller's output.** Nothing outside can reach the directed object
  through it. The lifetime of the controller and the object is the lifetime of a subscription: when
  the subscription ends, both are disposed, the controller first.
- **An object that must outlive failure is built to.** A directed object that can lose a resource,
  such as its storage, handles the loss itself and carries on with the rest of its behavior. The
  controller does not know that a loss happened.

### When it fails

- **A signal that fails ends the controller's direction.** The failure is reported to the owner. The
  controller does not guess a replacement for a signal it has lost, because a guess is a decision
  made on stale facts.
- **Recovery belongs to the integration site.** Only the owner has the resources to rebuild what
  failed: to subscribe again and to bring the object back to what the signals now say. The
  controller makes that possible by being disposable and by holding no state that must survive
  its own end.

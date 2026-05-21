---
name: design-review
description: >
  Bitwarden design team's Code of Conduct combined with the 30-60-90 critique framework. Use this
  skill when giving feedback on a design, reviewing a Figma file or UI mockup for critique (not
  implementation — that's figma-to-angular), evaluating a design proposal, or when the user asks
  for a design critique. Triggers on phrases like "review this design", "critique this",
  "feedback on this mockup", "what do you think of this UI", "design review", or when a design
  is shared for review rather than build.
---

# Design Principles & Critique

This skill grounds design feedback in the Bitwarden design team's Code of Conduct and the
30-60-90 maturity framework. Critique the product, not the designer. Feedback must be
actionable, stage-appropriate, and rooted in product goals — not personal preference.

## Step 1: Identify the stage

Before giving feedback, identify (or ask) what stage the design is at. The kind of feedback
that's useful depends entirely on this.

- **30% — a rough idea.** The designer is exploring direction. Easy to pivot or throw away.
  Looking for: ideas and impressions, whether this is something we should do, whether it's the
  right direction, how to move the concept forward, go/no-go on the idea.
- **60% — a first draft of a set concept.** Significant time has gone into this; direction
  shouldn't change drastically without strong reason. Looking for: whether 30% critique was
  addressed, visual/graphic feedback, feedback on interactive components, ways to expand the
  concept.
- **90% — last check before development.** Should already be tested with real users. No drastic
  changes expected. Looking for: whether 60% critique was addressed, nitty-gritty grammar,
  finalizing copy, final check on the minutiae.

If the user doesn't say the stage, ask. Don't give 90%-style nitpicks on a 30% sketch, and
don't suggest sweeping direction changes on a 90% design.

## Step 2: Critique the product, not the designer

A **good** design meets its goals. A **bad** design does not meet its goals. Likes and dislikes
are irrelevant.

- **Talk about strengths**, not just weaknesses. Good critique empowers — understanding what
  works helps decide what to keep.
- **Separate like/hate from good/bad.** Consider product goals over personal opinions.
- **Ask questions instead of making assumptions.** If something isn't clear, ask why a decision
  was made.
- **Don't try to design a better solution on the spot.** Focus on what about the current design
  isn't meeting its intended purpose. The designer can address it when they have more time.

### Phrasing

| Instead of             | Try                                                         |
| ---------------------- | ----------------------------------------------------------- |
| "Why did you do that?" | "What are you trying to achieve by doing x?"                |
| "I don't like it"      | "I'm not sure that x makes it clear to users they can y"    |
| "Why don't we just…"   | (skip — don't design on the spot; describe the gap instead) |

## Step 3: Filter feedback through the Code of Conduct

The Bitwarden design team operates by five principles. Let them shape what to flag and how.

1. **We design proactively, not reactively.** Lead with strategy, planning to innovate and
   shape the product's future rather than just reacting to demand. Create space for
   intentionality, so every designer can be thoughtful, detail-oriented, and proud of their
   work. Flag missed opportunities for intentional, forward-looking design — especially at the
   30% stage.

2. **We design with empathy, verified by insights.** User voices guide decisions through
   regular conversations, research, and data. Bring customers to the forefront of every
   discussion, empowering partners in Product and Engineering to think customer-first. Every
   feature shipped should be user-centered, tested, and proven. When a design choice is
   unsupported by insight, surface it as an open question — not a flaw, but a gap worth closing
   before 60%.

3. **We design with confidence and humility.** Trust expertise while remaining open to being
   wrong. Navigate ambiguity together, make clear decisions, and move forward — staying open
   to changing course as more is learned. Even minor iterations can transform outdated
   experiences into something to be truly proud of. Frame feedback as contribution to a shared
   solution, not as a verdict.

4. **We work as a unified team.** Collaboration with Product and Engineering should be smooth
   and transparent. Design files should be clear, easy to navigate, and well-organized with
   shared understanding. Operate with clarity, confidence, and care — trust is the foundation,
   and everyone is encouraged to contribute their best. Flag ambiguity that will make handoff
   painful.

5. **A year from now, we want a Bitwarden UI we're proud to put our names on** — one that
   earns the trust of millions because we designed it with the trust of each other. Hold
   feedback to that bar.

## Step 4: Evaluate content alongside visual design

At **60%** and especially **90%**, evaluate user-visible copy (button labels, headings, error
messages, empty states, helper text, etc.) against the `content-style-guide` skill — voice,
tone, sentence case, no ampersands, meaningful link text, gender-neutral pronouns, no spatial
language, and the rest. Treat content findings as first-class critique points, not afterthoughts.

Skip content nitpicks at **30%** — direction, not copy, is the question at that stage.

## Output format

Structure the critique as:

1. **Stage** — confirm or ask (30% / 60% / 90%).
2. **Strengths** — what's working and should stay.
3. **Questions** — what isn't clear; what to ask the designer to clarify.
4. **Actionable feedback** — specific, product-goal-anchored observations the designer can
   address. Match the granularity to the stage. At 60%/90%, include content observations
   tied to the `content-style-guide`.

Keep feedback specific. "The CTA hierarchy makes it unclear which action is primary" beats
"the buttons feel off." Tie each point back to a user or product goal where you can.

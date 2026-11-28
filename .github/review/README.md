# Review rules

BitHub decides which teams must review a pull request. CODEOWNERS says who owns each file, and every
owning team must review changes to its files unless a review rule here says otherwise.

Each team keeps its review rules in `.github/review/<team>/`, where `<team>` is the team's GitHub
slug as CODEOWNERS names it. CODEOWNERS gives each folder to its team, so only that team approves
changes to its rules.

## What a review rule is

A review rule is a markdown file:

- Its front matter lists `paths`, as quoted globs relative to the repository root. Globs match
  dotfiles.
- Its body says, in plain language, which changes to those paths don't need the team's review.

On each pull request, BitHub reads the rules as they are on the base branch. For a changed file a
team's rule covers, a model judges the change against the rule's body. The team is not required
only when every rule covering the file allows it.

## What stays required

- A file no rule covers needs its owning team's review, as CODEOWNERS says. To keep code always
  reviewed, leave it out of your rules' `paths`.
- A rule only applies where its team owns the path in CODEOWNERS. It can't change another team's
  review.

## Guidance for implementation agents

Claude Code doesn't read this folder. To have your team's agents see your criteria while they write
code, add a Claude Code rule under `.claude/rules/` with the same `paths`, whose body points to
your review rule. See `.claude/rules/auth-review-guidance.md` for an example.

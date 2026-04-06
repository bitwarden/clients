---
name: create-pull-request
version: 0.1.0
description: Pull request creation workflow for Bitwarden Clients. Use when creating PRs, writing PR descriptions, or preparing branches for review. Triggered by "create PR", "pull request", "open PR", "gh pr create", "PR description".
---

# Create Pull Request

## PR Title Format

```
[PROJ-XXXXX] Short imperative summary
```

**Examples:**

- `[PM-12345] Add passkey support to vault item creation`
- `[CL-1124] Increase badge max-width`
- `[PM-33446] Ensure attachments are cleared on clone`

**Rules:**

- Include the Jira ticket prefix (e.g. `PM-`, `CL-`)
- Keep under 70 characters total
- Use imperative mood in the summary

---

## PR Body Template

**IMPORTANT:** Always follow the repo's PR template at `.github/PULL_REQUEST_TEMPLATE.md`. Add TODO items to the screenshots section for each scenario that should be captured if any.

---

## Pre-PR Checklist

1. **All tests pass**: Run `npm test`
2. **Lint clean**: Run `npm run lint`
3. **No unintended changes**: Check `git diff origin/main...HEAD` for unexpected files
4. **Branch up to date**: Rebase on `main` if needed

---

## Creating the PR

```bash
# Ensure branch is pushed
git push -u origin <branch-name>

# Create PR as draft by default (body follows .github/PULL_REQUEST_TEMPLATE.md)
gh pr create --draft --title "[PM-XXXXX] Short summary" --body "<fill in from PR template>"
```

**Default to draft PRs.** Only create a non-draft (ready for review) PR if the user explicitly requests it.

---

## Base Branch

- Default target: `main`
- Check with team if targeting a feature branch instead

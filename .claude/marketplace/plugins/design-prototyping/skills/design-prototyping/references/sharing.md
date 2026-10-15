# Sharing a prototype

`bitwarden/clients` is a **public** repository. Anything pushed (branches, draft PRs, Chromatic builds) is publicly visible. Offer the private option first, and before anything public, make sure the designer understands that.

## Option 1: Live link inside the org (default)

In a GitHub Codespace, the Storybook port can be shared with the organization only:

1. Tell the designer to open the **Ports** panel, right-click port 6006, and choose **Port Visibility → Organization**. (With the `gh` CLI: `gh codespace ports visibility 6006:org -c "$CODESPACE_NAME"`.)
2. Give them the forwarded URL with the story path: `https://$CODESPACE_NAME-6006.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN/?path=/story/<story-id>`.

The link only works while the codespace is running. Nothing is pushed.

## Option 2: Durable link via draft PR + Chromatic (public)

Use only after the designer confirms the prototype may be public. Ask in plain language: "This will publish the prototype publicly on GitHub and Chromatic. OK to share?" Confirm again before every later push.

### First share

1. Branch: `design/<github-username>/<prototype-name>`, created from the current branch. Use `gh api user -q .login` for the username.
2. Commit only the prototype folder (`libs/components/src/stories/playground/<prototype-name>/`). Message: `[Design prototype] <Prototype name>`.
3. Push and open a **draft** PR:
   - Title: `[Design prototype] <Prototype name>`
   - Body: the repo's PR template, with Objective describing the prototype in a few sentences and noting it is a design prototype not intended to merge. Include the Figma link if there is one.
   - No reviewers. Add the `design-prototype` label if it exists; skip it otherwise.
4. Wait for the Chromatic checks (`gh pr checks <pr> --watch`). One of them (typically "Storybook Publish") links to the build's Storybook. The Chromatic workflow only runs for branches in `bitwarden/clients`, not forks.
5. Give the designer the **branch permalink**, which stays the same across later pushes: take the build URL `https://<build-hash>--<app-id>.chromatic.com` and replace `<build-hash>` with the branch name, slashes turned into dashes, e.g. `https://design-jdoe-vault-empty-state--<app-id>.chromatic.com`. Append `/?path=/story/<story-id>` to link straight to the story.

### Updating

Each "update the shared version" is a new commit and push on the same branch, after confirming. The permalink stays the same; Chromatic takes a few minutes to rebuild.

### Rules

- Never merge, never mark the PR ready for review, never request reviewers.
- Never commit files outside the prototype folder.
- Never force-push.

### Cleanup

When the designer is done, offer to close the PR and delete the branch (`gh pr close <pr> --delete-branch`), after confirming.

## Handing off to engineering

When the designer wants to hand off, write a short summary for an engineer: what the prototype shows, which components it uses, any places where the library didn't support the design (gaps for the design system team), and the share link. Offer it as text the designer can paste into Jira or Slack.

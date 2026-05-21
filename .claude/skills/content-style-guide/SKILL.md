---
name: content-style-guide
description: >
  Bitwarden's product content style guide for GUI copy — voice, tone, grammar, mechanics, and
  accessibility rules for end-user-facing text (button labels, error messages, toasts, modal
  copy, onboarding, empty states, etc.). Use this skill when reviewing or rewriting product copy,
  when generating components from Figma (figma-to-angular) so generated strings follow the guide,
  and during design critiques (design-review) to evaluate content alongside visual design.
  Triggers on phrases like "review this copy", "is this error message ok", "rewrite this button
  label", "check the wording", "what should this say", or when end-user-facing strings are being
  authored or critiqued. Does NOT cover developer-facing strings, code comments, design tokens,
  or marketing/long-form content.
---

# Product Content Style Guide

This skill grounds GUI copy decisions in Bitwarden's product content style guide. Apply it to
end-user-facing strings only — button labels, error messages, toasts, modals, onboarding flows,
empty states, form labels, helper text, link text, and similar. Do not apply to design tokens,
code comments, internal/dev-facing strings, or marketing copy.

When in doubt about a specific case, ask before changing copy.

## Voice and tone

**Voice is constant. Tone flexes with context.**

Product voice is **approachable, encouraging, and transparent** — consistent across platforms.

Tone conveys mood and depends on who you're talking to and what's happening. Security is serious
stuff. Users aren't looking for humor or fluff — they want to know their information is safe. So
Bitwarden's product tone is **almost always serious and respectful**.

Tone spectrums:

- Casual ↔ formal
- Enthusiastic ↔ matter-of-fact

Where common content types land on the tone map (axes: casual ↔ formal × matter-of-fact ↔ enthusiastic):

| Content type     | Casual / Formal   | Matter-of-fact / Enthusiastic |
| ---------------- | ----------------- | ----------------------------- |
| Success messages | Casual            | Enthusiastic                  |
| Onboarding copy  | Casual            | Enthusiastic                  |
| Dialogs          | Casual            | Matter-of-fact                |
| Empty states     | Casual            | Matter-of-fact (slightly)     |
| Labels           | Neutral           | Matter-of-fact                |
| Community        | Formal            | Enthusiastic                  |
| Confirmations    | Formal            | Matter-of-fact                |
| Help articles    | Formal (slightly) | Neutral                       |
| Warnings         | Formal            | Matter-of-fact                |
| Error states     | Formal            | Matter-of-fact                |

### Examples

**Error message — formal, matter-of-fact:**

- ✔ An error occurred. Please try again.
- ✘ Uh oh! We goofed. Go ahead and refresh!

**Onboarding message — casual, enthusiastic:**

- ✔ Hey there! 👋 Welcome to Bitwarden. We'll show you around!
- ✘ This is your vault. Get started now.

## Grammar and mechanics

Default to **Associated Press style**, with the exceptions noted below.

### Acronyms

In body text, spell out acronyms at first reference, then add the acronym in parentheses
immediately after. On second and subsequent references, use only the acronym.

In UI, it's ok to use the acronyms **SSO** and **SAML** on first reference, but **not IdP**.

### Ampersands

Avoid ampersands. Spell out **and** in all references — including headings and button text.

### Capitalization

Use **sentence case** for most text on the page, including headers, button text, table headings,
modal headings, etc. (Marketing materials use title case for button text — but product UI does
not.)

**Product names and plans — capitalize:**

- Secrets Manager
- Password Manager
- Enterprise
- Teams
- Families

**Features — default to lowercase unless there's a good reason.**

Generally, don't name and capitalize features. One named feature isn't a big deal, but when
everything in software gets named, the information architecture becomes inconsistent and the
user has to learn and remember what things are called. Call features what they are. Example:
prefer "shared folders" over "Collections".

Currently capitalized features (mixed state — will evolve):

- Send
- Access Intelligence
- Objects

**Lowercase objects — these are not proper nouns:**

- secrets, passwords, items, vault, favorites, folders, extension, organization, policy

**Bitwarden teams — lowercase:**

- "support team", "Bitwarden sales team"

### Dates and months

For emails, blog posts, or anywhere with white space, use: **September 19, 2025**.

- Capitalize and spell out each month.
- Include a comma after the date.
- Include the year.
- Do NOT include `st`, `nd`, `rd`, or `th` after the date.
- Avoid all-numeric dates (e.g., 1/13/20) — confusing for ESL readers and translation.

Abbreviate the month only when spacing is an issue (mostly product UI). No periods:

- Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sept, Oct, Nov, Dec

### Days of the week

Spell out each day. If space is limited, use **Mon, Tue, Wed, Thu, Fri, Sat, Sun** (no periods).

### E.g. and i.e.

- **e.g.** = for example; cite a few examples.
- **i.e.** = that is / in other words; further explain.
- Both are followed by a comma.

For translation, prefer "for example" and "this means" over the Latin abbreviations.

### Ellipsis

Use mainly to indicate deletion of text. Also use in loading spinners to indicate users are
waiting a few seconds for something to load. **No spaces** before or after.

### File sizes and formats

Capitalize file sizes and formats; don't spell them out: **GB, MB, ZIP, PDF, JPG, HTML, PNG, GIF,
CSV, EXIF**. Lowercase only inside a filename (e.g., `cat.jpg`).

### Money

For USD, include the dollar sign and amount. Only include cents when non-zero:

- ✔ $3 or $3.99
- ✘ $3.00

**Exception:** Checkout UI totals always show cents, even when zero.

### Numbers

Numerals are ok for numbers under 10, especially in components with little space. With plenty
of space, spell out one through nine. For numbers over **1,000**, always include a comma.

### Oxford comma

**Use it.** Adds clarity, especially in longer sentences. (Exception to AP style.) If a
sentence has many commas, consider simplifying.

### Times and time zones

Bitwarden products determine time zone and time based on user location — but not date format.

Format: **9 PM**. Include a colon and minutes only if not `:00`. Don't include seconds.
Capitalize AM/PM with no periods. (Exception to AP style.)

Default time zone: **EDT (Eastern Daylight Time)**.

### Versus

Write as the full word **versus** or **vs.** (with a period).

## Writing for accessibility and inclusivity

### Write simply and directly

Target a **U.S. 7th-grade reading level**. Short sentences and paragraphs. Active voice. Simple
verb tenses. Avoid adverbs and adjectives.

- ✔ Delete file
- ✘ Would you like to delete this file?

Exception: in UI where the verb focus should be the object — e.g., "The file was saved."

### Create scannable layouts

Follow header hierarchy (H1, H2, H3, H4) — don't skip levels. Assistive tech relies on this. If
a level is skipped, users assume they missed a section.

- ✔ `[H2] File types` → `[H3] Images`
- ✘ `[H2] File types` → `[H4] Images`

Paragraph text 16 pt or larger. Line height 1.5×. Space after paragraphs 2× the font size. Use
bulleted/numbered lists where appropriate.

### Consider non-English and ESL speakers

Avoid idioms, phrases, and emojis that don't translate well. Treat them as decorative —
acceptable for zest, but not load-bearing for meaning.

- ✔ Nice job
- ✘ Hats off to you

### Spell out acronyms

Never assume the reader knows the acronym. Spell out at first reference per page, with the
acronym in parentheses. Then use only the acronym.

### Don't imply tasks are easy or simple

Tasks aren't equally easy for everyone — assistive tech, cognitive ability, and environment all
affect speed. Give helpful information instead.

- ✔ Follow these three steps.
- ✘ Follow these fast, easy steps.

### Use text styling sparingly

Italics, bold, and ALL CAPS are harder to read. Screen readers don't always identify font
styles. Don't apply to full paragraphs.

Always **left-align paragraph text**. Justified and center-aligned text is harder for people
with dyslexia.

### Avoid spatial language

Use time-based ("next", "before") or element-based ("in the dropdown") directions, not spatial
("above", "below", "on the left"). Spatial directions confuse screen reader users.

- ✔ In the global menu
- ✘ In the top left corner of the screen

### Focus on critical info in alt text

If a visual conveys information, describe it in alt text, caption, or paragraph text. Keep alt
text under 125 characters where possible. Don't write "image of" — repetitive with screen
readers.

If the visual isn't critical:

- Write short alt text so users know what's there but can move on, OR
- Leave alt blank and add `aria-hidden="true"` so screen readers skip it.

- ✔ search results for airplanes
- ✘ image of search results for the keyword phrase "airplanes" which includes 63 images and PDF documents and the download button circled

### Write meaningful link text

Link text should tell the user what they're clicking or where they'll go. Don't write "Click
here." Screen reader users may jump from link to link.

- ✔ Read this article about integrations.
- ✘ Click here to learn more about integrations.

Don't add a separate "Learn more" sentence — usually repetitive.

- ✔ Turn on the new vault feature.
- ✘ The new vault feature is now available. Learn more about the feature and how to turn it on.

Always underline link text so colorblind users can see it.

### Stay gender neutral

Use **they** or **you** instead of gendered pronouns like he/she.

## Applying this skill

**During explicit copy critique** ("review this copy", "is this error message ok"):

1. Identify the content type (error, onboarding, button, etc.) and the expected tone.
2. Check voice consistency (approachable, encouraging, transparent).
3. Walk grammar and mechanics rules relevant to the snippet.
4. Walk accessibility rules relevant to the snippet.
5. Return specific, actionable rewrites — not just "this is wrong."

**Inside figma-to-angular runs:**

When the Figma design includes copy strings, validate them against this guide before emitting
them into the Angular template. If a string clearly violates a rule (e.g., title-case button,
ampersand, "Click here" link), surface the issue and propose a compliant alternative — do not
silently rewrite. Ask the user which to use.

**Inside design-review critiques:**

If the stage is 60% or 90%, include content observations alongside visual feedback (90% is the
right stage for "nitty-gritty grammar, finalizing copy"). Skip content nitpicks at 30% — the
copy will change. Frame content feedback the same way as visual feedback: tied to user/product
goals, not personal taste.

## Output format for copy critique

1. **Content type and expected tone** — name what this string is and where it should land on
   the tone spectrum.
2. **What's working** — what to keep.
3. **Issues** — each tied to a specific rule from this guide (cite the section).
4. **Proposed rewrite(s)** — concrete alternatives the user can pick from.

Keep critique specific. "The button uses title case; sentence case per [Capitalization]" beats
"the capitalization is off."

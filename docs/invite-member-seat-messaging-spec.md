# Spec: Invite Member seat limit and billing error messaging

**Status:** Draft for design and product review
**Scope:** The Invite Member flow in the web vault (Admin Console > Members > Invite member)
**Out of scope:** Restore member access, confirm member, accepting an invite link, the Subscription page, provider client dialogs, autoscale notification emails

---

## 1. Why this exists

A ticket asked for one string change: add the seat count to the error a reseller-managed organization sees when it runs out of seats.

While scoping it we found the underlying problem is bigger. Inviting a member can fail for **eleven distinct reasons**. Each produces a message written at a different time by a different author: some helpful, some technically accurate but meaningless to an admin, one that is not a message at all but a serialization artifact, and three that produce no message whatsoever.

There are **three independent systems** producing these messages:

- The **web client** blocks the invite before the dialog opens, using its own copy of the seat math and its own strings. In three of the eleven cases it shows nothing at all and silently opens the change-plan dialog instead.
- The **web client's email-input validator** produces a separate inline message inside the dialog, derived from the same seat math but worded as a batch limit rather than a seat limit.
- The **server** rejects the invite after submission, using a completely separate set of hardcoded English strings.

The systems disagree with each other, and the server's strings can never be translated because they are raw English embedded in C# and sent over the wire as-is.

Server-side details in this spec are described from the API's behavior as observed from the client; the exact C# call sites have not been re-verified against the current server branch.

This spec proposes a single message system covering every failure reason, in every language.

**Section 3 is the review table.** Everything before it is context; everything after it is rationale and open questions.

---

## 2. What an admin sees today

### 2.1 The reseller case (the original ticket)

> **Seat limit has been reached**
> Contact your provider to purchase additional seats.

Shown as a red toast, assembled from two separate strings (`seatLimitReached` as the title, `contactYourProvider` as the body). The invite dialog never opens. The admin is not told what the limit is, so they cannot tell their provider how many seats to buy.

### 2.2 The billing-not-configured case

An organization with no payment method or no active subscription on file gets:

> **An error has occurred.**

That is the entire message. This is the "Errors have been encountered" behavior reported by users.

The cause is mechanical rather than editorial. The server does detect the real problem — it produces `No payment method found.` — but that message is raised inside a rollback handler, wrapped in an `AggregateException`, and the wrapper discards the original text before it reaches the browser. The admin is told nothing, and there is no way for them to discover that the fix is adding a card.

### 2.3 The full inventory

Every message an admin can currently receive, and where it comes from:

- **Reseller org out of seats** — "Seat limit has been reached" / "Contact your provider to purchase additional seats." (client toast, translated)
- **MSP or Business Unit org out of seats** — "Seat limit has been reached. Please contact your provider to add more seats." (server, English only). Note the near-duplicate wording with the reseller case, differing only by "Please" and "add more" vs "purchase additional". The client does not block these organizations at all: its pre-dialog check covers resellers only, so MSP and Business Unit orgs reach the server before anything stops them.
- **Free, Families, or Teams Starter org out of seats, admin can manage billing** — **no message at all.** The client replaces the invite dialog with the change-plan dialog and says nothing about why. If the admin upgrades, the invite flow resumes; if they cancel, they are returned to the members list with no explanation of what just happened.
- **Free org out of seats, admin cannot manage billing** — "Free organizations may have up to 2 members. Contact your organization owner to upgrade." (client, translated)
- **Families org out of seats, admin cannot manage billing** — "Families organizations may have up to 6 members. Contact your organization owner to upgrade." (client, translated)
- **Teams Starter org out of seats, admin cannot manage billing** — "Teams Starter plans may have up to 10 members. Contact your organization owner to upgrade your plan and invite more members." (client, translated)
- **Fixed-seat org, admin enters more emails than there are seats left** — "You can only submit up to 3 emails at a time", inline beneath the email field (client, translated). This is a seat limit described as a batch limit; the number is the remaining seat count, not a policy about batching. It also reads "up to 1 emails at a time" in the singular case.
- **Teams or Enterprise org at its autoscale cap** — "Seat limit has been reached." (server, English only, no number)
- **No payment method on file** — "An error has occurred." (see 2.2)
- **No subscription on file** — "An error has occurred." (see 2.2)
- **Subscription canceled** — "You do not have an active subscription. Reinstate your subscription to make changes" (server, English only, missing terminal period)
- **Plan has no additional-seat option** — "Plan does not allow additional seats." (server, English only)
- **Self-hosted instance** — "Cannot autoscale on self-hosted instance." (server, English only, exposes internal terminology)

Eleven failure reasons across three systems: six untranslatable server strings, three cases that show nothing at all, and one inline message that describes the wrong concept.

The three "cannot manage billing" messages above appear in a dialog titled **"Upgrade organization"** with a single OK button — not a toast. The title promises an action the reader has no permission to take.

Several of these also vary by whether the admin has permission to manage billing, and section 3 adds the two inline batch-limit states, which is why the review table has twenty-one rows rather than eleven.

### 2.4 Three strings that exist but are never shown

`messages.json` contains three seat-limit strings that no code path can reach:

- `freeOrgInvLimitReachedManageBilling` — "Free organizations may have up to $SEATCOUNT$ members. Upgrade to a paid plan to invite more members."
- `familiesPlanInvLimitReachedManageBilling` — "Families organizations may have up to $SEATCOUNT$ members. Upgrade to a paid plan to invite more members."
- `teamsStarterPlanInvLimitReachedManageBilling` — "Teams Starter plans may have up to $SEATCOUNT$ members. Upgrade to your plan to invite more members."

These are the messages one would expect the "admin can manage billing" cases to show. They are constructed only in the branch that is skipped whenever the admin can manage billing, so they are dead. They have been translated into every language Bitwarden supports and shown to nobody. The "Upgrade to your plan" copy error in the third one has therefore never reached a customer.

This matters for the review below: rows 3, 5, and 7 of the table are **not** a copy change. They are a request to start showing a message where none exists today.

There are also two orphaned provider strings, `seatLimitReachedContactYourProvider` ("Seat limit has been reached. Contact your provider to purchase additional seats.") and `contactYourProviderForAdditionalSeats` ("Contact your provider admin to purchase additional seats."), neither of which is used by the invite flow. The first is almost exactly what this spec proposes for rows 1 and 2.

---

## 3. Review table: current vs proposed

This is the section to mark up. Every row is a real state an admin can reach today. The **Decision** column is empty for reviewers to fill in.

`$SEATCOUNT$` is the organization's effective seat limit. Rows marked (en only) are hardcoded English today and are not translated for any customer. Rows marked **(silent today)** currently show no message at all.

The placeholder is named `$SEATCOUNT$` to match the existing strings. `$COUNT$` is already in use by the inline batch-limit message in section 3.3 and means something different there.

### 3.1 Seat limit reached

| #   | Scenario                                                     | Current message                                                                                                                       | Proposed message                                                                                        | Decision |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Reseller-managed org                                         | Toast: "Seat limit has been reached" / "Contact your provider to purchase additional seats."                                          | Seat limit of $SEATCOUNT$ has been reached. Contact your provider to purchase additional seats.         |          |
| 2   | MSP or Business Unit managed org                             | Seat limit has been reached. Please contact your provider to add more seats. (en only)                                                | Seat limit of $SEATCOUNT$ has been reached. Contact your provider to purchase additional seats.         |          |
| 3   | Free org, admin can manage billing                           | **No message.** Change-plan dialog opens in place of the invite dialog. (silent today)                                                | Seat limit of $SEATCOUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 4   | Free org, admin cannot manage billing                        | Free organizations may have up to $SEATCOUNT$ members. Contact your organization owner to upgrade.                                    | Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 5   | Families org, admin can manage billing                       | **No message.** Change-plan dialog opens in place of the invite dialog. (silent today)                                                | Seat limit of $SEATCOUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 6   | Families org, admin cannot manage billing                    | Families organizations may have up to $SEATCOUNT$ members. Contact your organization owner to upgrade.                                | Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 7   | Teams Starter, admin can manage billing                      | **No message.** Change-plan dialog opens in place of the invite dialog. (silent today)                                                | Seat limit of $SEATCOUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 8   | Teams Starter, admin cannot manage billing                   | Teams Starter plans may have up to $SEATCOUNT$ members. Contact your organization owner to upgrade your plan and invite more members. | Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 9   | Teams or Enterprise at seat cap, admin can manage billing    | Seat limit has been reached. (en only, no number)                                                                                     | Seat limit of $SEATCOUNT$ has been reached. Increase your seat limit to invite more members.            |          |
| 10  | Teams or Enterprise at seat cap, admin cannot manage billing | Seat limit has been reached. (en only, no number)                                                                                     | Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to increase the seat limit. |          |
| 11  | Plan offers no additional seats                              | Plan does not allow additional seats. (en only)                                                                                       | Seat limit of $SEATCOUNT$ has been reached. Contact Customer Support to upgrade your plan.              |          |
| 12  | Self-hosted instance                                         | Cannot autoscale on self-hosted instance. (en only)                                                                                   | Seat limit of $SEATCOUNT$ has been reached. Update your organization license to invite more members.    |          |

**Rows 3, 5, and 7 are a behavior change, not a copy change.** Today the admin who can manage billing is sent straight into the change-plan dialog with no message. Adding a message means either interrupting that shortcut or placing the message somewhere that does not interrupt it. This is the same decision as Open Question 1, and these three rows are the ones it affects most.

Rows 4, 6, and 8 are shown in a dialog titled "Upgrade organization" with a single OK button, even though the reader cannot upgrade. If the proposed messages are adopted, that title needs to change too — it is not covered by the table.

Rows 1 and 2 are close enough to the existing unused string `seatLimitReachedContactYourProvider` that we should reuse or retire it rather than add a fourth provider string.

### 3.2 Billing not configured

Rows 13 through 16 are the "Errors have been encountered" reports. The admin currently receives no usable information in any of these states.

| #   | Scenario                                               | Current message                                                                                                   | Proposed message                                                                                      | Decision |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| 13  | No payment method on file, admin can manage billing    | An error has occurred.                                                                                            | A payment method is required to add seats. Add a payment method to invite more members.               |          |
| 14  | No payment method on file, admin cannot manage billing | An error has occurred.                                                                                            | A payment method is required to add seats. Contact your organization owner to add one.                |          |
| 15  | No subscription on file, admin can manage billing      | An error has occurred.                                                                                            | This organization does not have an active subscription. Start a subscription to invite more members.  |          |
| 16  | No subscription on file, admin cannot manage billing   | An error has occurred.                                                                                            | This organization does not have an active subscription. Contact your organization owner to start one. |          |
| 17  | Subscription canceled, admin can manage billing        | You do not have an active subscription. Reinstate your subscription to make changes (en only, no terminal period) | Your subscription has been canceled. Reinstate your subscription to invite more members.              |          |
| 18  | Subscription canceled, admin cannot manage billing     | You do not have an active subscription. Reinstate your subscription to make changes (en only)                     | Your subscription has been canceled. Contact your organization owner to reinstate it.                 |          |
| 19  | Reason could not be determined                         | An error has occurred.                                                                                            | Members could not be invited. Try again, or contact Customer Support if the problem continues.        |          |

### 3.3 Inline batch limit

These two rows are not failures — the message fires while the admin types, inside the dialog. They are included because this is the one place a seat limit is already communicated inline, which is what the ticket asks for, and because the current wording describes the wrong concept.

On fixed-seat plans the email input's maximum is clamped to the number of seats remaining, so a seat shortage surfaces as a sentence about batching.

| #   | Scenario                                                        | Current message                                    | Proposed message                                                          | Decision |
| --- | --------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| 20  | Fixed-seat org, admin enters more emails than remaining seats   | You can only submit up to $COUNT$ emails at a time | Only $COUNT$ seats remain. Remove an email address, or upgrade your plan. |          |
| 21  | Any plan, admin enters more than 20 emails with seats available | You can only submit up to $COUNT$ emails at a time | Unchanged — this one really is a batch limit.                             |          |

Row 20 also has a singular-form bug: with one seat left it reads "up to 1 emails at a time". Whatever copy is chosen needs singular and plural forms.

Design should note that row 20 and rows 3 through 8 describe the same underlying condition in two different vocabularies — one calls it a seat limit, the other a submission limit — and that both can appear in the same session.

### 3.4 Action buttons

Each button appears only for admins with permission to manage billing. Rows without a button are the "contact your organization owner" variants, where the reader cannot act.

| Applies to rows | Button label        | Destination                    | Decision |
| --------------- | ------------------- | ------------------------------ | -------- |
| 3, 5, 7         | Upgrade             | Existing change-plan dialog    |          |
| 9               | Manage subscription | Organization subscription page |          |
| 13              | Add payment method  | Payment method page            |          |
| 15, 17          | View subscription   | Organization subscription page |          |

For rows 3, 5, and 7 this button replaces something that happens automatically today. The admin currently lands in the change-plan dialog with zero clicks; the proposal costs them one click and gives them an explanation in exchange. That trade is the substance of Open Question 1 and should be decided deliberately rather than inherited from the table.

---

## 4. Design principles for the new messages

**One sentence for the problem, one sentence for the fix.** Every message follows the same two-part shape. The first sentence never changes structure; only the number changes. The second sentence names the specific action and the specific person who can take it.

**Always show the number.** An admin who knows the limit is 50 can act. An admin told only "the limit" has to go find it.

**Name the actor who can actually fix it.** "Contact your provider", "Contact your organization owner", or a direct action button for the admin who has permission. Never leave the reader guessing whose job this is.

**No internal vocabulary.** "Autoscale", "gateway", "subscription object" are our words, not the customer's.

**Never show a bare failure.** If we cannot determine the reason, we say so and point to support, rather than showing "An error has occurred."

---

## 5. Proposed messages in context

Section 3 has the same messages in table form. This section adds the reasoning behind each group, for anyone who wants it before marking up the table.

`$SEATCOUNT$` is the organization's effective seat limit: the autoscale cap when one is set, otherwise the number of purchased seats. This is the number at which invitations actually stop working, which is what the admin needs to know. Note that the client does not have the autoscale cap today — it uses purchased seats — so this choice has an engineering cost. See Open Question 3.

Every message opens with the same clause. This is the standardization: an admin who has seen one of these recognizes all of them, and the only thing they need to read closely is the second sentence.

### 5.1 Provider-managed organizations

**Reseller-managed, out of seats**

> Seat limit of $SEATCOUNT$ has been reached. Contact your provider to purchase additional seats.

**MSP or Business Unit managed, out of seats**

> Seat limit of $SEATCOUNT$ has been reached. Contact your provider to purchase additional seats.

We propose collapsing these two into one message. The distinction between a reseller and a billable provider is invisible to the admin receiving the message, and the action is identical in both cases. See Open Question 2.

### 5.2 Self-serve organizations, admin can manage billing

**Fixed-seat plan (Free, Families, Teams Starter)**

> Seat limit of $SEATCOUNT$ has been reached. Upgrade your plan to invite more members.

Accompanied by an **Upgrade** button that opens the existing change-plan dialog, which on success returns the admin straight to the invite flow rather than making them start over.

This is the one group where the proposal is strictly _more_ friction than today. Currently the change-plan dialog opens by itself, with no message and no click. The argument for adding the message is that the current shortcut is disorienting — the admin asked to invite someone and got a pricing dialog, with nothing connecting the two — and that an admin who does not want to upgrade right now is left with no record of why they cannot invite. The argument against is that we are inserting a click into the one path that already resolves itself. Open Question 1 decides this.

**Metered plan at its seat cap (Teams, Enterprise)**

> Seat limit of $SEATCOUNT$ has been reached. Increase your seat limit to invite more members.

Accompanied by a **Manage subscription** button.

**Plan does not offer additional seats**

> Seat limit of $SEATCOUNT$ has been reached. Contact Customer Support to upgrade your plan.

### 5.3 Self-serve organizations, admin cannot manage billing

Same first sentence in each case, redirected to the person who can act:

> Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to upgrade the plan.

> Seat limit of $SEATCOUNT$ has been reached. Contact your organization owner to increase the seat limit.

No action button, since the reader has no permission to act.

### 5.4 Billing not configured

These replace "An error has occurred." They are the highest-value part of this change, because today the admin receives no information whatsoever.

**No payment method on file, admin can manage billing**

> A payment method is required to add seats. Add a payment method to invite more members.

Accompanied by an **Add payment method** button.

**No payment method on file, admin cannot manage billing**

> A payment method is required to add seats. Contact your organization owner to add one.

**No subscription on file, admin can manage billing**

> This organization does not have an active subscription. Start a subscription to invite more members.

Accompanied by a **View subscription** button.

**Subscription canceled, admin can manage billing**

> Your subscription has been canceled. Reinstate your subscription to invite more members.

Accompanied by a **View subscription** button.

The two "cannot manage billing" variants for subscription state redirect to the organization owner in the same pattern as 5.3.

### 5.5 Self-hosted

> Seat limit of $SEATCOUNT$ has been reached. Update your organization license to invite more members.

Replaces "Cannot autoscale on self-hosted instance.", which described our implementation rather than the customer's situation.

### 5.6 Unknown failure

> Members could not be invited. Try again, or contact Customer Support if the problem continues.

A deliberate, written fallback rather than the generic platform error.

---

## 6. Where the message appears

There are three placements today, not one:

- **Before the dialog opens** (rows 1–8). The admin clicks "Invite member" and gets a toast, a dialog titled "Upgrade organization", or — for rows 3, 5, and 7 — the change-plan dialog with no explanation.
- **Inline in the dialog, while typing** (rows 20–21). The only existing inline seat message, worded as a batch limit.
- **After submission** (rows 9–19). The invite is sent, the server rejects it, and a toast reports the result.

The ticket asks for "inline error text within the Invite Member dialog", which implies a change of placement, not just a change of words. We recommend the following, but this is the main thing we need design to rule on (see Open Question 1).

**Recommended:** the dialog always opens. Blocking conditions render as a persistent callout at the top of the dialog body, above the email field, with the action button inline in the callout. The email field and Save button are disabled while the callout is present.

The rationale is that the current behavior gives the admin nowhere to stand. A toast disappears, cannot be re-read, and does not sit next to the thing it is describing. Opening the dialog also lets the admin see the seat context they already have — the "N seats remaining" hint is right there — which makes the number in the message meaningful rather than abstract.

Two constraints on that recommendation:

**The callout has two entry moments.** Rows 1–8 are known before the dialog opens, so the callout can be present on open with Save disabled. Rows 9–19 are only known after the server responds, so for those the callout has to appear _after_ a submission attempt, with the entered emails preserved. Design should specify both states; they will look the same but arrive differently, and the second one replaces a toast the admin has already started reading.

**Rows 3, 5, and 7 lose a shortcut.** Those admins currently reach the change-plan dialog in zero clicks. Under the recommendation they see a callout and click Upgrade. If design wants to preserve the shortcut for these rows specifically, the callout would apply to rows 1, 2, 4, 6, 8 and 9–19 only, and rows 3/5/7 keep today's behavior — which is defensible but reintroduces exactly the inconsistency this spec is trying to remove.

The broader trade-off is that we would be opening a dialog the admin cannot complete. An alternative is to keep the pre-dialog block and simply improve the toast copy, which is a smaller change.

---

## 7. Translation

Six of the eleven current messages are hardcoded English on the server and reach the browser untranslated. A German-speaking admin whose organization has no payment method sees an English string today, and would continue to.

The fix is for the server to stop sending prose. Instead it sends a short stable identifier — for example `payment_method_required` — and the client picks the localized sentence. We believe this mirrors a pattern already used elsewhere in the members flow; engineering should confirm the precedent before the spec cites it as one.

The practical consequence for this spec: **every proposed message in section 3 is authored once, in English, in the client's message file, and Crowdin translates all of them.** No message in this spec will ship as untranslated English.

---

## 8. Open questions for design and product

**1. Should the dialog open when the invite is blocked?** Section 6 recommends yes, with an inline callout. The alternative is to keep blocking before the dialog and improve only the toast copy. This is the largest UX decision in the spec and it changes the engineering scope. It also decides rows 3, 5, and 7, where the admin currently reaches the change-plan dialog with no message and no click — adding a message there is a deliberate step backwards in speed in exchange for an explanation, and product should confirm they want that trade.

**2. Should reseller and MSP/Business Unit share one message?** We propose one shared message, since the admin's action is identical. Keeping them separate means maintaining two nearly identical strings and matching them to a distinction the reader cannot perceive. Billing may have a commercial reason to keep the wording distinct.

**3. Should `$SEATCOUNT$` be the autoscale cap or the purchased seat count?** This spec assumes the autoscale cap when set, since that is the number at which invites actually stop. For an organization with 50 purchased seats and a cap of 75, the message would read "Seat limit of 75". Confirm this matches how Billing talks to customers about limits. Note this is not a free choice: the client only has the purchased seat count today, so choosing the cap means the server has to supply it alongside the failure reason.

**4. Do the plan names still need to appear?** Today's Free and Families messages name the plan ("Free organizations may have up to 2 members"). The proposal drops the plan name for consistency across all eleven cases. If product considers the plan name important context, we can add it back as a second clause, at the cost of the uniform opening sentence.

**5. Are the action button labels right?** "Upgrade", "Manage subscription", "Add payment method", "View subscription" — these should match whatever the Billing surfaces call themselves so the admin recognizes where they are going.

**6. Should the inline batch-limit message be rewritten as a seat message?** Section 3.3, rows 20 and 21. Today a fixed-seat org that is nearly full tells the admin they can "only submit up to 2 emails at a time", which sounds like a rate limit and is actually a seat count. Rewriting it makes the dialog internally consistent; leaving it means the same shortage is described two ways on the same screen.

**7. Does the "Upgrade organization" dialog title change too?** Rows 4, 6, and 8 currently appear under that title with a single OK button, shown to admins who cannot upgrade. The table only covers the body copy.

---

## 9. Summary of what changes

- Twenty-one inconsistent states collapse into one message family sharing a single opening sentence.
- Every seat-limit message includes the limit as a number.
- Three states that are silent today gain a message for the first time (rows 3, 5, 7).
- The billing-configuration failures gain real messages, replacing "An error has occurred."
- Six messages that are English-only today become translatable.
- Two near-duplicate provider messages collapse into one, and five unused strings are retired.
- A seat shortage stops being described as a batch limit.
- Every blocking condition gains an explicit next action, and names who is able to take it.

---

## 10. Notes for engineering

Not review items — findings from scoping that affect estimate and QA.

**Two invite dialogs.** The invite flow forks on the `GenerateInviteLink` feature flag: one path opens the newer `InviteMembersDialogComponent`, the other the legacy member dialog. Any placement change from section 6 lands in both, or ships flag-gated with the two paths behaving differently for the duration.

**Restore shares these strings.** Restoring a revoked member runs the same seat check and the same string family, with `Restore` in place of `Inv` in the key names. Restore is listed as out of scope, but it cannot stay out of scope in practice: changing the invite strings either drags the restore variants along or leaves restore speaking the old vocabulary. Product should decide which, because "out of scope" currently means the second one by default.

**Five strings to retire.** The three unreachable `...InvLimitReachedManageBilling` strings from section 2.4, plus `seatLimitReachedContactYourProvider` and `contactYourProviderForAdditionalSeats` if rows 1 and 2 do not adopt them. All five are carrying translation cost for nothing.

**Stale seat math after an in-flow upgrade.** When an admin upgrades from inside the invite flow, the invite dialog opens using the organization and billing metadata captured _before_ the upgrade. For a full Free org this computes zero remaining seats, and the email field appears to reject every address with "You can only submit up to 0 emails at a time" immediately after a successful purchase. This looks reachable from the code path; QA should confirm before it is treated as a known bug, and it should be fixed regardless of which direction this spec goes.

**Null seat counts.** The pre-dialog check guards against a missing occupied-seat count but not a missing `organization.seats`. A null seat count makes the "seats available" comparison false and falls through into the blocking branches. Probably unreachable in production, worth a guard while this code is open.

# Spec: Invite Member seat limit and billing error messaging

**Status:** Draft for design and product review
**Scope:** The Invite Member flow in the web vault (Admin Console > Members > Invite member)
**Out of scope:** Restore member access, confirm member, accepting an invite link, the Subscription page, provider client dialogs, autoscale notification emails

---

## 1. Why this exists

A ticket asked for one string change: add the seat count to the error a reseller-managed organization sees when it runs out of seats.

While scoping it we found the underlying problem is bigger. Inviting a member can fail for **eleven distinct reasons**, and each one produces a message written at a different time by a different author. Some are helpful, some are technically accurate but meaningless to an admin, and one is not a message at all — it is a serialization artifact.

There are also **two independent systems** producing these messages:

- The **web client** blocks the invite before the dialog even opens, using its own copy of the seat math and its own strings.
- The **server** rejects the invite after submission, using a completely separate set of hardcoded English strings.

The two systems disagree with each other, and the server's strings can never be translated because they are raw English embedded in C# and sent over the wire as-is.

This spec proposes a single message system covering every failure reason, in every language.

**Section 3 is the review table.** Everything before it is context; everything after it is rationale and open questions.

---

## 2. What an admin sees today

### 2.1 The reseller case (the original ticket)

> **Seat limit has been reached**
> Contact your provider to purchase additional seats.

Shown as a red toast. The invite dialog never opens. The admin is not told what the limit is, so they cannot tell their provider how many seats to buy.

### 2.2 The billing-not-configured case

An organization with no payment method or no active subscription on file gets:

> **An error has occurred.**

That is the entire message. This is the "Errors have been encountered" behavior reported by users.

The cause is mechanical rather than editorial. The server does detect the real problem — it produces `No payment method found.` — but that message is raised inside a rollback handler, wrapped in an `AggregateException`, and the wrapper discards the original text before it reaches the browser. The admin is told nothing, and there is no way for them to discover that the fix is adding a card.

### 2.3 The full inventory

Every message an admin can currently receive, and where it comes from:

- **Reseller org out of seats** — "Seat limit has been reached" / "Contact your provider to purchase additional seats." (client toast, translated)
- **MSP or Business Unit org out of seats** — "Seat limit has been reached. Please contact your provider to add more seats." (server, English only). Note the near-duplicate wording with the reseller case, differing only by "Please" and "add more" vs "purchase additional".
- **Free org out of seats** — "Free organizations may have up to 2 members. Upgrade to a paid plan to invite more members." (client dialog, translated)
- **Families org out of seats** — "Families organizations may have up to 6 members. Upgrade to a paid plan to invite more members." (client dialog, translated)
- **Teams Starter org out of seats** — "Teams Starter plans may have up to 10 members. Upgrade to your plan to invite more members." (client dialog, translated). "Upgrade to your plan" is a copy error.
- **Teams or Enterprise org at its autoscale cap** — "Seat limit has been reached." (server, English only, no number)
- **No payment method on file** — "An error has occurred." (see 2.2)
- **No subscription on file** — "An error has occurred." (see 2.2)
- **Subscription canceled** — "You do not have an active subscription. Reinstate your subscription to make changes" (server, English only, missing terminal period)
- **Plan has no additional-seat option** — "Plan does not allow additional seats." (server, English only)
- **Self-hosted instance** — "Cannot autoscale on self-hosted instance." (server, English only, exposes internal terminology)

Eleven failure reasons, four different voices, six of them untranslatable.

Several of these also vary by whether the admin has permission to manage billing, which is why the table in section 3 has nineteen rows rather than eleven.

---

## 3. Review table: current vs proposed

This is the section to mark up. Every row is a real state an admin can reach today. The **Decision** column is empty for reviewers to fill in.

`$COUNT$` is the organization's effective seat limit. Rows marked (en only) are hardcoded English today and are not translated for any customer.

### 3.1 Seat limit reached

| #   | Scenario                                                     | Current message                                                                                                                   | Proposed message                                                                                    | Decision |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 1   | Reseller-managed org                                         | Seat limit has been reached. / Contact your provider to purchase additional seats.                                                | Seat limit of $COUNT$ has been reached. Contact your provider to purchase additional seats.         |          |
| 2   | MSP or Business Unit managed org                             | Seat limit has been reached. Please contact your provider to add more seats. (en only)                                            | Seat limit of $COUNT$ has been reached. Contact your provider to purchase additional seats.         |          |
| 3   | Free org, admin can manage billing                           | Free organizations may have up to $COUNT$ members. Upgrade to a paid plan to invite more members.                                 | Seat limit of $COUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 4   | Free org, admin cannot manage billing                        | Free organizations may have up to $COUNT$ members. Contact your organization owner to upgrade.                                    | Seat limit of $COUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 5   | Families org, admin can manage billing                       | Families organizations may have up to $COUNT$ members. Upgrade to a paid plan to invite more members.                             | Seat limit of $COUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 6   | Families org, admin cannot manage billing                    | Families organizations may have up to $COUNT$ members. Contact your organization owner to upgrade.                                | Seat limit of $COUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 7   | Teams Starter, admin can manage billing                      | Teams Starter plans may have up to $COUNT$ members. Upgrade to your plan to invite more members.                                  | Seat limit of $COUNT$ has been reached. Upgrade your plan to invite more members.                   |          |
| 8   | Teams Starter, admin cannot manage billing                   | Teams Starter plans may have up to $COUNT$ members. Contact your organization owner to upgrade your plan and invite more members. | Seat limit of $COUNT$ has been reached. Contact your organization owner to upgrade the plan.        |          |
| 9   | Teams or Enterprise at seat cap, admin can manage billing    | Seat limit has been reached. (en only, no number)                                                                                 | Seat limit of $COUNT$ has been reached. Increase your seat limit to invite more members.            |          |
| 10  | Teams or Enterprise at seat cap, admin cannot manage billing | Seat limit has been reached. (en only, no number)                                                                                 | Seat limit of $COUNT$ has been reached. Contact your organization owner to increase the seat limit. |          |
| 11  | Plan offers no additional seats                              | Plan does not allow additional seats. (en only)                                                                                   | Seat limit of $COUNT$ has been reached. Contact Customer Support to upgrade your plan.              |          |
| 12  | Self-hosted instance                                         | Cannot autoscale on self-hosted instance. (en only)                                                                               | Seat limit of $COUNT$ has been reached. Update your organization license to invite more members.    |          |

Rows 7 and 8 also fix a copy error in the current text: "Upgrade to your plan" should read "Upgrade your plan".

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

### 3.3 Action buttons

Each button appears only for admins with permission to manage billing. Rows without a button are the "contact your organization owner" variants, where the reader cannot act.

| Applies to rows | Button label        | Destination                    | Decision |
| --------------- | ------------------- | ------------------------------ | -------- |
| 3, 5, 7         | Upgrade             | Existing change-plan dialog    |          |
| 9               | Manage subscription | Organization subscription page |          |
| 13              | Add payment method  | Payment method page            |          |
| 15, 17          | View subscription   | Organization subscription page |          |

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

`$COUNT$` is the organization's effective seat limit: the autoscale cap when one is set, otherwise the number of purchased seats. This is the number at which invitations actually stop working, which is what the admin needs to know.

Every message opens with the same clause. This is the standardization: an admin who has seen one of these recognizes all of them, and the only thing they need to read closely is the second sentence.

### 5.1 Provider-managed organizations

**Reseller-managed, out of seats**

> Seat limit of $COUNT$ has been reached. Contact your provider to purchase additional seats.

**MSP or Business Unit managed, out of seats**

> Seat limit of $COUNT$ has been reached. Contact your provider to purchase additional seats.

We propose collapsing these two into one message. The distinction between a reseller and a billable provider is invisible to the admin receiving the message, and the action is identical in both cases. See Open Question 2.

### 5.2 Self-serve organizations, admin can manage billing

**Fixed-seat plan (Free, Families, Teams Starter)**

> Seat limit of $COUNT$ has been reached. Upgrade your plan to invite more members.

Accompanied by an **Upgrade** button that opens the existing change-plan dialog. This preserves today's behavior, where a successful upgrade returns the admin straight to the invite flow rather than making them start over.

**Metered plan at its seat cap (Teams, Enterprise)**

> Seat limit of $COUNT$ has been reached. Increase your seat limit to invite more members.

Accompanied by a **Manage subscription** button.

**Plan does not offer additional seats**

> Seat limit of $COUNT$ has been reached. Contact Customer Support to upgrade your plan.

### 5.3 Self-serve organizations, admin cannot manage billing

Same first sentence in each case, redirected to the person who can act:

> Seat limit of $COUNT$ has been reached. Contact your organization owner to upgrade the plan.

> Seat limit of $COUNT$ has been reached. Contact your organization owner to increase the seat limit.

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

> Seat limit of $COUNT$ has been reached. Update your organization license to invite more members.

Replaces "Cannot autoscale on self-hosted instance.", which described our implementation rather than the customer's situation.

### 5.6 Unknown failure

> Members could not be invited. Try again, or contact Customer Support if the problem continues.

A deliberate, written fallback rather than the generic platform error.

---

## 6. Where the message appears

Today, seat-limit failures are surfaced **before the dialog opens**: the admin clicks "Invite member", nothing appears to happen, and a toast fires in the corner. Billing failures are surfaced **after submission** as a different-looking toast.

The ticket asks for "inline error text within the Invite Member dialog", which implies a change of placement, not just a change of words. We recommend the following, but this is the main thing we need design to rule on (see Open Question 1).

**Recommended:** the dialog always opens. Blocking conditions render as a persistent callout at the top of the dialog body, above the email field, with the action button inline in the callout. The email field and Save button are disabled while the callout is present.

The rationale is that the current behavior gives the admin nowhere to stand. A toast disappears, cannot be re-read, and does not sit next to the thing it is describing. Opening the dialog also lets the admin see the seat context they already have — the "N seats remaining" hint is right there — which makes the number in the message meaningful rather than abstract.

The trade-off is that we would be opening a dialog the admin cannot complete. An alternative is to keep the pre-dialog block and simply improve the toast copy, which is a smaller change.

---

## 7. Translation

Six of the eleven current messages are hardcoded English on the server and reach the browser untranslated. A German-speaking admin whose organization has no payment method sees an English string today, and would continue to.

The fix is for the server to stop sending prose. Instead it sends a short stable identifier — for example `payment_method_required` — and the client picks the localized sentence. This is the same mechanism already used by the Edit Member dialog, so it is an extension of an existing pattern rather than something new.

The practical consequence for this spec: **every proposed message in section 3 is authored once, in English, in the client's message file, and Crowdin translates all of them.** No message in this spec will ship as untranslated English.

---

## 8. Open questions for design and product

**1. Should the dialog open when the invite is blocked?** Section 6 recommends yes, with an inline callout. The alternative is to keep blocking before the dialog and improve only the toast copy. This is the largest UX decision in the spec and it changes the engineering scope.

**2. Should reseller and MSP/Business Unit share one message?** We propose one shared message, since the admin's action is identical. Keeping them separate means maintaining two nearly identical strings and matching them to a distinction the reader cannot perceive. Billing may have a commercial reason to keep the wording distinct.

**3. Should `$COUNT$` be the autoscale cap or the purchased seat count?** This spec assumes the autoscale cap when set, since that is the number at which invites actually stop. For an organization with 50 purchased seats and a cap of 75, the message would read "Seat limit of 75". Confirm this matches how Billing talks to customers about limits.

**4. Do the plan names still need to appear?** Today's Free and Families messages name the plan ("Free organizations may have up to 2 members"). The proposal drops the plan name for consistency across all eleven cases. If product considers the plan name important context, we can add it back as a second clause, at the cost of the uniform opening sentence.

**5. Are the action button labels right?** "Upgrade", "Manage subscription", "Add payment method", "View subscription" — these should match whatever the Billing surfaces call themselves so the admin recognizes where they are going.

---

## 9. Summary of what changes

- Nineteen inconsistent states collapse into one message family sharing a single opening sentence.
- Every seat-limit message includes the limit as a number.
- The billing-configuration failures gain real messages, replacing "An error has occurred."
- Six messages that are English-only today become translatable.
- Two near-duplicate provider messages collapse into one.
- Every blocking condition gains an explicit next action, and names who is able to take it.

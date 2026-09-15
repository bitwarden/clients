# Test payment details

Use these when a flow asks for a card — buying Premium, starting a Families or Enterprise plan, or
activating an organization. On a dev or QA server you can use these credentials:

| Brand      | Number                | CVC          | Expiry          |
| ---------- | --------------------- | ------------ | --------------- |
| Visa       | `4111 1111 1111 1111` | any 3 digits | any future date |
| Mastercard | `5555 5555 5555 4444` | any 3 digits | any future date |

Defaults to use unless a case calls for something else: number `4111111111111111`, CVC `123`,
expiry `12` / a year a few years out.

**Only ever use these on a dev or QA server.** Never enter a card on a production vault host.

## Filling the card fields

Every card form in the web client is the same component,
`app-enter-payment-method`
(`apps/web/src/app/billing/payment/components/enter-payment-method.component.ts`). Both the
organization plan page and the Premium upgrade dialog embed it.

**The card inputs are Stripe Elements iframes, not plain inputs.** The component renders only empty
mount divs and hands their selectors to `StripeService.loadStripe`
(`apps/web/src/app/billing/services/stripe.service.ts`), which calls
`elements.create("cardNumber" | "cardExpiry" | "cardCvc")`:

| Field       | Visible label       | Mount div id                      |
| ----------- | ------------------- | --------------------------------- |
| Card number | Card number         | `stripe-card-number-<instanceId>` |
| Expiration  | Expiration          | `stripe-card-expiry-<instanceId>` |
| CVC         | Security code / CVV | `stripe-card-cvc-<instanceId>`    |

`fill` against those ids will not work — the div is a container, and the real input lives in a
cross-origin iframe. Instead:

1. Take a snapshot. If it exposes the Stripe inputs as textboxes, click and fill them normally.
2. If it does not, click the mount div to focus the iframe's input, then `type_text` the digits.
   Do the three fields in order, clicking each before typing.
3. Screenshot before submitting and confirm the card brand icon and the entered digits are visible.
   A silently empty Stripe field is the most common reason a billing submit fails.

Pick the credit-card payment method first if it is not already selected — the radio ids are
`credit-payment-method`, `bank-account-payment-method`, and `paypal-payment-method`.

## Clearing a paywall mid-run

A paywall is never a reason to report a run blocked. Clear it and continue the flow:

- A personal feature behind Premium (attachments, TOTP, emergency access, file Sends) → buy Premium
  from `#/settings/subscription/premium`.
- An organization feature (collections, org-owned items, policies, SSO) → create an organization on
  an Enterprise plan from `#/create-organization`, then complete checkout.

Pay with the test card above.

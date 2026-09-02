# Create a test user

Register a fresh account on the running web client. Use this when a case needs a clean vault, a
second account, or an account whose plan and state you control.

**Test servers only.** Never register against a production vault host.

## Two-step flow

Registration is split across two routes. The account does not exist until the _second_ step is
submitted.

### Step 1 — `#/signup`

`RegistrationStartComponent`
(`libs/auth/src/angular/registration/registration-start/registration-start.component.ts`).

| Field                                         | Input id                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| Email address                                 | `register-start_form_input_email`                    |
| Name                                          | `register-start_form_input_name`                     |
| Receive updates from Bitwarden in your inbox. | `register-start-form-input-receive-marketing-emails` |

The marketing checkbox renders only when the server is not self-hosted. There is no terms
checkbox — the terms are static text. Submit button: **Continue**.

### The email-verification fork

What happens next is decided by the **server**, not by a client flag:

- **Verification disabled**: `registerSendVerificationEmail` returns a token, and the component
  navigates straight to `/finish-signup` with `token` and `email` query params. Nothing to do —
  carry on to step 2.
- **Verification enabled**: the page switches to a "Check your email" state and stops. Pull the
  link out of the mail catcher — see below.

Take a snapshot after clicking Continue to see which branch you landed on. Do not assume a
self-hosted dev server skips verification; the standard `bitwarden/server` dev stack has it **on**.

### Reading mail from the dev stack (MailCatcher)

The `bitwarden/server` dev stack runs MailCatcher as `bitwardenserver-mail-1`, SMTP on 1025 and a
web UI plus JSON API on **`localhost:1080`**. Confirm it is up before assuming a run is blocked:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep mail
curl -s http://localhost:1080/messages | python3 -c "
import json,sys
for x in json.load(sys.stdin)[-5:]: print(x['id'], x['recipients'], x['subject'])
"
```

Note the endpoint is `/messages`, **not** `/api/v1/messages` — the latter returns a "No Dice" page.

Grab the newest "Verify Your Email" message for your address and pull the link:

```bash
curl -s http://localhost:1080/messages/<id>.plain \
  | grep -oE 'https?://[^ ]*finish-signup[^ "]*' | head -1 \
  | sed 's|/redirect-connector.html#|/#/|'
```

The `sed` matters. The emailed URL is a `redirect-connector.html#finish-signup?...` bounce; rewrite
it to the plain SPA route `#/finish-signup?...` before navigating, or the client will not route.

Mail bodies HTML-escape the query separators. If you copy a link straight out of an HTML part,
replace `&amp;` with `&` before navigating.

### Step 2 — `#/finish-signup`

`RegistrationFinishComponent`. Renders the shared `auth-input-password` form regardless of which
branch got you here.

| Field                                       | Input id                                   |
| ------------------------------------------- | ------------------------------------------ |
| Master password                             | `input-password-form_new-password`         |
| Confirm master password                     | `input-password-form_new-password-confirm` |
| Master password hint                        | `input-password-form_new-password-hint`    |
| Check known data breaches for this password | `input-password-form_check-for-breaches`   |

Submit button: **Create account**. The account is created here.

The client then lands on `#/setup-extension`, not the vault — a "Get the extension" interstitial.
Click **Add it later** to get past it. That can raise a second "Are you sure?" dialog; dismiss it
with **Skip to web app** or `Escape`. Both can linger in the DOM and swallow clicks on the next
page, so clear them before continuing.

An expired verification link redirects to `/signup-link-expired`.

## Record the credentials

Write the email, password, and server into `.debug/credentials.txt` in `KEY=VALUE` form so later
runs and the lock/unlock flows can find them:

```
# Bitwarden web client test account (local dev server @ https://localhost:8080)
# Created <date> — TEST ACCOUNT ONLY
email=...
password=...
name=...
server=...
```

Note the account in the run summary too — a reader cannot tell from a screenshot which account a
run used.

## Related

- [create-organization.md](create-organization.md) — put the account in an organization, and the
  invite → accept → confirm sequence
- [test-payment.md](test-payment.md) — card details for any paid plan
- [lock.md](lock.md) — unlock flows read `.debug/credentials.txt`

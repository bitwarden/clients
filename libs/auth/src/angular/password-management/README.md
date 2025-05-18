# Password Management Flows

The Auth Team manages several components that allow a user to either:

1. Set an initial master password
2. Change an existing master password

This document maps all of our password management flows to the components that handle them.

<br>

**Table of Contents**

> [Set Initial Password Flows](#set-initial-password-flows)
>
> - [Concise Table](#set-initial-password-flows)
> - [Detailed Breakdown](#account-registration)
>
> [Change Password Flows](#change-password-flows)
>
> - [Concise Table](#change-password-flows)
> - [Detailed Breakdown]()

<br>

**Acronyms**

<ul>
  <li>MPE = "master password ecryption"</li>
  <li>TDE = "trusted device encryption"</li>
  <li>JIT Provisioned = "just-in-time provisioned"</li>
</ul>

<br>

# Set Initial Password Flows

<table>
  <thead>
    <tr>
      <th>Flow</th>
      <th>Route</th>
      <th>Component(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <br>
        <strong>Account Registration</strong>
        <br><br>
        <ol>
            <li>Standard Flow</li><br>
            <li>Self Hosted Flow</li><br>
            <li>Email Invite Flows</li><small>( 🌐 web only )</small><br>
            <br>
        </ol>
      </td>
      <td><code>/finish-signup</code></td>
      <td>
        <code>RegistrationFinishComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
    </tr>
    <tr>
      <td>
        <strong>Trial Initiation</strong><br>
        <small>( 🌐 web only )</small>
      </td>
      <td><code>/trial-initiation</code> or<br> <code>/secrets-manager-trial-initiation</code></td>
      <td>
        <code>CompleteTrialInitiationComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <br>
        <strong>Existing Authed User</strong>
        <br><br>
        <ol>
            <li>JIT provisioned MPE org user</li><br>
            <li>JIT provisioned TDE org user w/ starting role</li><br>
            <li>TDE user authenticates after role upgrade</li><br>
            <li>TDE user authenticates after TDE offboarding</li><br>
        </ol>
      </td>
      <td><code>/set-initial-password</code></td>
      <td>
        <code>SetInitialPasswordComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

<br>

### Account Registration

1. **Standard Flow**

   - On `/signup` a user enters their email and clicks "Continue"
   - A verification email gets sent to the user's email inbox
   - User clicks the link in the verification email, which directs them to `/finish-signup` to finish registration by setting a password

2. **Self Hosted Flow**

   - On `/signup` a user enters their email and clicks "Continue"
   - User gets directed immediately to `/finish-signup` to finish registration by setting a password

3. **Email Invite Flows**

   - In these flows, an existing Bitwarden user (**User A**) takes the initiative and invites some person (**Person B**) via email to register a Bitwarden account. There are 4 variations of the email invite flow, each of which sends Person B to one of our `/accept-*` routes:

     - Flow 1 &rsaquo; _Organization Invite_

       - On `/organizations/{orgId}/members`, an org admin (**User A**) invites **Person B** to join the org
       - **Person B** receives an email in their inbox, inviting them to register a Bitwarden account and join the org
       - **Person B** clicks the link in the email, which directs them to `/accept-organization` with query params
       - The `AcceptOrganizationComponent` extracts the query params and directs **Person B** to `/finish-signup` to finish registration by setting a password

     - Flow 2 &rsaquo; _Enterprise Organization Sponsored Family Plan Invite_

       > In this flow, the user actually invites _themself_ to register a Bitwarden account with their personal email address.

       - User (`user@COMPANY.com`) is member of an enterprise org that [sponsors free family plans](https://bitwarden.com/help/families-for-enterprise/) for its employees

         - On `/settings/sponsored-families`, user enters their personal email address (`user@PERSONAL.com`) for which they want to redeem a free Bitwarden Families subscription
         - User receives an email in their personal email inbox (`user@PERSONAL.com`), inviting them to register a Bitwarden account and redeem a free Bitwarden Families subscription
         - User clicks the link in the email, which directs them to `/accept-families-for-enterprise` with query params
         - The `AcceptFamilySponsorshipComponent` extracts the query params and directs the user to `/finish-signup` to finish registration by setting by setting a password

     - Flow 3 &rsaquo; _Emergency Contact Invite_

       - On `/settings/emergency-access`, **User A** invites **Person B** to become an [Emergency Contact](https://bitwarden.com/help/emergency-access/) for **User A**
       - **Person B** receives an email in their inbox, inviting them to register a Bitwarden account and become an Emergency Contact for **User A**
       - **Person B** clicks the link in the email, which directs them to `/accept-emergency` with query params
       - The `AcceptEmergencyComponent` extracts the query params and directs **Person B** to `/finish-signup` to finish registration by setting a password

     - Flow 4 &rsaquo; _Provider or Reseller Provider Invite_

       - Coming soon

<br>

### Trial Initiation

### Existing Authed User

<br><br>

# Change Password Flows

<table>
  <thead>
    <tr>
      <th>Flow</th>
      <th>Route</th>
      <th>Component(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <strong>Account Settings</strong>
        <br><br> User changes master password via account settings <small>( web only ) 🌐</small>
      </td>
      <td>
        <code>/settings/security/password</code>
        <br> defined in <code>security-routing.module.ts</code>
      </td>
      <td>
        <code>PasswordSettingsComponent</code>
        <br><small>- embeds <code>ChangePasswordComponent</code></small>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <strong>On Login</strong>
        <br><br>1. User clicks an org email invite link and logs in with their master password that does not meet the org’s policy requirements <small>( web only ) 🌐</small>
        <br><br>2. User logs in with a master password that does not meet recently updated org policy requirements
        <br><br>3. User logs in after their master password was reset via Account Recovery, and must now change their password
      </td>
      <td><code>/change-password</code></td>
      <td>
        <code>ChangePasswordComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <strong>Emergency Access Takeover</strong>
        <br><br> Emergency access Grantee sets a master password for the Grantor <small>( web only ) 🌐</small>
      </td>
      <td>Grantee opens dialog while on<code>/settings/emergency-access</code></td>
      <td>
        <code>EmergencyAccessTakeoverDialogComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <strong>Account Recovery</strong>
        <br><br> Org admin sets a master password for an org user via Account Recovery <small>( web only ) 🌐</small>
      </td>
      <td><code>COMING SOON</code></td>
      <td>
        <code>ResetPasswordDialogComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

<br />
<br />
<br />
<br />
<br />
<br />

<table>
  <thead>
    <tr>
      <th>Flow</th>
      <th>Route</th>
      <th>Component(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <br>
        <strong>Account Registration</strong>
        <br><br>
        <ol>
            <li>Standard Flow</li><br>
            <li>Self Hosted Flow</li><br>
            <li>Email Invite Flows</li><small>( 🌐 web only )</small><br>
            <br>
        </ol>
      </td>
      <td><code>/finish-signup</code></td>
      <td>
        <code>RegistrationFinishComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
    </tr>
    <tr>
      <td>
        <strong>Trial Initiation</strong><br>
        <small>( 🌐 web only )</small>
      </td>
      <td><code>/trial-initiation</code> or<br> <code>/secrets-manager-trial-initiation</code></td>
      <td>
        <code>CompleteTrialInitiationComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <br>
        <strong>Existing Authed User</strong>
        <br><br>
        <ol>
            <li>User JIT provisions into an MPE org</li><br>
            <li>User JIT provisions into a TDE org &mdash; invited with starting role that requires MP</li><br>
            <li>TDE user authenticates after role upgraded to one that requires MP</li><br>
            <li>User authenticates after TDE offboarding</li><br>
        </ol>
      </td>
      <td><code>/set-initial-password</code></td>
      <td>
        <code>SetInitialPasswordComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

<br />
<br />
<br />
<br />
<br />
<br />

<table>
  <thead>
    <tr>
      <th>Flow</th>
      <th>Route</th>
      <th>Component(s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <strong>Account Registration</strong>
        <ol>
          <li>Standard Flow</li>
          <li>Self Hosted Flow</li>
          <li>Email Invite Flows</li>
        </ol>
      </td>
      <td><code>/finish-signup</code></td>
      <td>
        <code>RegistrationFinishComponent</code>
        <br>- embeds <code>InputPasswordComponent</code></td>
    </tr>
    <tr>
      <td><strong>Trial Initiation</strong></td>
      <td><code>/trial-initiation</code> or<br> <code>/secrets-manager-trial-initiation</code></td>
      <td>
        <code>CompleteTrialInitiationComponent</code>
        <br>- embeds <code>InputPasswordComponent</code>
      </td>
    </tr>
    <tr>
      <td>
        <strong>Existing Authed User</strong>
        <br><br>
        <ol>
            <li>A user being "just-in-time" (JIT) provisioned into a master-password-encryption org</li>
            <li>A user being "just-in-time" (JIT) provisioned into a trusted-device-encryption org with a starting role that requires a master password (admin, owner, etc.)</li>
            <li>A user in a trusted-device-encryption org whose role was upgraded to one that requires a master password (admin, owner, etc.)</li>
            <li>A user in an org that offboarded from trusted device encryption and is now a master-password-encryption org</li>
        </ol>
      </td>
      <td><code>/set-initial-password</code></td>
      <td>
        <code>SetInitialPasswordComponent</code>
        <br>- embeds <code>InputPasswordComponent</code>
      </td>
    </tr>
  </tbody>
</table>

<br>
<br>
<br>
<br>
<br>

- Account Registration
  - Standard Flow
  - Self Hosted Flow
  - Email Invite Flows
- Trial Initiation
- Existing Authed User
  - JIT Provisioned User in MP Org
  - JIT Provisioned User in TDE Org with Starting Role
  - TDE User Upgraded Role
  - TDE Offboarding

<br>
<br>

- Account Settings
- On Login
  - Login with Non-compliant password after Email Accept
  - Login with Non-compliant password
  - Login after Account Recovery
- Emergency Access Takeover
- Account Recovery

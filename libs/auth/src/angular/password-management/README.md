# Master Password Management Flows

The Auth Team manages several components that allow a user to either:

1. Set an initial master password
2. Change an existing master password

This document maps all of our password management flows to the components that handle them.

<br>

**Table of Contents**

> [The Base `InputPasswordComponent`](#the-base-inputpasswordcomponent)
>
> [Set Initial Password Flows](#set-initial-password-flows)
>
> [Change Password Flows](#change-password-flows)

<br>

**Acronyms**

<ul>
  <li>MP = "master password"</li>
  <li>MPE = "master password ecryption"</li>
  <li>TDE = "trusted device encryption"</li>
  <li>JIT Provisioned = "just-in-time provisioned"</li>
</ul>

<br>

## The Base `InputPasswordComponent`

Central to our master password management flows is the base [InputPasswordComponent](https://components.bitwarden.com/?path=/docs/auth-input-password--docs), which is responsible for displaying the appropriate form fields, performing form validation, and generating appropriate cryptographic properties for each flow. This keeps our UI, validation, and key generation consistent across all master password management flows.

<br>

## Set Initial Password Flows

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
            <li>User JIT provisions* into MPE org</li><br>
            <li>User JIT provisions* into TDE org with the "manage account recovery" permission</li><br>
            <li>TDE user authenticates after permissions were upgraded to include "manage account recovery"</li><br>
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

\* A note on JIT provisioned user flows:

- Even though a JIT provisioned user is a brand-new user who was “just” created, we consider them to be an “existing authed user” _from the perspective of the set-password flow_. This is because at the time they set their initial password, their account already exists in the database (before setting their password) and they have already authenticated via SSO.
- The same is not true in the _Account Registration_ flows above—that is, during account registration when a user reaches the `/finish-signup` or `/trial-initiation` page to set their initial password, their account does not yet exist in the database, and will only be created once they set an initial password.

<br>

## Change Password Flows

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
        (<small><a href="https://bitwarden.com/help/master-password/#change-master-password" target="_blank" rel="noopener noreferrer">Docs</a></small>)
        <br><br>User changes MP via account settings <small>( 🌐 web only )</small>
      </td>
      <td>
        <code>/settings/security/password</code>
        <br>(<code>security-routing.module.ts</code>)
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
        <br><br>1. User clicks an org email invite link and logs in with their MP that does not meet the org’s policy requirements <small>( 🌐 web only )</small>
        <br><br>2. User logs in with their MP that does not meet recently updated org policy requirements
        <br><br>3. User logs in after their MP was reset via Account Recovery, and must now change their password
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
        (<small><a href="https://bitwarden.com/help/emergency-access/" target="_blank" rel="noopener noreferrer">Docs</a></small>)
        <br><br>
        <small>Emergency access Grantee changes the MP for the Grantor ( 🌐 web only )</small>
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
        (<small><a href="https://bitwarden.com/help/account-recovery/" target="_blank" rel="noopener noreferrer">Docs</a></small>)
        <br><br>
        <small>Org member with "manage account recovery" permission changes the MP for another org user via Account Recovery ( 🌐 web only )</small>
      </td>
      <td>Org member opens dialog while on <code>/organizations/{org-id}/members</code></td>
      <td>
        <code>ResetPasswordDialogComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

<br>
<br>
<br>
<br>

**Set Initial Password**

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

**Change Password**

- Account Settings
- On Login
  - Login with Non-compliant password after Email Accept
  - Login with Non-compliant password
  - Login after Account Recovery
- Emergency Access Takeover
- Account Recovery

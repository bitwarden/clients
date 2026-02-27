# Master Password Management Flows

The Auth Team manages several components that allow a user to either:

1. Set an initial master password
2. Change an existing master password

This document maps all of our password management flows to the components that handle them.

<br>

**Table of Contents**

> - [The Base `InputPasswordComponent`](#the-base-inputpasswordcomponent)
> - [Set Initial Password Flows](#set-initial-password-flows)
> - [Change Password Flows](#change-password-flows)

<br>

**Acronyms**

<ul>
  <li>MP = "master password"</li>
  <li>MPE = "master password encryption"</li>
  <li>TDE = "trusted device encryption"</li>
  <li>JIT provision = "just-in-time provision"</li>
</ul>

<br>

## The Base `InputPasswordComponent`

Central to our master password management flows is the base [InputPasswordComponent](https://components.bitwarden.com/?path=/docs/auth-input-password--docs), which is responsible for displaying the appropriate form fields in the UI, performing form validation, and generating appropriate cryptographic properties for each flow. This keeps our UI, validation, and key generation consistent across all master password management flows.

<br>

## Set Initial Password Flows

<table>
  <thead>
    <tr>
      <td><strong>Flow</strong></td>
      <td><strong>Route</strong><br><small>(on which user sets MP)</small></td>
      <td><strong>Component(s)</strong></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <br>
        <strong>Account Registration</strong>
        <br><br>
        <ol>
            <li>Standard Flow</li>
            <br>
            <li>Self Hosted Flow</li>
            <br>
            <li>Email Invite Flows <small>(🌐 web only)</small></li>
            <br>
        </ol>
      </td>
      <td><code>/finish-signup</code></td>
      <td>
        <code>RegistrationFinishComponent</code>
        <br>
        <small>- embeds <code>InputPasswordComponent</code></small>
    </tr>
    <tr>
      <td>
        <strong>Trial Initiation</strong> <small>(🌐 web only)</small>
      </td>
      <td><code>/trial-initiation</code> or<br> <code>/secrets-manager-trial-initiation</code></td>
      <td>
        <code>CompleteTrialInitiationComponent</code>
        <br>
        <small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <br>
        <strong>Upon Authentication</strong> (an existing authed user)
        <br><br>
        <ol>
          <li><strong>User JIT provisions<small>*</small> into an MPE org</strong></li>
          <br>
          <li>
            <strong>User JIT provisions<small>*</small> into a TDE org with the "manage account recovery" permission</strong>
            <p>That is, the user was given this permission on invitation or by the time they JIT provision.</p>
          </li>
          <br>
          <li>
            <strong>TDE user permissions upgraded</strong>
            <p>TDE user authenticates after permissions were upgraded to include "manage account recovery".</p>
          </li>
          <br>
          <li>
            <strong>TDE offboarding</strong>
            <p>User authenticates after their org offboarded from TDE and is now a MPE org.</p>
            <p>User must be on a trusted device to set MP, otherwise user must go through Account Recovery.</p>
          </li>
        </ol>
      </td>
      <td><code>/set-initial-password</code></td>
      <td>
        <code>SetInitialPasswordComponent</code>
        <br>
        <small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

\* A note on JIT provisioned user flows:

- Even though a JIT provisioned user is a brand-new user who was “just” created, we consider them to be an “existing authed user” _from the perspective of the set initial password flow_. This is because at the time they set their initial password, their account already exists in the database (before setting their password) and they have already authenticated via SSO.
- The same is not true in the _Account Registration_ flows above—that is, during account registration when a user reaches the `/finish-signup` or `/trial-initiation` page to set their initial password, their account does not yet exist in the database, and will only be created once they set an initial password.

<br>

## Change Password Flows

<table>
  <thead>
    <tr>
      <td><strong>Flow</strong></td>
      <td><strong>Route</strong><br><small>(on which user changes MP)</small></td>
      <td><strong>Component(s)</strong></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <br>
        <strong>Account Settings</strong>
        (<small><a href="https://bitwarden.com/help/master-password/#change-master-password">Docs</a></small>)
        <br>
        <small>(🌐 web only)</small>
        <br><br>
        <p>User changes MP via account settings.</p>
        <br>
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
        <br>
        <strong>Upon Authentication</strong>
        <br><br>
        <ol>
          <li>
            <strong>Login with non-compliant MP after email accept</strong> <small>(🌐 web only)</small>
            <p>User clicks an org email invite link and logs in with their MP that does not meet the org’s policy requirements.</p>
          </li>
          <br>
          <li>
            <strong>Login with non-compliant MP</strong>
            <p>Existing org user logs in with their MP that does not meet updated org policy requirements.</p>
          </li>
          <br>
          <li>
            <strong>Login after Account Recovery</strong>
            <p>User logs in after their MP was reset via Account Recovery.</p>
          </li>
        </ol>
      </td>
      <td><code>/change-password</code></td>
      <td>
        <code>ChangePasswordComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <br>
        <strong>Emergency Access Takeover</strong>
        <small>(<a href="https://bitwarden.com/help/emergency-access/">Docs</a>)</small>
        <br>
        <small>(🌐 web only)</small>
        <br><br>
        <p>Emergency access Grantee changes the MP for the Grantor.</p>
        <br>
      </td>
      <td>Grantee opens dialog while on <code>/settings/emergency-access</code></td>
      <td>
        <code>EmergencyAccessTakeoverDialogComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
    <tr>
      <td>
        <br>
        <strong>Account Recovery</strong>
        <small>(<a href="https://bitwarden.com/help/account-recovery/">Docs</a>)</small>
        <br>
        <small>(🌐 web only)</small>
        <br><br>
        <p>Org member with "manage account recovery" permission changes the MP for another org user via Account Recovery.</p>
        <br>
      </td>
      <td>Org member opens dialog while on <code>/organizations/{org-id}/members</code></td>
      <td>
        <code>AccountRecoveryDialogComponent</code>
        <br><small>- embeds <code>InputPasswordComponent</code></small>
      </td>
    </tr>
  </tbody>
</table>

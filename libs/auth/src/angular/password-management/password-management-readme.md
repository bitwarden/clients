# Set / Change Password Flows

The Auth Team manages several components that allow a user to either:

1. Set an initial master password
2. Change an existing master password

This document maps all of our set/change password flows to the components that handle them.

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
            <li>User JIT provisions into MP org</li><br>
            <li>User JIT provisions into TDE org &mdash; invited with starting role that requires MP</li><br>
            <li>TDE user authenticates after role upgraded to one that requires MP</li><br>
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

<br><br>

# Change Password Flows

- Account Settings
- On Login
  - Login with Non-compliant password after Email Accept
  - Login with Non-compliant password
  - Login after Account Recovery
- Emergency Access Takeover
- Account Recovery

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

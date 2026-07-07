# Automatic User Confirmation

Owned by: admin-console

The automatic user confirmation (auto confirm) feature enables an organization to confirm users to an organization without manual intervention
from any user as long as an administrator's device is unlocked. The feature is enabled via the following:

1. an organization plan feature in the Bitwarden Portal (enabled by an internal team)
2. the automatic user confirmation policy in the Admin Console (enabled by an organization admin)
3. a toggle switch in the extension's admin settings page (enabled on the admin's local device)

Once these three toggles are enabled, auto confirm will be enabled and users will be auto confirmed as long as an admin is logged in. Note that the setting in
the browser extension is not synced across clients, therefore it will not be enabled if the same admin logs into another browser until it is enabled in that
browser. This is an intentional security measure to ensure that the server cannot enable the feature unilaterally.

Once enabled, the AutomaticUserConfirmationService runs in the background on admins' devices and reacts to push notifications from the server containing organization members who need confirmation.

For more information about security goals and the push notification system, see [README in server repo](https://github.com/bitwarden/server/tree/main/src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AutoConfirmUser).

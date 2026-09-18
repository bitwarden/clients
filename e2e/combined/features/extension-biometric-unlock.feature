Feature: Unlocking the extension with desktop biometrics

  The extension has no biometrics of its own. Its biometric unlock asks the
  desktop app over native messaging, the desktop app prompts, and on approval it
  hands the user key back. Both clients therefore have to be logged into the same
  account, and the desktop app has to have biometric unlock enrolled itself.

  The extension side is enabled by one of two settings, depending on the shared
  unlock feature flag, which replaces the per-client biometric setting with one
  unlock state shared with the desktop app. The lock screen is the same either
  way, so both settings are covered against the flag state they belong to.

  Scenario Outline: Unlock the extension through the desktop app, biometric unlock
    Given the shared unlock feature is off in the extension
    And the desktop is unlocked as the "default" account
    And desktop biometric unlock is enabled
    And the extension is unlocked as the "default" account
    When I enable biometric unlock in the extension
    And I lock the extension
    Then the extension lock screen offers biometric unlock
    When I unlock the extension with biometrics, approving on the desktop
    Then the extension vault is shown
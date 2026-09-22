@desktop @browser
Feature: Enrolling biometric unlock

  When a user enables biometric unlock, the client stores an unlock key. The
  locked vault then opens from a biometric prompt, and the master password is
  not necessary. When the user disables the setting, the client drops the key.

  These Rules hold on every client that offers biometric unlock, so each suite
  reads the same scenarios and implements the steps against its own client —
  the desktop settings dialog, or the browser extension's account security
  page.

  The browser extension runs them on macOS only. Safari reaches a bundled
  native component and needs no desktop app, which is what lets these run
  without one. What only the desktop app does is in
  security/biometrics-desktop.feature, and what routing to the desktop app adds
  is in security/biometrics-browser-desktop.feature.

  Background:
    Given I have an unlocked vault as the "default" account
    And biometrics are available

  Scenario: Enable biometric unlock
    Given biometric unlock is disabled
    When I enable biometric unlock
    Then biometric unlock is enabled

  Scenario: Disable biometric unlock
    Given biometric unlock is enabled
    When I disable biometric unlock
    Then biometric unlock is disabled

@desktop @browser
Feature: Biometric unlock

  A locked vault opens when the user approves a biometric prompt. The lock
  screen offers this method only while two conditions are true. The account has
  an unlock key, and biometrics are available.

  These Rules hold on every client that offers biometric unlock, so each suite
  reads the same scenarios and implements the steps against its own client.

  The browser extension runs them on macOS only. Safari reaches a bundled
  native component and needs no desktop app, which is what lets these run
  without one. Every other browser routes biometrics to the desktop app over
  native messaging, and what that adds is in
  unlock/biometrics-browser-desktop.feature. Enrollment is in
  security/biometrics.feature.

  Rule: The lock screen while biometrics are available

    Background:
      Given I have an unlocked vault as the "default" account
      And biometric unlock is enabled
      And biometrics are available
      And the vault is locked

    # The lock screen shows one unlock method at a time, and it swaps between
    # the methods the account has enabled. The biometric button is outside that
    # set, so the lock screen shows the master password and offers biometrics at
    # the same time.
    Scenario: The lock screen offers the master password
      Then the lock screen offers the master password

    Scenario: Unlock with biometrics
      When I unlock with biometrics
      Then the vault is shown

  Rule: The lock screen while biometrics are unavailable

    Background:
      Given I have an unlocked vault as the "default" account
      And biometric unlock is enabled
      And biometrics are unavailable
      And the vault is locked

    Scenario: The biometric unlock button is disabled
      Then the biometric unlock button is disabled

    Scenario: The biometric unlock button does not unlock the vault
      When I click the biometric unlock button
      Then the vault stays locked

  Rule: The lock screen while biometric unlock is not enabled

    Background:
      Given I have an unlocked vault as the "default" account
      And biometric unlock is disabled
      And biometrics are available
      And the vault is locked

    Scenario: The biometric unlock button is not shown
      Then the biometric unlock button is not shown

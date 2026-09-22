@browser-desktop
Feature: Enrolling biometric unlock through the desktop app

  Except in Safari, the browser extension cannot prompt for biometrics. Its
  setting only records that unlock goes through the desktop app over native
  messaging, so the desktop app must have biometric unlock enabled first.

  Safari has a bundled native component, so it needs no desktop app. That is
  the one case enrollment works in the browser on its own, and those scenarios
  are in security/biometrics.feature. Everything below needs both clients
  running at once, which is the only reason this file is separate.

  Scenario: Enrolling needs permission to use native messaging
    Given the browser extension has permission to use native messaging
    And I have an unlocked vault as the "default" account
    And desktop biometric unlock is enabled
    When I enable biometric unlock
    Then biometric unlock is enabled

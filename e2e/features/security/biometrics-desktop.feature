@desktop
Feature: Enrolling biometric unlock in the desktop app

  Enrollment that every client shares is in security/biometrics.feature, which
  this suite also runs. Only the desktop app's own settings are below.

  Background:
    Given I have an unlocked vault as the "default" account
    And biometrics are available
    And biometric unlock is enabled

  # The desktop app hides this checkbox on the other platforms. On Windows it
  # appears only while biometric unlock is enabled and the account has a master
  # password or a PIN.
  @windows
  Scenario: Stop requiring the master password on app restart
    When I stop requiring the master password on app restart
    Then the master password is not required on app restart

  # The desktop app has a macOS-only setting that asks for Touch ID on app
  # start. No scenario covers it.

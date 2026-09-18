Feature: Biometric unlock

  Enrolling biometric unlock stores an unlock key, so a locked vault can be
  reopened by approving a biometric prompt instead of typing the password. The
  lock screen only offers it while the hardware reports itself usable.

  Background:
    Given I have an unlocked vault as the "default" account

  Scenario: Unlock with biometrics
    Given biometric unlock is enabled
    And biometrics are available
    When I lock the vault
    Then the lock screen is shown
    And the lock screen offers the master password
    When I unlock with biometrics
    Then the vault is shown

  Scenario: Biometrics unavailable
    Given biometric unlock is enabled
    And biometrics are unavailable
    When I lock the vault
    Then the biometric unlock button is disabled
    And the vault stays locked

  Scenario: Biometric unlock not enabled
    Given biometric unlock is disabled
    And biometrics are available
    When I lock the vault
    Then the biometric unlock button is not shown

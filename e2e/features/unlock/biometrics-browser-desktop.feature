@browser-desktop
Feature: Unlocking the browser extension through the desktop app

  Except in Safari, the browser extension cannot prompt for biometrics. It
  sends the unlock request to the desktop app over native messaging. The
  desktop app prompts the user. On approval, the desktop app returns the user
  key. Both clients must therefore be logged in to the same account, and the
  desktop app must have biometric unlock enabled.

  Safari has a bundled native component, so it needs no desktop app. That is
  the one case biometric unlock works in the browser on its own, and those
  scenarios are in unlock/biometrics.feature. Everything below needs both
  clients running at once, which is the only reason this file is separate.

  Rule: Either browser setting grants biometric unlock

    # Two settings route browser unlock to the desktop app, and which one the
    # account security page shows depends on the shared unlock feature flag.
    # That flag replaces the per-client biometric setting with one unlock state
    # shared with the desktop app. The lock screen is the same either way, so
    # each setting is covered against the flag state it belongs to.
    #
    # Shared unlock is listed first: it has to grant biometric unlock on its
    # own, which it cannot be shown to do once the deprecated setting has been
    # enabled.
    Scenario Outline: Unlock with <enabled by> enabled
      Given the shared unlock feature is <shared unlock> in the browser
      And I have an unlocked vault as the "default" account
      And desktop biometric unlock is enabled
      And <enabled by> is enabled in the browser
      And the vault is locked
      When I unlock with biometrics
      Then the vault is shown

      Examples:
        | shared unlock | enabled by                      |
        | on            | unlock sharing with the desktop |
        | off           | biometric unlock                |

  Rule: Both clients must be active as the same account

    # The desktop app answers for its own active account, so the two clients
    # have to agree on who that is. The names below are sections of
    # .debug/e2e-credentials.txt, not literal addresses.
    Background:
      Given the following accounts are logged in to both clients:
        | account | browser   |
        | "user1" | active    |
        | "user2" | logged in |
      And desktop biometric unlock is enabled for the "user1" account
      And biometric unlock is enabled in the browser for the "user1" account
      And the vault is locked

    Scenario: The desktop app is active as the same account
      Given the desktop app is active as the "user1" account
      When I unlock with biometrics
      Then the vault is shown as the "user1" account

    Scenario: The desktop app is active as another account
      Given the desktop app is active as the "user2" account
      Then the biometric unlock button is not offered

  # Open question carried over from Biometrics.md. Can the browser extension
  # unlock with biometrics before the desktop app has one unlock behind it? The
  # mocked desktop biometrics service holds its keys in memory, so no key
  # survives a restart, and this scenario cannot be written against it yet.

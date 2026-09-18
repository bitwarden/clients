# Settings

## Enable Biometrics

Given: An unlocked user
AND in settings page
When: Biometrics enabled
Then: The settings is enabled

## Disable Biometrics

Given: An unlocked user
AND in settings page
AND Biometrics is enabled
When: Biometrics disabled
Then: The settings is disabled

## Windows

Background: you are on windows
Given: An unlocked user
AND in settings page
AND Biometrics is enabled
When: Unchecking require MP on app restart
Then: The settings is disabled

# Unlock

## Unlock with biometrics

Given: A locked user Active user and on lock screen and biometrics is active unlock method
When: Clicking biometrics button and confirming biometrics
Then: user becomes unlocked

## Unlock with biometrics non active method

Given: A locked user Active user and on lock screen and master password is active unlock method
When: Clicking biometirc button
Then: user becomes unlocked

## Unlock doesn't work because unavailable

Given: A locked user Active user and on lock screen and biometrics is unavialble
When: Clicking biometirc button
Then: User is on lock screen

## Unlock doesn't work because unavailable

Given: A locked user Active user and on lock screen and biometrics is unavialble
When: You are on locked screen
Then: Biometrics Button is disabled

## Unlock not configured

Given: A locked active user and on locks creen and biometrics is not enabled
When: You are on lock screen
Then: Biometrics Button is not visible

# background

Native messaging permission is granted

# Extension settings

Given: A an unlocked user? and native messaging permission
When: You are in the account security settings
AND: you click enable biometrics
Then: Biometrics checkbox is enabled

# Extension unlock

## Unlock with biometrics

Given the following authenticated accounts exist:
| email | state | active |
| user1@example.com | unlocked | yes |
| user2@example.com | locked | no |
AND active user user1@example.com in extension, and active user is user1@example.com in desktop // Same user? AND biometrics is enabled?
When: Clicking biometrics button and confirming biometrics // AFU/BFU mode? Driver requires at least one unlock currently
Then: user becomes unlocked

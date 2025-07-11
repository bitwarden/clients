# Login via Auth Request Documentation

<br>

**Table of Contents**

> - [Standard Auth Request Flows](#standard-auth-request-flows)
> - [Admin Auth Request Flow](#admin-auth-request-flow)
> - [Summary Table](#summary-table)
> - [State Management](#state-management)

<br>

## Standard Auth Request Flows

### Flow 1: Unauthed user requests approval from device; Approving device has a masterKey in memory

1. Unauthed user clicks "Login with device"
2. Navigates to `/login-with-device` which creates a `StandardAuthRequest`
3. Receives approval from a device with authRequestPublicKey(masterKey)
4. Decrypts masterKey
5. Decrypts userKey
6. Proceeds to vault

### Flow 2: Unauthed user requests approval from device; Approving device does NOT have a masterKey in memory

1. Unauthed user clicks "Login with device"
2. Navigates to `/login-with-device` which creates a `StandardAuthRequest`
3. Receives approval from a device with authRequestPublicKey(userKey)
4. Decrypts userKey
5. Proceeds to vault

**Note:** This flow is an uncommon scenario and relates to TDE off-boarding. The following describes how a user could
get into this flow:

1. An SSO TD user logs into a device via an Admin auth request approval, therefore this device does NOT have a masterKey
   in memory
2. The org admin:
   - Changes the member decryption options from "Trusted devices" to "Master password" AND
   - Turns off the "Require single sign-on authentication" policy
3. On another device, the user clicks "Login with device", which they can do because the org no longer requires SSO
4. The user approves from the device they had previously logged into with SSO TD, which does NOT have a masterKey in
   memory

### Flow 3: Authed SSO TD user requests approval from device; Approving device has a masterKey in memory

1. SSO TD user authenticates via SSO
2. Navigates to `/login-initiated`
3. Clicks "Approve from your other device"
4. Navigates to `/login-with-device` which creates a `StandardAuthRequest`
5. Receives approval from device with authRequestPublicKey(masterKey)
6. Decrypts masterKey
7. Decrypts userKey
8. Establishes trust (if required)
9. Proceeds to vault

### Flow 4: Authed SSO TD user requests approval from device; Approving device does NOT have a masterKey in memory

1. SSO TD user authenticates via SSO
2. Navigates to `/login-initiated`
3. Clicks "Approve from your other device"
4. Navigates to `/login-with-device` which creates a `StandardAuthRequest`
5. Receives approval from device with authRequestPublicKey(userKey)
6. Decrypts userKey
7. Establishes trust (if required)
8. Proceeds to vault

<br>

## Admin Auth Request Flow

### Flow: Authed SSO TD user requests admin approval

1. SSO TD user authenticates via SSO
2. Navigates to `/login-initiated`
3. Clicks "Request admin approval"
4. Navigates to `/admin-approval-requested` which creates an `AdminAuthRequest`
5. Receives approval from device with authRequestPublicKey(userKey)
6. Decrypts userKey
7. Establishes trust (if required)
8. Proceeds to vault

**Note:** TDE users are required to be enrolled in admin account recovery, which gives the admin access to the user's
userKey. This is how admins are able to send over the authRequestPublicKey(userKey) to the user to allow them to unlock.

<br>

## Summary Table

| Flow            | Auth Status | Clicks Button [active route]                          | Navigates to                | Approving device has masterKey in memory\*        |
| --------------- | ----------- | ----------------------------------------------------- | --------------------------- | ------------------------------------------------- |
| Standard Flow 1 | unauthed    | "Login with device" [`/login`]                        | `/login-with-device`        | yes                                               |
| Standard Flow 2 | unauthed    | "Login with device" [`/login`]                        | `/login-with-device`        | no                                                |
| Standard Flow 3 | authed      | "Approve from your other device" [`/login-initiated`] | `/login-with-device`        | yes                                               |
| Standard Flow 4 | authed      | "Approve from your other device" [`/login-initiated`] | `/login-with-device`        | no                                                |
| Admin Flow      | authed      | "Request admin approval"<br>[`/login-initiated`]      | `/admin-approval-requested` | NA - admin requests always send encrypted userKey |

**Note:** The phrase "in memory" here is important. It is possible for a user to have a master password for their
account, but not have a masterKey IN MEMORY for a specific device. For example, if a user registers an account with a
master password, then joins an SSO TD org, then logs in to a device via SSO and admin auth request, they are now logged
into that device but that device does not have masterKey IN MEMORY.

<br>

## State Management

### View Cache

The component uses `LoginViaAuthRequestCacheService` to manage persistent state across extension close and reopen.
This cache stores:

- Auth Request ID
- Private Key
- Access Code

The cache is used to:

1. Preserve authentication state during extension close
2. Allow resumption of pending auth requests
3. Enable processing of approved requests after extension close and reopen.

<br>

### Component State Variables

Key state variables maintained during the authentication process:

#### Authentication Keys

```
private authRequestKeyPair: {
    publicKey: Uint8Array | undefined;
    privateKey: Uint8Array | undefined;
} | undefined
```

- Stores the RSA key pair used for secure communication
- Generated during auth request initialization
- Required for decrypting approved auth responses

#### Access Code

```
private accessCode: string | undefined
```

- 25-character generated password
- Used for retrieving auth responses when user is not authenticated
- Required for standard auth flows

#### Authentication Status

```
private authStatus: AuthenticationStatus | undefined
```

- Tracks whether user is authenticated via SSO
- Determines available flows and API endpoints
- Affects navigation paths (`/login` vs `/login-initiated`)

#### Flow Control

```
protected flow = Flow.StandardAuthRequest
```

- Determines current authentication flow (Standard vs Admin)
- Affects UI rendering and request handling
- Set based on route and authentication state

<br>

### State Flow Examples

#### Standard Auth Request Cache Flow

1. User initiates login with device
2. Component generates auth request and keys
3. Cache service stores:
   ```
   cacheLoginView(
     authRequestResponse.id,
     authRequestKeyPair.privateKey,
     accessCode
   )
   ```
4. On page refresh/revisit:
   - Component retrieves cached view
   - Reestablishes connection using cached credentials
   - Continues monitoring for approval

#### Admin Auth Request State Flow

1. User requests admin approval
2. Component stores admin request in `AuthRequestService`:
   ```
   setAdminAuthRequest(
     new AdminAuthRequestStorable({
       id: authRequestResponse.id,
       privateKey: authRequestKeyPair.privateKey
     }),
     userId
   )
   ```
3. On subsequent visits:
   - Component checks for existing admin requests
   - Either resumes monitoring or starts new request
   - Clears state after successful approval

<br>

### State Cleanup

State cleanup occurs in several scenarios:

- Component destruction (`ngOnDestroy`)
- Successful authentication
- Request denial or timeout
- Manual navigation away

Key cleanup actions:

1. Hub connection termination
2. Cache clearance
3. Admin request state removal
4. Key pair disposal

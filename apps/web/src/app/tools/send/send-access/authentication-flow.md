# Send Authentication Flows

In the below diagrams, activations represent client control flow.

## Public Sends

Anyone can access a public send. The token endpoint automatically issues a token. It never issues a challenge.

```mermaid
sequenceDiagram
    participant Visitor
    participant TryAccess as try-send-access.guard
    participant SendToken as send-token API
    participant ViewContent as view-content.component
    participant SendAccess as send-access API

    Visitor->>TryAccess: Navigate to send URL
    activate TryAccess
    TryAccess->>SendToken: Request anonymous access token
    SendToken-->>TryAccess: OK + Security token
    TryAccess->>ViewContent: Redirect with token
    deactivate TryAccess
    activate ViewContent
    ViewContent->>SendAccess: Request send content (with token and key)
    SendAccess-->>ViewContent: Return send content
    ViewContent->>Visitor: Display send content
    deactivate ViewContent
```

## Password Protected Sends

Password protected sends redirect to a password challenge prompt.

```mermaid
sequenceDiagram
    participant Visitor
    participant TryAccess as try-send-access.guard
    participant PasswordAuth as password-authentication.component
    participant SendToken as send-token API
    participant ViewContent as view-content.component
    participant SendAccess as send-access API

    Visitor->>TryAccess: Navigate to send URL
    activate TryAccess
    TryAccess->>SendToken: Request anonymous access token
    SendToken-->>TryAccess: Unauthorized + Password challenge
    TryAccess->>PasswordAuth: Redirect with send ID and key
    deactivate TryAccess
    activate PasswordAuth
    PasswordAuth->>Visitor: Request password
    Visitor-->>PasswordAuth: Enter password
    PasswordAuth->>SendToken: Request access token (with password)
    SendToken-->>PasswordAuth: OK + Security token
    deactivate PasswordAuth
    activate ViewContent
    PasswordAuth->>ViewContent: Redirect with token and send key
    ViewContent->>SendAccess: Request send content (with token)
    SendAccess-->>ViewContent: Return send content
    ViewContent->>Visitor: Display send content
    deactivate ViewContent
```

## Send Access without token

Visiting the view page without a token redirects to a try-access flow, above.

```mermaid
sequenceDiagram
    participant Visitor
    participant ViewContent as view-content.component
    participant TryAccess as try-send-access.guard

    Visitor->>ViewContent: Navigate to send URL (with id and key)
    ViewContent->>TryAccess: Redirect to try-access (with id and key)
```

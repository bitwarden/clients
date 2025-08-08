# Documentation prompts

The following prompts were used with Claude 4 - Sonnet to write send documentation.

## Authentication Flow Diagrams

Turn a list of steps into a sequence diagram.

```
Create a mermaid sequence diagram for the Bitwarden Send protocol authentication flow. Use these components:

**Components:**
- `try-access.component` - Entry point that attempts to access a send
- `password-authentication.component` - Handles password-based authentication
- `view-content.component` - Displays the send content
- `send-token API` - Server endpoint that issues security tokens

**Flow Steps:**
1. [Visitor navigates to try-access.]
2. [try-access requests anonymous access from the send-token API]
3. [send-token service replies with 200 and a token.]
4. [try-access redirects to view-content with the token.]
5. [view-content requests the send content from the send-access API with the token.]
6. [the send-access API returns the send content]
[ADD MORE STEPS AS NEEDED]

**Requirements:**
- Use clear, descriptive labels for each interaction
- Include HTTP status codes where relevant
- Show conditional logic with alt/opt blocks for decision points
- Use proper mermaid sequence diagram syntax
- Generate ONLY the mermaid code block, no additional explanation
- Follow the exact component names provided above
```

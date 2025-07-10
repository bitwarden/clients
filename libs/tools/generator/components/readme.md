<!-- FIXME: make this one or more storybooks -->

## Using generator components

The components within this module require the following import.

```ts
import { GeneratorModule } from "@bitwarden/generator-components";
```

The credential generator provides access to all generator features.

```html
<!-- Bound to active user -->
<tools-credential-generator />

<!-- Bound to a specific user -->
<tools-credential-generator [user-id]="userId" />

<!-- receive updates when a credential is generated.
     `$event` is a `GeneratedCredential`.
-->
<tools-credential-generator (onGenerated)="eventHandler($event)" />
```

Specialized components are provided for username and password generation. These
components support the same properties as the credential generator.

```html
<tools-password-generator [user-id]="userId" (onGenerated)="eventHandler($event)" />
<tools-username-generator [user-id]="userId" (onGenerated)="eventHandler($event)" />
```

The emission behavior of `onGenerated` varies according to credential type. When
a credential supports immediate execution, the component automatically generates
a value and emits from `onGenerated`. An additional emission occurs each time the
user changes a setting. Users may also request a regeneration.

When a credential does not support immediate execution, then `onGenerated` fires
only when the user clicks the "generate" button.

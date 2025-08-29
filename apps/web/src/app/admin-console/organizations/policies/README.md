# Adding a New Policy in Admin Console

This README explains how to add a new policy type to the Admin Console. Policies are used to control organizational behavior and security settings for their members.

This README does not cover checking the policy status in order to enforce it in the domain code.

## Overview

Each policy consists of three main components:

1. **Policy Type Enum** - Defines the policy type identifier
2. **Policy Definition & Component** - Implements the UI and business logic
3. **Registration** - Registers the policy in the application

## Step 1: Adding the Enum

Add your new policy type to the `PolicyType` enum.

**Important**: You must also add the corresponding PolicyType enum value on the server.

Example:

```typescript
export enum PolicyType {
  // ... existing policies
  YourNewPolicy = 21, // Use the next available number
}
```

## Step 2: Creating the Policy Definition and Component

### Policy Licensing and Location

The location where you create your policy depends on its licensing:

- **Open Source (OSS) Policies**: Create in `apps/web/src/app/admin-console/organizations/policies/policy-edit-definitions/`
- **Bitwarden Licensed Policies**: Create in `bitwarden_license/bit-web/src/app/admin-console/policies/`

Most policies should be OSS licensed unless they specifically relate to premium/enterprise features that are part of Bitwarden's commercial offerings.

Create a new component file in the appropriate `policy-edit-definitions/` folder following the naming pattern `your-policy-name.component.ts`.

**Note:** you may also create the policy files in your own team's code if you prefer to own your own definition. The same licensing considerations apply.

### Basic Structure

```typescript
import { Component } from "@angular/core";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

// Policy Definition Class
export class YourNewPolicy extends BasePolicyEditDefinition {
  name = "yourPolicyNameTitle"; // i18n key for title
  description = "yourPolicyNameDesc"; // i18n key for description
  type = PolicyType.YourNewPolicy; // Reference to enum
  component = YourNewPolicyComponent; // Reference to component
}

// Policy Component Class
@Component({
  templateUrl: "your-policy-name.component.html",
  imports: [SharedModule],
})
export class YourNewPolicyComponent extends BasePolicyEditComponent {
  // Component implementation
}
```

### Common Use Cases

#### Simple Toggle Policy (No Additional Configuration)

For policies that only need an enabled/disabled state:

```typescript
export class SimpleTogglePolicy extends BasePolicyEditDefinition {
  name = "simpleTogglePolicyTitle";
  description = "simpleTogglePolicyDesc";
  type = PolicyType.SimpleToggle;
  component = SimpleTogglePolicyComponent;
}

@Component({
  templateUrl: "simple-toggle.component.html",
  imports: [SharedModule],
})
export class SimpleTogglePolicyComponent extends BasePolicyEditComponent {}
```

Template (`simple-toggle.component.html`):

```html
<bit-form-control>
  <input type="checkbox" bitCheckbox [formControl]="enabled" id="enabled" />
  <bit-label>{{ "turnOn" | i18n }}</bit-label>
</bit-form-control>
```

#### Policy with Configuration Data

For policies requiring additional settings beyond just enabled/disabled, you'll need to define a custom `data` FormGroup to handle the policy's configuration options:

```typescript
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ControlsOf } from "@bitwarden/angular/types/controls-of";

interface YourPolicyOptions {
  minLength: number;
  requireSpecialChar: boolean;
}

@Component({
  templateUrl: "your-policy.component.html",
  imports: [SharedModule],
})
export class YourPolicyComponent extends BasePolicyEditComponent implements OnInit {
  data: FormGroup<ControlsOf<YourPolicyOptions>> = this.formBuilder.group({
    minLength: [8, [Validators.min(1)]],
    requireSpecialChar: [false],
  });

  constructor(private formBuilder: FormBuilder) {
    super();
  }

  async ngOnInit() {
    super.ngOnInit();
    // Additional initialization logic
  }
}
```

Template (`your-policy.component.html`):

```html
<bit-form-control>
  <input type="checkbox" bitCheckbox [formControl]="enabled" id="enabled" />
  <bit-label>{{ "turnOn" | i18n }}</bit-label>
</bit-form-control>

<ng-container [formGroup]="data">
  <bit-form-field>
    <bit-label>{{ "minimumLength" | i18n }}</bit-label>
    <input bitInput type="number" formControlName="minLength" />
  </bit-form-field>

  <bit-form-control>
    <input type="checkbox" bitCheckbox formControlName="requireSpecialChar" />
    <bit-label>{{ "requireSpecialCharacter" | i18n }}</bit-label>
  </bit-form-control>
</ng-container>
```

#### Feature Flagged Policy

To hide a policy behind a feature flag using ConfigService:

```typescript
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export class NewPolicyBeta extends BasePolicyEditDefinition {
  name = "newPolicyTitle";
  description = "newPolicyDesc";
  type = PolicyType.NewPolicy;
  component = NewPolicyComponent;

  // Only show if feature flag is enabled
  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.YourNewPolicyFeature);
  }
}
```

#### Policy related to Organization Features

To show a policy only when the organization has a specific plan feature:

```typescript
import { of } from "rxjs";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export class RequireSsoPolicy extends BasePolicyEditDefinition {
  name = "requireSsoTitle";
  description = "requireSsoDesc";
  type = PolicyType.RequireSso;
  component = RequireSsoPolicyComponent;

  // Only show if organization has SSO enabled
  display$(organization: Organization, configService: ConfigService) {
    return of(organization.useSso);
  }
}
```

## Step 3: Registering the Policy

### Export from Index File

Add your policy to the barrel file in its folder:

```typescript
export { YourNewPolicy } from "./your-policy-name.component";
```

### Register in Policy Register

Add your policy to the appropriate register in `policy-edit-register.ts`:

```typescript
import {
  // ... existing imports
  YourNewPolicy,
} from "./policy-edit-definitions";

export const ossPolicyEditRegister: BasePolicyEditDefinition[] = [
  // ... existing policies
  new YourNewPolicy(),
];
```

**Note**: Use `ossPolicyEditRegister` for open-source policies and `bitPolicyEditRegister` for Bitwarden Licensed policies.

## Testing Your Policy

1. Build and run the application
2. Navigate to Admin Console → Policies
3. Verify your policy appears in the list
4. Test the policy configuration UI
5. Verify policy data saves correctly

# Adding a New Integration Configuration and Template

This guide explains how to add a new integration type (e.g., Datadog, Splunk HEC) to the organization integrations system.

## Step 1: Define the Configuration Class

Create a new configuration class that implements `OrgIntegrationConfiguration`:

```typescript
export class MyServiceConfiguration implements OrgIntegrationConfiguration {
  // Required: Specify which service this configuration is for
  bw_serviceName: OrganizationIntegrationServiceName;

  // Add service-specific properties (e.g., uri, apiKey, token)
  uri: string;
  apiKey: string;

  constructor(uri: string, apiKey: string, bw_serviceName: OrganizationIntegrationServiceName) {
    this.uri = uri;
    this.apiKey = apiKey;
    this.bw_serviceName = bw_serviceName;
  }

  // Required: Serialize configuration to JSON string for API transmission
  // Property names should match PascalCase for backend compatibility
  // Example: "Uri", "ApiKey" - the backend expects PascalCase keys
  toString(): string {
    return JSON.stringify({
      Uri: this.uri,
      ApiKey: this.apiKey,
      bw_serviceName: this.bw_serviceName,
    });
  }
}
```

**Required Interface Properties:**

- `bw_serviceName: OrganizationIntegrationServiceName` - Identifies the external service
- `toString(): string` - Serializes configuration for API storage

## Step 2: Define the Template Class

Create a template class that implements `OrgIntegrationTemplate`:

```typescript
export class MyServiceTemplate implements OrgIntegrationTemplate {
  // Required: Specify which service this template is for
  bw_serviceName: OrganizationIntegrationServiceName;

  // Add template-specific properties with placeholders (e.g., #CipherId#, #UserEmail#)
  // These placeholders will be replaced with actual values at runtime

  constructor(service: OrganizationIntegrationServiceName) {
    this.bw_serviceName = service;
  }

  // Required: Serialize template to JSON string
  // Define the structure of data that will be sent to the external service
  toString(): string {
    return JSON.stringify({
      bw_serviceName: this.bw_serviceName,
      event: {
        type: "#Type#",
        userId: "#UserId#",
        // ... other placeholders
      },
    });
  }
}
```

**Required Interface Properties:**

- `bw_serviceName: OrganizationIntegrationServiceName` - Identifies the external service
- `toString(): string` - Serializes template structure with placeholders

## Step 3: Update OrganizationIntegrationType

Add your new integration type to the enum:

```typescript
export const OrganizationIntegrationType = Object.freeze({
  // ... existing types
  MyService: 7,
} as const);
```

## Step 4: Extend OrgIntegrationBuilder

The `OrgIntegrationBuilder` is the central factory for creating and deserializing integration configurations and templates.
It provides a consistent API for the `OrganizationIntegrationService` to work with different integration types.

Add four methods to `OrgIntegrationBuilder`:

### 4a. Add a static factory method for configuration:

```typescript
static buildMyServiceConfiguration(
    uri: string,
    apiKey: string,
    bw_serviceName: OrganizationIntegrationServiceName
): OrgIntegrationConfiguration {
    return new MyServiceConfiguration(uri, apiKey, bw_serviceName);
}
```

### 4b. Add a static factory method for template:

```typescript
static buildMyServiceTemplate(
    bw_serviceName: OrganizationIntegrationServiceName
): OrgIntegrationTemplate {
    return new MyServiceTemplate(bw_serviceName);
}
```

### 4c. Add a case to `buildConfiguration()` switch statement:

```typescript
case OrganizationIntegrationType.MyService: {
    const config = this.convertToJson<MyServiceConfiguration>(configuration);
    return this.buildMyServiceConfiguration(config.uri, config.apiKey, config.bw_serviceName);
}
```

This allows deserialization of JSON configuration strings from the API into typed objects.

### 4d. Add a case to `buildTemplate()` switch statement:

```typescript
case OrganizationIntegrationType.MyService: {
    const template = this.convertToJson<MyServiceTemplate>(template);
    return this.buildMyServiceTemplate(template.bw_serviceName);
}
```

This allows deserialization of JSON template strings from the API into typed objects.

## How This Facilitates OrganizationIntegrationService

The `OrgIntegrationBuilder` acts as an abstraction layer that enables the `OrganizationIntegrationService` to:

1. **Save/Update Operations**: Accept strongly-typed configuration and template objects, serialize them via `toString()`,
   and send to the API as JSON strings.

2. **Load Operations**: Receive JSON strings from the API, use `buildConfiguration()` and `buildTemplate()` to
   deserialize them into strongly-typed objects through the builder's factory methods.

3. **Type Safety**: Work with typed domain models (`OrgIntegrationConfiguration`, `OrgIntegrationTemplate`) without
   knowing the specific implementation details of each integration type.

4. **Extensibility**: Add new integration types without modifying the service layer logic. The service only needs to
   call the builder's methods, which internally route to the correct implementation based on `OrganizationIntegrationType`.

5. **Property Normalization**: The builder's `normalizePropertyCase()` method handles conversion between PascalCase
   (backend) and camelCase (frontend), ensuring seamless data flow regardless of API naming conventions.

The service uses these capabilities in methods like `save()`, `update()`, and `mapResponsesToOrganizationIntegration()`
to manage the complete lifecycle of integration configurations and templates.

## Step 5: Add Service Name to OrganizationIntegrationServiceName

If you're adding a new external service (not just a new integration type for an existing service),
add it to the `OrganizationIntegrationServiceName` enum in `organization-integration-service-type.ts`:

```typescript
export const OrganizationIntegrationServiceName = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  MyService: "MyService", // Add your new service
} as const);
```

This identifies the external service your integration connects to. The `bw_serviceName` property in your
configuration and template classes should use a value from this enum.

## Step 6: File Organization

Place your new files in the following directories:

- **Configuration classes**: `models/configuration/`
  - Example: `models/configuration/myservice-configuration.ts`
- **Template classes**: `models/integration-configuration-config/configuration-template/`
  - Example: `models/integration-configuration-config/configuration-template/myservice-template.ts`

This organization keeps related files grouped and maintains consistency with existing integrations.

## Important Conventions

### Template Placeholders

Templates support standardized placeholders that are replaced with actual values at runtime.
Use the following format with hashtags:

**Common placeholders**:

- `#EventMessage#` - Full event message
- `#Type#` - Event type
- `#CipherId#` - Cipher/item identifier
- `#CollectionId#` - Collection identifier
- `#GroupId#` - Group identifier
- `#PolicyId#` - Policy identifier
- `#UserId#` - User identifier
- `#ActingUserId#` - User performing the action
- `#UserName#` - User's name
- `#UserEmail#` - User's email
- `#ActingUserName#` - Acting user's name
- `#ActingUserEmail#` - Acting user's email
- `#DateIso8601#` - ISO 8601 formatted date
- `#DeviceType#` - Device type
- `#IpAddress#` - IP address
- `#SecretId#` - Secret identifier
- `#ProjectId#` - Project identifier
- `#ServiceAccountId#` - Service account identifier

These placeholders are processed server-side when events are sent to the external service.
**_Also, these placeholders are determined by the server-side implementation, so ensure your template matches the expected format._**

## Step 7: Add Tests

Add comprehensive tests for your new integration in three test files:

### 7a. Integration Service Tests

Add tests in `organization-integration-service.spec.ts`:

```typescript
describe("MyService integration", () => {
  it("should save a new MyService integration successfully", async () => {
    const config = OrgIntegrationBuilder.buildMyServiceConfiguration(
      "https://test.myservice.com",
      "test-api-key",
      OrganizationIntegrationServiceName.MyService,
    );
    const template = OrgIntegrationBuilder.buildMyServiceTemplate(
      OrganizationIntegrationServiceName.MyService,
    );
    // ... test implementation
  });
});
```

The implementation should cover save, update, delete, and load operations.
This is all that is required to make a new integration type functional within the service.

---

## Understanding the Architecture

**Workflow**:

1. Call `setOrganizationId(orgId)` to load integrations for an organization
2. Subscribe to `integrations$` to receive the loaded integrations
3. Any save/update/delete operations automatically update `integrations$`

The service uses `BehaviorSubject` internally to manage state and emit updates to all subscribers.

### Error Handling Pattern

All modification operations (`save()`, `update()`, `delete()`) return `IntegrationModificationResult`:

```typescript
type IntegrationModificationResult = {
  success: boolean; // Operation succeeded
  mustBeOwner: boolean; // If false, permission denied (404) - user must be organization owner
};
```

This pattern allows the UI to provide specific feedback when users lack necessary permissions.

### Configuration vs Template

Understanding the distinction between these two concepts is crucial:

**Configuration (`OrgIntegrationConfiguration`)**:

- Contains authentication and connection details
- Example: API URLs, tokens, API keys, authentication schemes
- Stored in the `Integration` record
- Usually contains sensitive data
- One per integration

**Template (`OrgIntegrationTemplate`)**:

- Defines the structure and format of event data
- Contains placeholders like `#UserId#`, `#EventMessage#`
- Stored in the `IntegrationConfiguration` record
- No sensitive data
- Specifies how Bitwarden events map to external service format
- One per integration (current implementation)

When an event occurs, the system:

1. Uses the **Configuration** to know where and how to send data
2. Uses the **Template** to format the event data for that specific service

## Example: Complete Integration

Here's a minimal example showing all pieces working together:

```typescript
// 1. Configuration
export class ExampleConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  apiKey: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(uri: string, apiKey: string, bw_serviceName: OrganizationIntegrationServiceName) {
    this.uri = uri;
    this.apiKey = apiKey;
    this.bw_serviceName = bw_serviceName;
  }

  toString(): string {
    return JSON.stringify({
      Uri: this.uri,
      ApiKey: this.apiKey,
      bw_serviceName: this.bw_serviceName,
    });
  }
}

// 2. Template
export class ExampleTemplate implements OrgIntegrationTemplate {
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(bw_serviceName: OrganizationIntegrationServiceName) {
    this.bw_serviceName = bw_serviceName;
  }

  toString(): string {
    return JSON.stringify({
      bw_serviceName: this.bw_serviceName,
      event: {
        type: "#Type#",
        user: "#UserEmail#",
        timestamp: "#DateIso8601#",
      },
    });
  }
}

// 3. Usage in OrganizationIntegrationService
const config = OrgIntegrationBuilder.buildExampleConfiguration(
  "https://api.example.com",
  "secret-key",
  OrganizationIntegrationServiceName.Example,
);

const template = OrgIntegrationBuilder.buildExampleTemplate(
  OrganizationIntegrationServiceName.Example,
);

await service.save(orgId, OrganizationIntegrationType.Example, config, template);
```

This creates a complete integration that can authenticate with the external service and format event data appropriately.

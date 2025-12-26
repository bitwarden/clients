# Auth Components - Multi-Client Component and Service Design Guidelines

This document outlines the architectural patterns and best practices for building components and services in the `@bitwarden/auth` library that work across web, browser extension, and desktop clients.

## Core Principles

### 1. Single Component, Multiple Clients

- Build ONE Angular component for each page that works across all clients (web, extension, desktop)
- Use responsive design (Tailwind breakpoints) to handle different viewport sizes
- Avoid creating separate components per client

### 2. Abstract Client-Specific Logic into Services

- Move ALL client-specific logic out of components and into strongly typed, well-tested services
- Components should be presentational - controlled by services, not `@Input` properties
- Services should be injected via dependency injection with client-specific implementations

### 3. Avoid Direct Client Type Checks

**CODE SMELL - DO NOT DO THIS:**

```typescript
// WRONG - checking clientType in component
if (this.platformUtilsService.getClientType() === ClientType.Extension) {
  // extension-specific behavior
}
```

**CORRECT APPROACH:**

```typescript
// RIGHT - delegate to service
this.componentService.handleClientSpecificBehavior?.();
```

## Service Architecture Hierarchy

### Service Types (in order of preference)

1. **Domain-scoped service** (no client-specific behavior)
   - Used when logic is identical across all clients
   - Example: `DeviceTrustService`, `AuthRequestApiService`
   - Inject the same instance across all clients

2. **Client-specific, domain-scoped service** (reusable across components)
   - Used when client-specific logic can be reused by multiple components
   - Example: `BrowserEnvironmentService`, `PopupViewCacheService`
   - Can have different implementations per client

3. **Client-specific component service** (component-specific)
   - Used ONLY for logic specific to a single component
   - Naming convention: `{Client}{ComponentName}ComponentService`
   - Example: `WebLoginComponentService`, `ExtensionTwoFactorAuthComponentService`
   - Should only be consumed by the component it's designed for

## Naming Conventions

### Component Services

Must use the `ComponentService` suffix for clarity:

- GOOD: `WebLoginComponentService`
- GOOD: `ExtensionTwoFactorAuthComponentService`
- GOOD: `DesktopSetPasswordComponentService`
- BAD: `WebLoginService` (ambiguous - is it domain or component scoped?)

### File Organization

```
libs/auth/src/angular/
  login/
    login.component.ts                           # Shared component
    login-component.service.abstraction.ts       # Service interface
    default-login-component.service.ts           # Default implementation

apps/web/src/auth/
  login/
    web-login-component.service.ts              # Web-specific implementation

apps/browser/src/auth/popup/
  login/
    extension-login-component.service.ts        # Extension-specific implementation
```

## Service Patterns

### Pattern 1: Default Service + Optional Client Overrides

Use when only ONE client needs custom behavior:

```typescript
// Service abstraction with optional methods
export abstract class LoginComponentServiceAbstraction {
  abstract performLogin(): Promise<void>;

  // Optional - only extension implements this
  handlePopupResize?(): void;
}

// Default implementation (in jslib-services.module.ts)
export class DefaultLoginComponentService implements LoginComponentServiceAbstraction {
  async performLogin(): Promise<void> {
    // Default behavior for web and desktop
  }
  // No handlePopupResize - it's optional
}

// Extension-specific implementation (in browser services.module.ts)
export class ExtensionLoginComponentService extends DefaultLoginComponentService {
  handlePopupResize(): void {
    // Extension-only behavior
  }
}

// Component usage
export class LoginComponent {
  constructor(private service: LoginComponentServiceAbstraction) {}

  ngOnInit() {
    // Optional chaining makes it explicit this only runs on some clients
    this.service.handlePopupResize?.();
  }
}
```

### Pattern 2: Base Service + All Clients Override

Use when ALL clients need different implementations:

```typescript
export abstract class LoginComponentServiceAbstraction {
  abstract performLogin(): Promise<void>;
  abstract getRedirectUrl(): string;
}

// Default base with shared logic
export class DefaultLoginComponentService {
  protected sharedHelper(): void {
    // Common logic all clients use
  }
}

// Each client extends and customizes
export class WebLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentServiceAbstraction
{
  async performLogin(): Promise<void> {
    this.sharedHelper();
    // Web-specific behavior
  }

  getRedirectUrl(): string {
    return "/vault";
  }
}

export class ExtensionLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentServiceAbstraction
{
  async performLogin(): Promise<void> {
    this.sharedHelper();
    // Extension-specific behavior
  }

  getRedirectUrl(): string {
    return "popup/vault.html";
  }
}
```

### Pattern 3: Fully Independent Implementations

Use when clients have completely different logic with no shared code:

```typescript
export abstract class LoginComponentServiceAbstraction {
  abstract performLogin(): Promise<void>;
}

// Each client has independent implementation
export class WebLoginComponentService implements LoginComponentServiceAbstraction {
  async performLogin(): Promise<void> {
    // Completely different web logic
  }
}

export class ExtensionLoginComponentService implements LoginComponentServiceAbstraction {
  async performLogin(): Promise<void> {
    // Completely different extension logic
  }
}
```

## Component Best Practices

### Keep Components Presentational

Components should focus on presentation and delegate logic to services:

**BAD - Logic in component:**

```typescript
export class LoginComponent {
  async submit() {
    if (this.clientType === ClientType.Extension) {
      // Check popup size
      // Validate form differently
      // Use different API endpoint
    } else {
      // Different behavior for web/desktop
    }
  }
}
```

**GOOD - Logic in service:**

```typescript
export class LoginComponent {
  constructor(private loginService: LoginComponentServiceAbstraction) {}

  async submit() {
    await this.loginService.performLogin();
  }
}
```

### Use Optional Chaining for Client-Specific Features

```typescript
export class TwoFactorComponent implements OnInit {
  constructor(private service: TwoFactorComponentServiceAbstraction) {}

  ngOnInit() {
    // Explicitly shows this only runs on some clients
    this.service.setupBrowserExtensionAutofill?.();
  }
}
```

### Responsive Design Over Conditionals

**BAD - Structural directives based on client:**

```html
<div *ngIf="isExtension">Extension UI</div>
<div *ngIf="!isExtension">Web/Desktop UI</div>
```

**GOOD - Responsive breakpoints:**

```html
<div class="tw-hidden md:tw-block">Desktop/Web UI</div>
<div class="tw-block md:tw-hidden">Mobile/Extension UI</div>
```

**ACCEPTABLE - When performance matters:**

```html
<!-- Use structural directives + BreakpointObserver when hiding/showing
     large component trees that would impact performance -->
<heavy-component *ngIf="!isSmallViewport"></heavy-component>
```

## Dependency Injection Configuration

### Shared Default Service (jslib-services.module.ts)

```typescript
@NgModule({
  providers: [
    {
      provide: LoginComponentServiceAbstraction,
      useClass: DefaultLoginComponentService,
    },
  ],
})
export class JsLibServicesModule {}
```

### Client-Specific Override (apps/browser/src/services.module.ts)

```typescript
@NgModule({
  providers: [
    {
      provide: LoginComponentServiceAbstraction,
      useClass: ExtensionLoginComponentService, // Overrides default
    },
  ],
})
export class ServicesModule {}
```

## Testing Requirements

### Component Services MUST Be Strongly Unit Tested

Since components delegate to services, services must have comprehensive test coverage:

```typescript
describe("ExtensionLoginComponentService", () => {
  let service: ExtensionLoginComponentService;

  beforeEach(() => {
    // Setup mocks
  });

  it("should handle popup resize correctly", () => {
    service.handlePopupResize();
    // Verify behavior
  });

  it("should redirect to correct URL after login", () => {
    expect(service.getRedirectUrl()).toBe("popup/vault.html");
  });
});
```

## Code Review Checklist

When reviewing auth library code, check for:

- [ ] Is there a single component shared across clients? (not separate components per client)
- [ ] Is client-specific logic abstracted into services?
- [ ] Are there any `clientType` checks in component `.ts` or `.html` files?
- [ ] Do service names follow `ComponentService` suffix convention?
- [ ] Are optional methods used for client-specific features?
- [ ] Is responsive design (Tailwind) used instead of conditional rendering?
- [ ] Are component services strongly unit tested?
- [ ] Is the service registered correctly in dependency injection?
- [ ] Could any component service logic be refactored into a domain-scoped service for reuse?

## Migration Path for Existing Components

When refactoring existing multi-client components:

1. **Identify client-specific logic** - Look for `clientType` checks or conditional behavior
2. **Create service abstraction** - Define interface with optional methods where appropriate
3. **Implement default service** - Extract common logic
4. **Implement client overrides** - Only for clients that need custom behavior
5. **Update component** - Remove client checks, inject service, use optional chaining
6. **Add service tests** - Comprehensive unit tests for each implementation
7. **Register in DI** - Configure default in jslib, overrides in client services modules

## Warning Signs (Code Smells)

- Component checking `clientType` or `platformUtilsService.getClientType()`
- Service name without `ComponentService` suffix when it's component-specific
- Separate component files per client (e.g., `web-login.component.ts`, `extension-login.component.ts`)
- No-op methods in service instead of optional methods
- Component service with untested or poorly tested logic
- Unnecessary default service when only one client needs the feature

## Goals

By following these patterns, we achieve:

- Write functionality once, benefit across all clients
- Maintainable, easy-to-understand components
- Strong separation of concerns (presentation vs. logic)
- Testable service layer with high coverage
- Clear dependency injection patterns
- Responsive design that scales across viewports

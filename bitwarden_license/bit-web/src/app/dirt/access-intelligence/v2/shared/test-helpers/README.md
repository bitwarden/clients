# Access Intelligence V2 - Test Helpers

Shared test fixtures and utilities for Storybook stories and component tests.

## Usage

### In Storybook Stories

```typescript
import {
  createMockCipher,
  createSampleApplications,
  createI18nMockProvider,
  createApplicationHandlers,
} from "./test-helpers";

export default {
  decorators: [
    moduleMetadata({
      providers: [createI18nMockProvider()],
    }),
  ],
};

export const Default: Story = {
  render: () => ({
    props: {
      applications: createSampleApplications(),
      ...createApplicationHandlers(),
    },
  }),
};
```

### In Component Tests

Component tests should use platform-agnostic helpers from:
`@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers`

These story helpers are Angular-specific and should only be used in Storybook stories.

## Available Helpers

- `createMockCipher(name, id?)` - Creates CipherView for icons
- `createSampleApplications(count?)` - Sample app data
- `createSampleMembers(count?)` - Sample member data
- `createMockCiphersWithIcons()` - Ciphers with icon IDs
- `createLargeDataset(count)` - Performance testing data
- `createI18nMockProvider()` - I18n mock provider
- `createSelectionHandlers()` - Selection state management
- `createApplicationHandlers()` - Event callbacks

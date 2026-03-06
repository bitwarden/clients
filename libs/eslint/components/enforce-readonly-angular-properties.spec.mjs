import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { messages } from "./enforce-readonly-angular-properties.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: [__dirname + "/../tsconfig.spec.json"],
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: __dirname + "/..",
    },
  },
});

ruleTester.run("enforce-readonly-angular-properties", rule.default, {
  valid: [
    {
      name: "readonly signal property",
      code: `
        class MyComponent {
          readonly isLoading = signal(false);
        }
      `,
    },
    {
      name: "readonly injected service",
      code: `
        class MyService {
          readonly authService = inject(AuthService);
        }
      `,
    },
    {
      name: "readonly observable stream",
      code: `
        class MyComponent {
          readonly items$ = this.service.items$;
        }
      `,
    },
    {
      name: "readonly constructor parameter property",
      code: `
        class MyService {
          constructor(private readonly authService: AuthService) {}
        }
      `,
    },
    {
      name: "abstract property without readonly",
      code: `
        abstract class BaseComponent {
          abstract title: string;
        }
      `,
    },
    {
      name: "declare ambient property without readonly",
      code: `
        class MyComponent {
          declare title: string;
        }
      `,
    },
    {
      name: "readonly signal input()",
      code: `
        class MyComponent {
          readonly name = input<string>();
        }
      `,
    },
    {
      name: "readonly output()",
      code: `
        class MyComponent {
          readonly clicked = output<void>();
        }
      `,
    },
    {
      name: "readonly viewChild() signal query",
      code: `
        class MyComponent {
          readonly el = viewChild<ElementRef>('ref');
        }
      `,
    },
  ],
  invalid: [
    {
      name: "non-readonly property",
      code: `
        class MyComponent {
          isLoading = false;
        }
      `,
      output: `
        class MyComponent {
          readonly isLoading = false;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "non-readonly injected service",
      code: `
        class MyService {
          authService = inject(AuthService);
        }
      `,
      output: `
        class MyService {
          readonly authService = inject(AuthService);
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "non-readonly constructor parameter property",
      code: `
        class MyService {
          constructor(private authService: AuthService) {}
        }
      `,
      output: `
        class MyService {
          constructor(private readonly authService: AuthService) {}
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @Input() should be migrated to input()",
      code: `
        class MyComponent {
          @Input() title: string;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @Input decorator without call should be migrated to input()",
      code: `
        class MyComponent {
          @Input title: string;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @ViewChild() should be migrated to viewChild()",
      code: `
        class MyComponent {
          @ViewChild('ref') el: ElementRef;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @ViewChildren() should be migrated to viewChildren()",
      code: `
        class MyComponent {
          @ViewChildren('ref') items: QueryList<ElementRef>;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @ContentChild() should be migrated to contentChild()",
      code: `
        class MyComponent {
          @ContentChild('ref') template: TemplateRef<unknown>;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @ContentChildren() should be migrated to contentChildren()",
      code: `
        class MyComponent {
          @ContentChildren('ref') items: QueryList<TemplateRef<unknown>>;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "non-readonly @HostBinding property",
      code: `
        class MyComponent {
          @HostBinding('class.is-open') isOpen = false;
        }
      `,
      output: `
        class MyComponent {
          @HostBinding('class.is-open') readonly isOpen = false;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @Output() should be migrated to output()",
      code: `
        class MyComponent {
          @Output() clicked = new EventEmitter<void>();
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "non-readonly output()",
      code: `
        class MyComponent {
          clicked = output<void>();
        }
      `,
      output: `
        class MyComponent {
          readonly clicked = output<void>();
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "multiple non-readonly properties",
      code: `
        class MyComponent {
          title = 'hello';
          count = 0;
        }
      `,
      output: `
        class MyComponent {
          readonly title = 'hello';
          readonly count = 0;
        }
      `,
      errors: [{ messageId: "nonReadonly" }, { messageId: "nonReadonly" }],
    },
    {
      name: "static non-readonly property",
      code: `
        class MyService {
          static instance = null;
        }
      `,
      output: `
        class MyService {
          static readonly instance = null;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
  ],
});

ruleTester.run("enforce-readonly-angular-properties (onlyOnPush)", rule.default, {
  valid: [
    {
      name: "non-readonly property on default change detection component is ignored",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ changeDetection: ChangeDetectionStrategy.Default })
        class MyComponent {
          isLoading = false;
        }
      `,
    },
    {
      name: "non-readonly property on a class without @Component is ignored",
      options: [{ onlyOnPush: true }],
      code: `
        class MyService {
          isLoading = false;
        }
      `,
    },
    {
      name: "non-readonly property on @Component without changeDetection is ignored",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ template: '' })
        class MyComponent {
          isLoading = false;
        }
      `,
    },
    {
      name: "readonly property on OnPush component is allowed",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          readonly isLoading = signal(false);
        }
      `,
    },
  ],
  invalid: [
    {
      name: "non-readonly property on OnPush component is flagged",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          isLoading = false;
        }
      `,
      output: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          readonly isLoading = false;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
    {
      name: "legacy @Input() on OnPush component is flagged",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          @Input() title: string;
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
  ],
});

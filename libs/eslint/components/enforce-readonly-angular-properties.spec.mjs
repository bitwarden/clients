import { RuleTester } from "@typescript-eslint/rule-tester";

import rule, { messages } from "./enforce-readonly-angular-properties.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
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
    {
      name: "legacy @Input() is not flagged (covered by prefer-signals)",
      code: `
        class MyComponent {
          @Input() title: string;
        }
      `,
    },
    {
      name: "legacy @Input decorator without call is not flagged",
      code: `
        class MyComponent {
          @Input title: string;
        }
      `,
    },
    {
      name: "legacy @Output() is not flagged (covered by prefer-output-emitter-ref)",
      code: `
        class MyComponent {
          @Output() clicked = new EventEmitter<void>();
        }
      `,
    },
    {
      name: "legacy @ViewChild() is not flagged (covered by prefer-signals)",
      code: `
        class MyComponent {
          @ViewChild('ref') el: ElementRef;
        }
      `,
    },
    {
      name: "legacy @ViewChildren() is not flagged (covered by prefer-signals)",
      code: `
        class MyComponent {
          @ViewChildren('ref') items: QueryList<ElementRef>;
        }
      `,
    },
    {
      name: "legacy @ContentChild() is not flagged (covered by prefer-signals)",
      code: `
        class MyComponent {
          @ContentChild('ref') template: TemplateRef<unknown>;
        }
      `,
    },
    {
      name: "legacy @ContentChildren() is not flagged (covered by prefer-signals)",
      code: `
        class MyComponent {
          @ContentChildren('ref') items: QueryList<TemplateRef<unknown>>;
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
      name: "computed property key is flagged but not autofixed",
      code: `
        class MyComponent {
          [Symbol.iterator] = function*() {};
        }
      `,
      output: null,
      errors: [{ messageId: "nonReadonly" }],
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
    {
      name: "non-readonly constructor param on non-OnPush class is ignored",
      options: [{ onlyOnPush: true }],
      code: `
        class MyService {
          constructor(private svc: SomeService) {}
        }
      `,
    },
  ],
  invalid: [
    {
      name: "non-readonly constructor param on OnPush component is flagged",
      options: [{ onlyOnPush: true }],
      code: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          constructor(private svc: SomeService) {}
        }
      `,
      output: `
        @Component({ changeDetection: ChangeDetectionStrategy.OnPush })
        class MyComponent {
          constructor(private readonly svc: SomeService) {}
        }
      `,
      errors: [{ messageId: "nonReadonly" }],
    },
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
  ],
});

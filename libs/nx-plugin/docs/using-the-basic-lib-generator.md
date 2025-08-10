# Using the basic-lib Generator

The `basic-lib` generator creates a new library with Bitwarden's standard configuration and
structure. It sets up all the necessary files, configurations, and hooks with global configuration
files.

## Command Syntax

You can use the basic lib generator by running this command:

```bash
npx nx g @bitwarden/nx-plugin:basic-lib
```

## Available Options

All fields are required, but do not need to be supplied as CLI flags. Generator users will be asked
interactively for each of these if they are not supplied as CLI flags.

| Option          | Description                                     | Required | Default |
| --------------- | ----------------------------------------------- | -------- | ------- |
| `--name`        | The name of the library                         | Yes      | -       |
| `--description` | A brief description of the library              | Yes      | none    |
| `--team`        | The team responsible for the library            | Yes      | none    |
| `--directory`   | The directory where the library will be created | Yes      | "libs"  |

## Step-by-Step Example

Let's create a new utility library called "password-insulter":

1. Open your terminal and navigate to the root of the Bitwarden clients repository
2. Run the generator command:
   ```bash
   nx g @bitwarden/nx-plugin:basic-lib --name=password-insulter --description="Like the password strength meter, but more judgemental" --team=tools
   ```
3. The generator will create the library structure and update necessary configuration files
4. The new library is now ready to use

## What Gets Generated

The generator creates the following:

- **Library Structure**:

  - `libs/password-insulter/`
    - `src/`
      - `index.ts` - Main entry point
    - `README.md` - With the provided description
    - `package.json` - Very minimal
    - `tsconfig.json` - TypeScript configuration
    - `tsconfig.lib.json` - Library-specific TypeScript configuration
    - `tsconfig.spec.json` - Test-specific TypeScript configuration
    - `jest.config.js` - Test configuration
    - `.eslintrc.json` - Linting rules

- **Configuration Updates**:

The generator then updates `tsconfig.base.json` to reference your new library, updates CODEOWNERS to
assign the team to the new folder, and runs `npm i` to link everything up.

## Post-Generation Next Steps

After generating your library:

1. Review the generated README.md and update it with more detailed information if needed
2. Implement your library code in the `src/` directory, using whatever subfolder structure you
   prefer
3. Export public APIs through the `src/index.ts` file
4. Write tests for your library
5. Build your library with `npx nx build password-insulter`
6. Lint your library with `npx nx lint password-insulter`
7. Test your library with `npx nx test password-insulter`

## Troubleshooting Common Issues

### Issue: Generator fails with path errors

**Solution**: Ensure you're running the command from the root of the repository.

### Issue: TypeScript path mapping not working

**Solution**: Run `nx reset` to clear the Nx cache, then try importing from your library again.

## Extending the Generated Code

The generated library provides a basic structure that you can extend:

- Add additional directories for specific features
- Create subdirectories in `src/` for better organization
- Modify the Jest configuration for specialized testing needs

## Designing a Library

There are a few ways you and your team may want to design a library, there are a lot of factors to
take into account like clean organization, ease of onboarding new members, simplicity of moving
ownership to a new team, and optimizing for module size. Below are a few ways you might want to
design a library.

### Option 1: Feature-based libraries

One strategy to employ is a feature-scoped library.

The import for such a library would be `@bitwarden/[feature]`. For example the `global-state`
feature would be imported with `@bitwarden/global-state`.

If the feature has both a UI component and needs to be used in the CLI it would probably result in a
`@bitwarden/[feature]-ui` or `@bitwarden/[feature]-angular` library as well.

> [!NOTE]
> With more things being added to the SDK and the CLI eventually being written directly in Rust there
> will become less and less need to have a package with an Angular dependency and without it.

Pros

- You'll have smaller libraries that have minimal dependencies, making them easier for another team
  to depend on without a circular reference.
- If your team is ever split or a feature you own is moved to another team this can likely be done
  with just an update to the GitHub `CODEOWNERS` file.
- You'll have a clearer dependency graph.
- Your modules will be smaller.

Cons

- YOu have to spend the time to think about and define what a feature is.
- You have to create libraries somewhat often.
- You MAY need "glue" libraries still.
- It is not as clear who owns what feature from looking at library names.

> [!NOTE]
> A "Glue" library is a library that might not exist other than the need for two teams to collaborate
> on a cross cutting feature. The glue library might exist to hold an interface that team B is
> expected to implement but team A will be responsible for consuming. This helps glue 2 features
> together while still allowing for team A to consume other things that exist in team B's library but
> still avoid a circular dependency.

### Option 2: Team-based libraries

Another strategy would be to have a library for the vast majority of your teams code in a single
package.

There are many ways you may choose to design the library, but if it's one library you will need to
be dependent on everything that makes all your features tick.

**If all teams go this route it will be impossible to only have these team libraries**. Why? Because
the team grouping is very likely to result in circular dependencies. For example, if team A depends
on team B's library then team B cannot depend on anything in team A's library. If team B did need
something they would need to request that team A move it "downstream". Team A would need to move
their code and come up with a name for it. If they don't want to also re-export those pieces of code
they will need to update the import for every other place that code of used. You may also have to
deal with the code now being separated from similar code or you may decide to move that code too.

Pros

- You have fewer libraries to maintain.
- All your team’s code is in one place.

Cons

- You'll need to move code ad-hoc more often to make glue libraries, and each time try to think
  about how to design the package abstraction.
- If your team splits you will need to move a lot more code.
- You’ll have larger modules.

### Option 3: Type-based libraries

You can also split libraries based on the primary kind of file that it holds. For example, you could
have a library holding all `type`’s, one for `abstractions`, and on more `services`. Since one
library for all type’s would be mean having a library that has multiple owners it would be highly
discouraged and therefore this would likely be split by team as well, resulting in packages like
`@bitwarden/platform-types`; this library strategy is really a subset of the team-based one.

Pros

- You’ll be less likely to have circular dependencies within your team’s code, since generally Types
  < Abstractions < Services where < means lower level.
- It’s most similar to the organization strategy we’ve had for a while.

Cons

- There is no guarantee that all the types for a given team are lower level than all the types of
  another team that they need to depend on. Circular dependencies can still happen amongst teams.
- It’s also possible for a type to need to depend on an abstraction,
- We are generally discouraging teams from making abstractions unless needed (link).

### Option 4: Feature/type hybrid

Another strategy could be to split libraries by the kind of item in feature-scoped libraries.

Pros

- Lowest chance of circular dependencies showing up later.
- Pretty easy to move ownership.

Cons

- The most libraries to maintain.
- Consumers will likely have to import multiple modules in order to use your feature.

### Platform Recommendation

Given the options available with Nx and the pros and cons of each, Platform is planning on using
[feature-based libraries](#option-1-feature-based-libraries) and we recommend other teams do as
well.

We understand that we might have a domain that is a little easier to split into features, but we
believe that the work is worthwhile for teams to do.

There will be some instances that our libraries may only contain abstractions and very simple types
which would then resemble the type-based approach. We will be forced to do this because we have some
things like storage where it’s only really useful which the implementations made in the individual
apps.

Example Platform feature libraries (all of these would be imported like `@bitwarden/[feature]`:

- `storage-core`
- `user-state`
- `global-state`
- `state` (will have its own code but also a meta package re-exporting `user-state` and
  `global-state`)
- `clipboard`
- `messaging`
- `ipc`
- `config`
- `http`
- `i18n`
- `environments`
- `server-notifications`
- `sync`

Hopefully these will give you some ideas for how to split up your own features.

## Further Learning

For more information about Nx libraries and generators:

- [Nx Library Generation](https://nx.dev/plugin-features/create-libraries)
- [Nx Library Types](https://nx.dev/more-concepts/library-types)
- [Nx Project Configuration](https://nx.dev/reference/project-configuration)

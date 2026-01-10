# @bitwarden/nx-plugin

The `@bitwarden/nx-plugin` library is a custom Nx plugin developed specifically for Bitwarden projects. It
provides generators tailored to Bitwarden's architecture and coding standards.

## Overview

This plugin extends Nx's capabilities with Bitwarden-specific **nx generators** that help maintain
consistency across the codebase.

### What are Nx Generators?

Nx generators are code generation tools that follow templates to create or
modify files in your project. They can:

- Create new files from templates
- Modify existing files
- Update configuration files
- Ensure consistent project structure
- Automate repetitive tasks

If you're familiar with the code generation tools of say, the angular CLI, then you can just think of =nx= generators as that but on a larger scale. Generators can be run using the Nx CLI with the `nx generate` command (or the shorthand `nx g`).

### When to Use Generators

Use generators when:

- Creating new libraries, components, or features that follow a standard pattern
- You want to ensure consistency across similar parts of your application
- You need to automate repetitive setup tasks
- You want to reduce the chance of human error in project setup

## How `@bitwarden/nx-plugin` Fits Into the Project Architecture

`@bitwarden/nx-plugin` is designed to:

1. Enforce Bitwarden's architectural decisions and code organization
2. Streamline the creation of new libraries and components
3. Ensure consistent configuration across the project
4. Automate updates to project metadata and configuration files
5. Reduce the learning curve for new contributors

By using this plugin, we maintain a consistent approach to code organization and structure across
the entire project.

## Installation and Setup

The plugin is included as a development dependency in the project. If you're working with a fresh
clone of the repository, it will be installed when you run:

```bash
npm install
```

No additional setup is required to use the generators provided by the plugin.

## Available Generators

The plugin currently includes the following generators:

- `basic-lib`: Creates a new library with standard configuration and structure. Specific documentation for the `basic-lib` generator can be found [here](./docs/using-the-basic-lib-generator.md)

Additional generators may be added in the future to support other common patterns in the Bitwarden
codebase.

## Creating A Nx Generator

This library is maintained by platform, but anyone from any team can add a
generator if there is any amount of value added. If you need to create a new
generator please do so by running

```bash
npx nx generate @nx/plugin:generator libs/nx-plugin/src/generators/your-generator-name-here}
```

This will create a basic generator structure for you to get started with.

## Further Learning

To learn more about Nx plugins and how they work:

- [Nx Plugin Development](https://nx.dev/extending-nx/creating-nx-plugins)
- [Nx Plugins Overview](https://nx.dev/extending-nx/intro)

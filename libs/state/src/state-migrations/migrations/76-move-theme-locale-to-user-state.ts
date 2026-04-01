import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

const THEME_KEY: KeyDefinitionLike = {
  key: "selection",
  stateDefinition: { name: "theming" },
};

const LOCALE_KEY: KeyDefinitionLike = {
  key: "locale",
  stateDefinition: { name: "translation" },
};

export class MoveThemeLocaleToUserStateMigrator extends Migrator<75, 76> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const theme = await helper.getFromGlobal<string>(THEME_KEY);
    const locale = await helper.getFromGlobal<string>(LOCALE_KEY);

    if (theme == null && locale == null) {
      return;
    }

    const userIds = await helper.getKnownUserIds();

    for (const userId of userIds) {
      if (theme != null) {
        const existing = await helper.getFromUser<string>(userId, THEME_KEY);
        if (existing == null) {
          await helper.setToUser(userId, THEME_KEY, theme);
        }
      }
      if (locale != null) {
        const existing = await helper.getFromUser<string>(userId, LOCALE_KEY);
        if (existing == null) {
          await helper.setToUser(userId, LOCALE_KEY, locale);
        }
      }
    }

    if (theme != null) {
      await helper.removeFromGlobal(THEME_KEY);
    }
    if (locale != null) {
      await helper.removeFromGlobal(LOCALE_KEY);
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const userIds = await helper.getKnownUserIds();

    let theme: string | null = null;
    let locale: string | null = null;

    for (const userId of userIds) {
      const userTheme = await helper.getFromUser<string>(userId, THEME_KEY);
      const userLocale = await helper.getFromUser<string>(userId, LOCALE_KEY);

      if (theme == null && userTheme != null) {
        theme = userTheme;
      }
      if (locale == null && userLocale != null) {
        locale = userLocale;
      }

      await helper.removeFromUser(userId, THEME_KEY);
      await helper.removeFromUser(userId, LOCALE_KEY);
    }

    if (theme != null) {
      await helper.setToGlobal(THEME_KEY, theme);
    }
    if (locale != null) {
      await helper.setToGlobal(LOCALE_KEY, locale);
    }
  }
}

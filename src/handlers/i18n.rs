use crate::{utils::values::enums, BotData};
use strum::IntoEnumIterator;

// Implement internationalization
type Commands = Vec<poise::Command<BotData, crate::handlers::error::BotErr>>;

pub struct I18nHandler;
impl I18nHandler {
    pub fn internationalize_slash(commands: Commands) -> Commands {
        let mut new_commands = vec![];

        for mut command in commands {
            for locale in enums::SupportedLocales::iter() {
                let name_locale_index = format!("command.{}.name", command.name);
                let description_locale_index =
                    format!("command.{}.description", command.name);

                command
                    .name_localizations
                    .insert(locale.to_string(), t!(name_locale_index).into());

                command
                    .description_localizations
                    .insert(locale.to_string(), t!(description_locale_index).into());

                for param in command.parameters.iter_mut() {
                    let param_name_locale_index =
                        format!("command.{}.{}.name", command.name, param.name);
                    let param_description_locale_index =
                        format!("command.{}.{}.description", command.name, param.name);

                    param.name_localizations.insert(
                        locale.to_string(),
                        t!(param_name_locale_index).into(),
                    );
                    param.description_localizations.insert(
                        locale.to_string(),
                        t!(param_description_locale_index)
                            .into(),
                    );
                }
            }

            new_commands.push(command);
        }

        new_commands
    }
}

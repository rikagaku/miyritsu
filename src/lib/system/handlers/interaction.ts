/** @format */

//#region           External Libs
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    DMChannel,
    Events,
    Interaction,
} from "discord.js";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import verify from "@/system/factories/verify.f";
import { client } from "//index";
import { ErrorHandler } from "@/system/handlers/errHandlers";
import { ListenerHandler } from "@/system/handlers/listener";
import { BotErr, ErrorOrigin, ErrorKind } from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
import { types as commandTypes } from "@/system/handlers/command";
export namespace types {
    export interface UtilsFunctions {
        /**
         * Receive the command in client object.
         * @param interaction Interaction object.
         */
        getCommand: (
            interaction: ChatInputCommandInteraction | AutocompleteInteraction
        ) => Promise<Ok<commandTypes.Command>>;
    }
}
//#endregion
//#region           Variables
import messages from "@/external/factories/preseted.f";
//#endregion
//#region           Implementation
/**
 * Interaction Handler
 * @since v0.1.0
 */
export class InteractionHandler {
    //#region           Built-in Utilities
    private static Utils(): FactoryObj<types.UtilsFunctions> {
        const factory: FactoryObj<types.UtilsFunctions> = {
            getCommand: async (interaction) => {
                const command = client.commands.get(interaction.commandName);

                if (!command) {
                    throw new BotErr({
                        message:
                            "No command with the name " +
                            `${interaction.commandName} was found!`,
                        origin: ErrorOrigin.Unknown,
                        kind: ErrorKind.NotFound,
                    });
                }

                return Ok(command);
            },
        };
        return factory;
    }
    //#endregion

    /**
     * Listener of interactions.
     *
     * This will check the type of interaction and
     * execute the respective action.
     * @param interaction Interaction object.
     */
    private static async InteractionListener(
        interaction: Interaction
    ): Promise<Ok<void>> {
        try {
            if (
                interaction instanceof ChatInputCommandInteraction &&
                !(interaction instanceof DMChannel)
            ) {
                if (
                    !(await verify.permissions(interaction)).val &&
                    (interaction.user.id !== interaction.guild?.ownerId ||
                        interaction.commandName !== "config")
                ) {
                    const message = await messages.embed.warn.missingPermission(
                        interaction
                    );

                    await interaction.reply({
                        embeds: [message.val.data],
                    });

                    return Ok.EMPTY;
                }

                const command = await InteractionHandler.Utils().getCommand(
                    interaction
                );

                (await command.val.execute(interaction)).unwrap();
            } else if (interaction.isAutocomplete()) {
                if (!(await verify.permissions(interaction)).val) {
                    await interaction.respond([
                        {
                            name: "Você não tem permissão para usar o comando!",
                            value: "",
                        },
                    ]);

                    return Ok.EMPTY;
                }

                const command = await InteractionHandler.Utils().getCommand(
                    interaction
                );

                if (!command.val.autocomplete)
                    throw {
                        message:
                            "Um comando que tem em seus dados uma entrada " +
                            "'autocomplete' não tem uma função correspondente!",
                        type: "internal",
                    };

                await command.val.autocomplete(interaction);
            }
        } catch (err) {
            // Complete if it's an autocomplete interaction
            if (interaction.isAutocomplete()) return Ok.EMPTY;

            if (err instanceof BotErr && err.val.origin === ErrorOrigin.User) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(err.val.message);
                } else {
                    await interaction.reply(err.val.message);
                }
            } else {
                new ErrorHandler(err).Healer();
            }
        }

        return Ok.EMPTY;
    }
    //#region           Public Methods
    /**
     * Launch the interaction listener to handle the interactions.
     */
    public static LaunchListener(): Ok<void> {
        new ListenerHandler(
            Events.InteractionCreate,
            "interactionHandler"
        ).NewOn(this.InteractionListener);

        return Ok.EMPTY;
    }
}
//#endregion

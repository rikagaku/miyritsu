/** @format */
//#region               External Libs
import { Ok } from "ts-results";
import {
    APIEmbed,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
//#endregion
//#region               Modules
import {
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
import { types as commandTypes } from "@/system/handlers/command";
import { EmbedMessagesHandler } from "//lib/external/handlers/embed";
import { LOCALE, prisma } from "../..";
//#endregion
//#region               Typing
export namespace types {
    export type data = () => Promise<
        Ok<commandTypes.CommandData<SlashCommandSubcommandsOnlyBuilder>>
    >;
    export type subcommands = {
        commandPermissions: (
            interaction: ChatInputCommandInteraction
        ) => Promise<Result<APIEmbed>>;
    };
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Result<void>>;
    export type autocomplete = (
        interaction: AutocompleteInteraction
    ) => Promise<Ok<void>>;
}
//#endregion
//#region           Variables
const commandName = "config";
const commandLabel = "Configurações";
export enum ConfigEntries {
    commandPermissions = "commandPermissions",
}

//#endregion
//#region               Implementation
export const data: types.data = async () => {
    const description = {
        comm: "Altere as configurações de algo!",
        commandAllowedRoles: {
            comm: "Altere as permissões para um comando!",
            command: "Você quer modificar as permissões de qual comando?",
            allowList:
                "Quais roles podem executar esse comando? Você também pode " +
                "especificar 'private' ou 'public'",
        },
        ephemeral: "Deseja que eu esconda essa mensagem?",
    };

    return new Ok({
        properties: {
            guild: false,
        },
        slashData: new SlashCommandBuilder()
            .setName(commandName)
            .setDescription(description.comm)
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addSubcommand((commandAllowedRoles) =>
                commandAllowedRoles
                    .setName("command-permissions")
                    .setDescription(description.commandAllowedRoles.comm)
                    .addStringOption((command) =>
                        command
                            .setName("command")
                            .setDescription(
                                description.commandAllowedRoles.command
                            )
                            .setRequired(true)
                    )
                    .addStringOption((allowList) =>
                        allowList
                            .setName("allow-list")
                            .setDescription(
                                description.commandAllowedRoles.allowList
                            )
                            .setRequired(true)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            ),
    });
};
const subcommands: Factory<types.subcommands> = () => {
    const factory: FactoryObj<types.subcommands> = {
        commandPermissions: async (interaction) => {
            const commandName = interaction.options.getString("command", true);
            const allowList = interaction.options.getString("allow-list", true);

            let allowed = [];

            for (const substring of allowList.split(",")) {
                if (substring === "private" || substring === "public") {
                    allowed = [substring];

                    break;
                } else {
                    const role = await interaction.guild?.roles.fetch(
                        substring
                    );

                    if (role) {
                        allowed.push(role.id);
                    }
                }
            }

            await prisma.commandPermissions.update({
                where: {
                    guildId: interaction.guild?.id,
                    commandName,
                },
                data: {
                    allowed,
                },
            });

            const embed = await new EmbedMessagesHandler(
                "info.simpleResponse"
            ).Mount({
                title: "Permissões de comando",
                description:
                    `As permissões de \`${commandName}\` ` +
                    `foram alteradas para \`${allowList}\` com sucesso!`,
                createdAt: interaction.createdAt.toLocaleString(LOCALE),
                username: interaction.user.username,
            });

            return new Ok(embed.unwrap().data);
        },
    };

    return factory;
};
export const execute: types.execute = async (interaction) => {
    if (interaction.guild === null)
        return new BotErr({
            message:
                "Você está tentando acessar isso de fora de um servidor?" +
                "Essa função não é suportada ainda!",
            kind: ErrorKind.NotFound,
            origin: ErrorOrigin.Unknown,
        });

    const scomms = subcommands();
    const subcommand = interaction.options.getSubcommand(true);

    var response: Result<APIEmbed>;
    const getEphemeral = interaction.options.getBoolean("ephemeral");

    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    switch (subcommand) {
        case "command-permissions":
            response = await scomms.commandPermissions(interaction);
            break;
        default:
            throw new BotErr({
                message: "Nenhum subcomando foi atingido!",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.LogicError,
            });
    }

    await interaction.editReply({ embeds: [response.unwrap()] });

    return Ok.EMPTY;
};
export const autocomplete: types.autocomplete = async (interaction) => {
    const focused = interaction.options.getFocused(true);

    if (focused.name === "config-entry") {
        await interaction.respond(
            Object.values(ConfigEntries).map((value) => ({
                value,
                name: value,
            }))
        );
    }

    return Ok.EMPTY;
};
//#endregion

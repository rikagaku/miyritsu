/** @format */
//#region               External Libs
import { Ok } from "ts-results";
import {
    APIEmbed,
    ChatInputCommandInteraction,
    Guild,
    PermissionFlagsBits,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    User,
} from "discord.js";
//#endregion
//#region               Modules
import { EmbedMessagesHandler } from "@/external/handlers/embed";
import { PunishmentHandler } from "@/system/handlers/punishmentHandler";
import {
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
import { types as commandTypes } from "@/system/handlers/command";
import { LOCALE } from "../..";
import { $Enums } from "@prisma/client";
//#endregion
//#region               Typing
export namespace types {
    export type data = () => Promise<
        Ok<commandTypes.CommandData<SlashCommandSubcommandsOnlyBuilder>>
    >;
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Result<void>>;
    export type SubCommands = {
        /**
         * List all punishments of a user.
         * @param guild The guild of the punishments.
         * @param user The user to get the punishments of.
         * @param pageNumber The page number of the list.
         * @param createdAt The date of the list.
         * @returns A promise that resolves with an APIEmbed if no error occurs, otherwise a BotErr.
         */
        list: (
            guild: Guild,
            user: User,
            pageNumber: number,
            createdAt: Date
        ) => Promise<Result<APIEmbed>>;
        /**
         * Undo a punishment.
         * @param guild The guild where the punishment was given.
         * @param interactionUser The user that is undoing the punishment.
         * @param caseNumber The number of the punishment case.
         * @param reason The reason of the punishment.
         * @param createdAt The date when the punishment was given.
         * @returns A promise that resolves with the embed data of the
         * success message if no error occurs, otherwise a BotErr.
         */
        undo: (
            guild: Guild,
            interactionUser: User,
            caseNumber: number,
            reason: string,
            createdAt: Date
        ) => Promise<Result<APIEmbed>>;
        /**
         * Edit the reason of a punishment.
         * @param guild The guild where the punishment was given.
         * @param interactionUser The user that is editing the punishment.
         * @param caseNumber The number of the punishment case.
         * @param reason The new reason of the punishment.
         * @param createdAt The date when the punishment was given.
         * @returns A promise that resolves with the embed data of the
         * success message if no error occurs, otherwise a BotErr.
         */
        reason: (
            guild: Guild,
            interactionUser: User,
            caseNumber: number,
            reason: string,
            createdAt: Date
        ) => Promise<Result<APIEmbed>>;
    };
}
//#endregion
//#region           Variables
const commandName = "punishment";
//#endregion
//#region               Implementation
export const data: types.data = async () => {
    const description = {
        comm: "Gerencie os casos de um usuário!",
        subCommands: {
            list: {
                comm: "Liste os casos de um usuário!",
                page: "Qual página você deseja ver?",
                user: "Você deseja ver os logs de qual usuário?",
            },
            undo: {
                comm: "Revogue uma punição de um usuário!",
                caseNumber: "Qual é o número do caso?",
                reason: "Qual o motivo da revogação?",
            },
            reason: {
                comm: "Edite o motivo de uma punição!",
                caseNumber: "Qual é o número do caso?",
                reason: "Qual o novo motivo?",
            },
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
            .addSubcommand((list) =>
                list
                    .setName("list")
                    .setDescription(description.subCommands.list.comm)
                    .addUserOption((user) =>
                        user
                            .setName("user")
                            .setDescription(description.subCommands.list.user)
                            .setRequired(true)
                    )
                    .addNumberOption((page) =>
                        page
                            .setName("page-number")
                            .setRequired(false)
                            .setDescription(description.subCommands.list.page)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .addSubcommand((undo) =>
                undo
                    .setName("undo")
                    .setDescription(description.subCommands.undo.comm)
                    .addNumberOption((caseNumber) =>
                        caseNumber
                            .setName("case")
                            .setRequired(true)
                            .setDescription(
                                description.subCommands.undo.caseNumber
                            )
                    )
                    .addStringOption((reason) =>
                        reason
                            .setName("reason")
                            .setDescription(description.subCommands.undo.reason)
                            .setRequired(true)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .addSubcommand((reason) =>
                reason
                    .setName("reason")
                    .setDescription(description.subCommands.reason.comm)
                    .addNumberOption((caseNumber) =>
                        caseNumber
                            .setName("case")
                            .setDescription(
                                description.subCommands.reason.caseNumber
                            )
                            .setRequired(true)
                    )
                    .addStringOption((reason) =>
                        reason
                            .setName("new-reason")
                            .setRequired(false)
                            .setDescription(
                                description.subCommands.reason.reason
                            )
                            .setRequired(true)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .setDMPermission(false),
    });
};

const subCommands: Factory<types.SubCommands> = () => {
    const factory: FactoryObj<types.SubCommands> = {
        list: async (guild, user, pageNumber, createdAt) => {
            const casesPerPage = 5;
            const punishments = (
                await new PunishmentHandler(guild).getUserPunishments(user.id)
            ).unwrap();
            const totalPages = Math.ceil(punishments.length / casesPerPage);

            const embed = (
                await new EmbedMessagesHandler("info.punishmentList").Mount({
                    username: user.username,
                    currentPage: totalPages > 0 ? pageNumber : 0,
                    totalPages,
                    createdAt: createdAt.toISOString(),
                    authorAvatar: user.displayAvatarURL(),
                    totalCases: punishments.length,
                })
            ).unwrap();

            embed.data.description = "";

            if (totalPages === 0) {
                embed.data.description =
                    "**Nenhum caso foi encontrado!** \n\n" +
                    "*Esse usuário só não está mais limpo que meu código... ks*";
            } else {
                for (let i = 0; i <= punishments.length - 1; i++) {
                    const punishment = punishments[i];

                    embed.data.description +=
                        `### Caso ${punishment.case} - ` +
                        `(${punishment.createdAt.toLocaleString(LOCALE)})\n`;
                    embed.data.description += `**Tipo**: \`${punishment.type}\`\n`;
                    embed.data.description +=
                        `**Usuário**: <@${punishment.userId}> ` +
                        `(${punishment.userId})\n`;
                    embed.data.description +=
                        `**Moderador**: <@${punishment.moderatorId}> ` +
                        `(${punishment.moderatorId})\n`;
                    embed.data.description += `**Motivo**: ${punishment.reason}\n`;

                    if (
                        punishment.expiresAt.getTime() !==
                        punishment.createdAt.getTime()
                    ) {
                        embed.data.description +=
                            `**Data Limite**: ` +
                            `${punishment.expiresAt.toLocaleString(LOCALE)}\n`;
                    }
                }
            }

            return Ok(embed.data);
        },
        undo: async (guild, interactionUser, caseNumber, reason, createdAt) => {
            const originalPunishment = (
                await new PunishmentHandler(guild).edit(caseNumber, {
                    undone: true,
                })
            ).unwrap();

            let newType: $Enums.PunishmentType;

            if (
                originalPunishment.type !== "unkick" &&
                originalPunishment.type !== "unwarn" &&
                originalPunishment.type !== "unmute" &&
                originalPunishment.type !== "unban"
            ) {
                newType = `un${originalPunishment.type}`;
            } else {
                return new BotErr({
                    message:
                        "Você está tentando revogar o revogamento " +
                        "de um caso?? Isso soa engraçado...",
                    kind: ErrorKind.InvalidValue,
                    origin: ErrorOrigin.User,
                });
            }

            await new PunishmentHandler(guild).add(
                originalPunishment.userId,
                originalPunishment.moderatorId,
                newType,
                reason,
                createdAt,
                createdAt
            );

            const embed = (
                await new EmbedMessagesHandler("info.simpleResponse").Mount({
                    title: "Revogar punição",
                    description:
                        "Punição revogada com sucesso!\\n" +
                        "**OBS**: *Ela não tem mais peso nas punições do usuário, " +
                        "porém, ainda permanece nos logs.*",
                    createdAt: createdAt.toLocaleString(LOCALE),
                    username: `@${interactionUser.username}`,
                })
            ).unwrap();

            return Ok(embed.data);
        },
        reason: async (
            guild,
            interactionUser,
            caseNumber,
            reason,
            createdAt
        ) => {
            const punishment = (
                await new PunishmentHandler(guild).get(caseNumber)
            ).unwrap();

            if (punishment.undone) {
                return new BotErr({
                    message:
                        "Este caso não pode ter um motivo alterado, ele foi revogado!",
                    kind: ErrorKind.InvalidValue,
                    origin: ErrorOrigin.User,
                });
            } else {
                new PunishmentHandler(guild).edit(caseNumber, {
                    reason,
                });
            }

            const embed = (
                await new EmbedMessagesHandler("info.simpleResponse").Mount({
                    title: "Alteração de motivo",
                    description:
                        "Motivo alterado com sucesso! Tome mais cuidado da próxima vez >:(",
                    createdAt: createdAt.toLocaleString(LOCALE),
                    username: `@${interactionUser.username}`,
                })
            ).unwrap();

            return Ok(embed.data);
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

    const scomms = subCommands();
    const subcommand = interaction.options.getSubcommand(true);

    const getEphemeral = interaction.options.getBoolean("ephemeral");

    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    let result;
    switch (subcommand) {
        case "list": {
            const user = interaction.options.getUser("user", true);
            const getPageNumber = interaction.options.getNumber(
                "page-number",
                false
            );
            const pageNumber = getPageNumber !== null ? getPageNumber : 1;

            result = (
                await scomms.list(
                    interaction.guild,
                    user,
                    pageNumber,
                    interaction.createdAt
                )
            ).unwrap();

            break;
        }
        case "undo": {
            const caseNumber = interaction.options.getNumber("case", true);
            const reason = interaction.options.getString("reason", true);

            result = (
                await scomms.undo(
                    interaction.guild,
                    interaction.user,
                    caseNumber,
                    reason,
                    interaction.createdAt
                )
            ).unwrap();
            break;
        }
        case "reason": {
            const caseNumber = interaction.options.getNumber("case", true);
            const newReason = interaction.options.getString("new-reason", true);

            result = (
                await scomms.reason(
                    interaction.guild,
                    interaction.user,
                    caseNumber,
                    newReason,
                    interaction.createdAt
                )
            ).unwrap();
            break;
        }
        default:
            throw new BotErr({
                message: "Nenhum subcomando foi atingido!",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.LogicError,
            });
    }

    await interaction.editReply({ embeds: [result] });

    return Ok.EMPTY;
};
//#endregion

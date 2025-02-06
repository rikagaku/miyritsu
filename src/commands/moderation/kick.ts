/** @format */
//#region               External Libs
import { Ok } from "ts-results";
import {
    ChatInputCommandInteraction,
    Guild,
    PermissionFlagsBits,
    SlashCommandBuilder,
    User,
} from "discord.js";
//#endregion
//#region               Modules
import { types as commandTypes } from "@/system/handlers/command";
import {
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
import { PunishmentHandler } from "../../lib/system/handlers/punishmentHandler";
import { EmbedMessagesHandler } from "//lib/external/handlers/embed";
import { LOCALE } from "../..";
//#endregion
//#region               Typing
export namespace types {
    export type data = () => Promise<Ok<commandTypes.CommandData>>;
    export type action = (
        guild: Guild,
        user: User,
        moderator: User,
        createdAt: Date,
        reason: string
    ) => Promise<Ok<void>>;
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Result<void>>;
}
//#endregion
//#region           Variables
const commandName = "kick";
//#endregion
//#region               Implementation
export const data: types.data = async () => {
    const description = {
        comm: "Aplique mute em alguém!",
        user: "Quem deseja mutar?",
        reason: "Qual o motivo do mute?",
        limit: "Por quanto tempo voce deseja manter essa pessoa mutada?",
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
            .addUserOption((user) =>
                user
                    .setName("user")
                    .setDescription(description.user)
                    .setRequired(true)
            )
            .addStringOption((reason) =>
                reason
                    .setName("reason")
                    .setDescription(description.reason)
                    .setRequired(true)
            )
            .addBooleanOption((ephemeral) =>
                ephemeral
                    .setName("ephemeral")
                    .setDescription(description.ephemeral)
                    .setRequired(false)
            )
            .setDMPermission(false),
    });
};
export const action: types.action = async (
    guild,
    user,
    moderator,
    createdAt,
    reason
) => {
    await guild.members.kick(user, reason);

    await new PunishmentHandler(guild).add(
        user.id,
        moderator.id,
        commandName,
        reason,
        createdAt,
        createdAt
    );

    return Ok.EMPTY;
};
export const execute: types.execute = async (interaction) => {
    const userToKick = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const getEphemeral = interaction.options.getBoolean("ephemeral");
    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    if (!interaction.guild)
        return new BotErr({
            message: "Guild not found!",
            kind: ErrorKind.NotFound,
            origin: ErrorOrigin.Unknown,
        });

    await action(
        interaction.guild,
        userToKick,
        interaction.user,
        interaction.createdAt,
        reason
    );

    const embed = (
        await new EmbedMessagesHandler("info.simpleResponse").Mount({
            title: "Warn",
            description:
                `O usuário ${userToKick} for removido do servidor com sucesso!\\n`,
            createdAt: interaction.createdAt.toLocaleString(LOCALE),
            username: `@${interaction.user.username}`,
        })
    ).unwrap();

    embed.setColor("#fc8000");

    await interaction.editReply({
        embeds: [embed.data],
    });

    return Ok.EMPTY;
};
//#endregion

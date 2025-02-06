/** @format */
//#region               External Libs
import { Ok } from "ts-results";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    Guild,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
//#endregion
//#region               Modules
import {
    EmbedMessagesHandler,
} from "@/external/handlers/embed";
import { PunishmentHandler } from "@/system/handlers/punishmentHandler";
import {
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
import { types as commandTypes } from "@/system/handlers/command";
import { LOCALE } from "../..";
//#endregion
//#region               Typing
export namespace types {
    export type data = () => Promise<Ok<commandTypes.CommandData>>;
    export type action = (
        caseNumber: number,
        guildId: Guild
    ) => Promise<Result<EmbedBuilder>>;
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Result<void>>;
}
//#endregion
//#region           Variables
const commandName = "case";
//#endregion
//#region               Implementation
export const data: types.data = async () => {
    const description = {
        comm: "Veja as informações de um caso!",
        caseNumber: "Qual é o número do caso?",
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
            .addNumberOption((caseNumber) =>
                caseNumber
                    .setName("case")
                    .setDescription(description.caseNumber)
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
export const action: types.action = async (caseNumber, guild) => {
    const punishment = (
        await new PunishmentHandler(guild).get(caseNumber)
    ).unwrap();

    const expiresAtString = punishment.expiresAt.toLocaleString(LOCALE);
    const userAvatar = (
        await guild.members.fetch(punishment.userId)
    ).avatarURL();

    const mountedEmbed = (
        await new EmbedMessagesHandler("info.punishmentCase").Mount({
            ...punishment,
            createdAt: punishment.createdAt.toISOString(),
        })
    ).unwrap();

    if (mountedEmbed.data.fields === undefined)
        return new BotErr({
            message:
                "Nenhum campo foi encontrado! Há um problema no embed.json!",
            kind: ErrorKind.NotFound,
            origin: ErrorOrigin.Internal,
        });

    if (punishment.expiresAt !== punishment.createdAt) {
        mountedEmbed.data.fields.push({
            name: "Data Limite",
            value: expiresAtString,
            inline: true,
        });
    }

    mountedEmbed.data.fields.push({
        name: "Motivo",
        value: punishment.reason,
        inline: false,
    });

    if (userAvatar !== null) {
        mountedEmbed.data.thumbnail = {
            url: userAvatar,
        };
    }

    return Ok(mountedEmbed);
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

    const caseNumber = interaction.options.getNumber("case", true);
    const getEphemeral = interaction.options.getBoolean("ephemeral");
    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    const result = (await action(caseNumber, interaction.guild)).unwrap();

    await interaction.editReply({ embeds: [result.data] });

    return Ok.EMPTY;
};
//#endregion

/** @format */
//#region           External Libs
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    Message,
    MessageReaction,
    TextChannel,
    User,
} from "discord.js";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import react from "@/external/factories/react.f";
import { Log } from "@/system/handlers/log";
import { DMDialog } from "@/external/handlers/dmDialog";
import { EmbedMessagesHandler } from "@/external/handlers/embed";
import { BotErr, ErrorOrigin, ErrorKind } from "@/system/handlers/errHandlers";
//#endregion
//#region           Types
import { types as embedTypes } from "@/external/handlers/embed";
import { types as autoReportTypes } from ">/mod/autoreport";
import { prisma } from "//index";
export namespace types {
    export type PresetedFuns = {
        embed: {
            sendReportMessage: (params: {
                logChat: TextChannel;
                interaction: MessageReaction;
                user: User;
                reason: embedTypes.ReportReason | false;
            }) => Promise<Ok<void>>;
            sendListMessage: (
                params: {
                    commandName: string;
                },
                interaction: ChatInputCommandInteraction,
                iNeedEmbed?: boolean
            ) => Promise<Ok<EmbedBuilder>>;
            warn: {
                missingPermission: (
                    interaction: ChatInputCommandInteraction
                ) => Promise<Ok<EmbedBuilder>>;
            };
        };
        normal: {
            sendReasonQuestion: (
                reaction: Message,
                user: User,
                params: {
                    action: AnyFunction;
                    actionParams: autoReportTypes.PresetParams;
                }
            ) => Promise<Ok<embedTypes.ReportReason | false>>;
        };
    };
}
//#endregion
//#region           Implementaion
const Default: Factory<types.PresetedFuns> = () => {
    const factory: FactoryObj<types.PresetedFuns> = {
        embed: {
            sendReportMessage: async (params) => {
                const date = new Date().toISOString();
                const reportedMessage = params.interaction.message as Message; // !DEV
                const reportedMessageLink = reportedMessage.url;
                const reported: User = reportedMessage.author;
                const reporter: User = params.user;
                const fullReportedUser =
                    reported.discriminator === "0"
                        ? `@${reported.username}`
                        : `${reported.username}#${reported.discriminator}`;
                const fullReporterUser =
                    reporter.discriminator === "0"
                        ? `@${reporter.username}`
                        : `${reporter.username}#${reporter.discriminator}`;
                const description =
                    reportedMessage.content.length > 0
                        ? reportedMessage.content
                        : `O usuário ${fullReportedUser} foi reportado por ${fullReporterUser}`;
                const reportedAvatar = reported.displayAvatarURL();
                const reporterAvatar = reporter.displayAvatarURL();

                const embedParams = {
                    description,
                    date,
                    reportedMessageLink,
                    fullReportedUser,
                    reported,
                    reportedAvatar,
                    fullReporterUser,
                    reporter,
                    reporterAvatar,
                };

                const EmbedHandler = new EmbedMessagesHandler("reportEmbed");

                const getEmbed = await EmbedHandler.Mount(embedParams);
                const embed = getEmbed.unwrap().data;

                if (description === reportedMessage.content) {
                    delete embed.title;
                }

                if (params.reason) {
                    var reason = params.reason.reason;

                    if (params.reason.attURL)
                        reason += `\n\nO delator enviou um [arquivo](${params.reason.attURL})!`;

                    if (!embed.fields) embed.fields = [];
                    embed.fields.push({
                        name: "Motivo",
                        value: reason,
                    });
                }

                const att = reportedMessage.attachments;
                var video;

                if (att.size > 0) {
                    const firstAtt = att.first();

                    if (firstAtt)
                        if (
                            firstAtt.contentType &&
                            !firstAtt.contentType.startsWith("video/")
                        ) {
                            embed.image = {
                                url: firstAtt.url,
                            };
                        } else {
                            video = {
                                url: firstAtt.url,
                            };
                        }
                }

                const finalEmbed = await EmbedHandler.Update(embed);

                await params.logChat.send({
                    embeds: [finalEmbed.val.data],
                });
                if (video)
                    await params.logChat.send({
                        content: video.url,
                    });

                return Ok.EMPTY;
            },
            sendListMessage: async (params, interaction) => {
                const date = new Date().toISOString();
                const author = interaction.user;
                const authorURL = author.displayAvatarURL();
                const authorUsername =
                    author.discriminator === "0"
                        ? `@${author.username}`
                        : `${author.username}#${author.discriminator}`;

                const embedParams = {
                    authorURL,
                    authorUsername,
                    date,
                };

                const EmbedHandler = new EmbedMessagesHandler("listEmbed");

                const getEmbed = await EmbedHandler.Mount(embedParams);
                var embed = getEmbed.unwrap().data;

                const dataTables = await prisma.autoReportPresetInfo.findMany();

                if (dataTables.length === 0) {
                    embed.title = "Vish...";
                    embed.description =
                        "Não existem presets disponíveis!\n" +
                        `*Você pode criar um usando \`/${params.commandName} new\`!*`;
                } else {
                    for (const preset of dataTables) {
                        embed.description += `· **${preset.name}** - `;

                        if (preset.customEmoji) {
                            embed.description += `<:${preset.emoji}:${preset.emojiID}> - `;
                        } else {
                            embed.description += `${preset.emoji} - `;
                        }

                        embed.description +=
                            `<#${preset.chatID}> -> ` +
                            `<#${preset.logChatID}>`;

                        if (!preset.reactNewMessages) {
                            embed.description +=
                                " (not reacting to new messages :x:)";
                        }

                        embed.description += "\n";
                    }
                }

                const mountedEmbed = await EmbedHandler.Update(embed);

                return Ok(mountedEmbed.val);
            },
            warn: {
                missingPermission: async (interaction) => {
                    const date = new Date().toISOString();
                    const author = interaction.user;
                    const authorURL = author.displayAvatarURL();
                    const authorUsername = `${author.username}#${author.discriminator}`;

                    const embedParams = {
                        author,
                        authorUsername,
                        authorURL,
                        date,
                    };

                    const EmbedHandler = new EmbedMessagesHandler(
                        "warn.missingPermission"
                    );

                    const mountedEmbed = await EmbedHandler.Mount(embedParams);

                    return Ok(mountedEmbed.unwrap());
                },
            },
        },
        normal: {
            sendReasonQuestion: async (message, user, params) => {
                if (user.bot) return new Ok(false);

                const messageReaction = message.reactions.resolve(
                    params.actionParams.emoji
                );
                if (!messageReaction)
                    throw new BotErr({
                        message: "Message Reaction not found!",
                        origin: ErrorOrigin.External,
                        kind: ErrorKind.NotFound,
                    });

                messageReaction.remove();

                //#region       Identify user
                const reported = messageReaction.message.author;

                if (!reported)
                    throw new BotErr({
                        message: "Não foi possível identificar o usuário!",
                        origin: ErrorOrigin.External,
                        kind: ErrorKind.Other,
                    });

                const fullReported =
                    reported.discriminator === "0"
                        ? `@${reported.username}`
                        : `${reported.username}#${reported.discriminator}`;

                //#endregion

                const reportMessage =
                    "Você está reportando o usuário " +
                    `**${fullReported}**, o que ele fez? (*máximo de 200 caracteres*)\n\n` +
                    ":loudspeaker: | *Caso tenha clicado sem querer ou " +
                    "não queira mais reportar, você pode clicar no emoji :no_entry:.*";

                //#region       Receive and process the response
                const response = await new DMDialog(
                    user,
                    messageReaction
                ).SingleAnswer(reportMessage, 300000);

                switch (response.val) {
                    // It was not sent on time
                    case "timeisover": {
                        new Log("warn.messageContent").Print({
                            user: user.username + "#" + user.discriminator,
                        });

                        await user.send(
                            "Você não respondeu a tempo! Enviando o report sem um motivo..."
                        );

                        return new Ok({
                            reason: "Não respondeu a tempo, motivo não especificado.",
                        });
                    }
                    // DM is closed
                    case "dmclosed":
                        return Ok({
                            reason: "O usuário tem a DM fechada.",
                        });
                    // Cancellation was requisited
                    case "canceled": {
                        await user.send(
                            ":no_entry: | Às suas ordens! " +
                                "Não irei mais reportar esse usuário para a staff."
                        );

                        const returnReaction = await react.reactOnNewMessage(
                            params.actionParams,
                        );

                        returnReaction.val(messageReaction.message);

                        return Ok(false);
                    }
                }
                //#endregion

                const firstResponse = response.val.first();
                if (firstResponse) {
                    const firstAtt = firstResponse.attachments.first();

                    user.send(":white_check_mark: | Enviando a denúncia... :)");

                    const obj = {
                        reason: firstResponse.content,
                        attURL: firstAtt ? firstAtt.url : undefined,
                    };

                    return Ok(obj);
                } else {
                    throw new BotErr({
                        message:
                            "Algo de errado aconteceu! O DMDialog enviou um objeto vazio!",
                        origin: ErrorOrigin.Internal,
                        kind: ErrorKind.EmptyValue,
                    });
                }
            },
        },
    };
    return factory;
};
export default Default();
//#endregion

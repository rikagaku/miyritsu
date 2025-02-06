/** @format */

//#region           External Libs
import axios from "axios";
import { Ok } from "ts-results";
import {
    Message,
    Collection,
    ButtonStyle,
    NewsChannel,
    TextChannel,
    ButtonBuilder,
    ThreadChannel,
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    SlashCommandOptionsOnlyBuilder,
} from "discord.js";
//#endregion
//#region           Modules
import { Log } from "@/system/handlers/log";
import { EmbedMessagesHandler } from "@/external/handlers/embed";
import { BotErr, ErrorOrigin, ErrorKind } from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
import { types as embedTypes } from "@/external/handlers/embed";
import { types as commandTypes } from "@/system/handlers/command";
export namespace types {
    export type AllowedChannels = TextChannel | NewsChannel | ThreadChannel;
    export type EssentialData = {
        originChat: AllowedChannels;
        destinationChat: AllowedChannels;
    };
    export type BeforeInitialResponseData = EssentialData & {
        interaction: ChatInputCommandInteraction;
    };
    export type AfterInitialResponseData = EssentialData & {
        interaction: ButtonInteraction;
    };
    export type MessagesList = Collection<string, Message<true>>;

    export type Utils = {
        receiveEssentialData: (
            interaction: ChatInputCommandInteraction
        ) => Promise<Ok<types.EssentialData>>;
        createDialog: (
            params: types.BeforeInitialResponseData,
            cancelCallback: (
                interaction: ButtonInteraction
            ) => Promise<Ok<void>>,
            confirmCallback: (
                interaction: ButtonInteraction
            ) => Promise<Ok<void>>
        ) => Promise<Ok<boolean>>;
        sendCancelConfirmation: (
            params: types.AfterInitialResponseData
        ) => Promise<Ok<void>>;
        actionFuns: {
            sendInitialMessage: (
                params: types.AfterInitialResponseData
            ) => Promise<Ok<EmbedMessagesHandler>>;
            updateMessage: (
                params: types.AfterInitialResponseData,
                handler: EmbedMessagesHandler,
                options: embedTypes.UpdateDescLineOptions
            ) => Promise<Ok<void>>;
            fetchUnordenedMessages: (
                params: types.AfterInitialResponseData
            ) => Promise<Ok<types.MessagesList>>;
            sortMessages: (
                messages: types.MessagesList
            ) => Ok<types.MessagesList>;
            filterMessagesWithContent: (
                messages: types.MessagesList
            ) => Ok<types.MessagesList>;
            calculateTotalOfArchives: (
                messages: types.MessagesList
            ) => Ok<number>;
            calculateLots: (
                totalOfArchives: number,
                filesPerLot: number
            ) => Ok<number>;
            calculateApproximateTime: (params: {
                totalOfArchives: number;
                totalOfLots: number;
                delay: number;
                timePerFile?: number;
            }) => Ok<number>;
            sendByLots: (params: {
                essentialData: types.AfterInitialResponseData;
                messageHandler: EmbedMessagesHandler;
                messages: types.MessagesList;
                info: {
                    totalOfLots: number;
                    filesPerLot: number;
                    approximateTime: number;
                    delay: number;
                };
            }) => Promise<Ok<void>>;
        };
    };
    export type action = (
        params: types.AfterInitialResponseData
    ) => Promise<Ok<void>>;
    export type data = () => Ok<
        commandTypes.CommandData<
            Omit<SlashCommandOptionsOnlyBuilder, "addSubcommand" | "addSubcommandGroup">
        >
    >;
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Ok<void>>;
}
//#endregion
//#region           Variables
import messages from "$/messages/normal.json";
const commandName = "movecontent";
//#endregion
//#region           Implementation
export const data: types.data = () => {
    const description = {
        comm: "Mova conteúdos de um chat para o outro!",
        originChat: "De qual chat eu devo pegar os conteúdos?",
        destinationChat: "Para qual chat eu devo mover os conteúdos?",
        ephemeral:
            "Deseja que eu esconda essa mensagem dos outros? (padrão: sim)",
    };

    return Ok({
        properties: {
            guild: false,
        },
        slashData: new SlashCommandBuilder()
            .setName(commandName)
            .setDescription(description.comm)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption((originChat) =>
                originChat
                    .setName("origin-chat")
                    .setDescription(description.originChat)
                    .setRequired(true)
            )
            .addChannelOption((destinationChat) =>
                destinationChat
                    .setName("destination-chat")
                    .setDescription(description.destinationChat)
                    .setRequired(true)
            )
            .addBooleanOption((ephemeral) =>
                ephemeral
                    .setName("ephemeral")
                    .setDescription(description.ephemeral)
                    .setRequired(false)
            ),
    });
};
export const utils: FactoryObj<types.Utils> = {
    receiveEssentialData: async (interaction) => {
        // Receive data
        const originChat = interaction.options.getChannel("origin-chat", true);
        const destinationChat = interaction.options.getChannel(
            "destination-chat",
            true
        );

        // Validate data
        if (
            !(
                originChat instanceof TextChannel ||
                originChat instanceof NewsChannel ||
                originChat instanceof ThreadChannel
            ) ||
            !(
                destinationChat instanceof TextChannel ||
                destinationChat instanceof NewsChannel ||
                destinationChat instanceof ThreadChannel
            )
        ) {
            throw new BotErr({
                message: messages.commands.mod.moveContent.warns.wrongChatType,
                origin: ErrorOrigin.User,
                kind: ErrorKind.TypeError,
            });
        }

        return Ok({
            interaction,
            originChat,
            destinationChat,
        });
    },
    createDialog: async (params, cancelCallback, confirmCallback) => {
        const handler = new EmbedMessagesHandler("moveContent.confirmAction");

        const embed = await handler.Mount({
            originChat: `<#${params.originChat.id}>`,
            destinationChat: `<#${params.destinationChat}>`,
            date: new Date().toISOString(),
            authorUsername: params.interaction.user.username,
            authorURL: params.interaction.user.displayAvatarURL(),
        });

        {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("cancel")
                    .setLabel("Cancelar")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("confirm")
                    .setLabel("Confirmar")
                    .setStyle(ButtonStyle.Danger)
            );

            const message = await params.interaction.editReply({
                embeds: [embed.unwrap().data],
                components: [row],
            });
            const collector = message.createMessageComponentCollector({
                time: 30000,
            });

            return new Promise((resolve) => {
                collector.on("collect", async (interaction) => {
                    if (!(interaction instanceof ButtonInteraction))
                        return void 0;

                    if (params.interaction.user.id !== interaction.user.id) {
                        interaction.reply({
                            content:
                                "O que você está tentando fazer? " +
                                "Você não pode clicar no botão alheio >:(",
                            ephemeral: true,
                        });

                        return void 0;
                    }

                    await interaction.deferReply();

                    if (interaction.customId === "confirm") {
                        await confirmCallback(interaction);
                        collector.stop();
                        resolve(Ok(true));
                    } else {
                        await cancelCallback(interaction);
                        collector.stop();
                        resolve(Ok(false));
                    }

                    return void 0;
                });
            });
        }
    },
    sendCancelConfirmation: async (params) => {
        const handler = new EmbedMessagesHandler("moveContent.canceledAction");
        const embed = await handler.Mount({
            date: new Date().toISOString(),
            authorUsername: params.interaction.user.username,
            authorURL: params.interaction.user.displayAvatarURL(),
        });

        params.interaction.editReply({
            embeds: [embed.unwrap().data],
            components: [],
        });

        return Ok.EMPTY;
    },
    actionFuns: {
        sendInitialMessage: async (params) => {
            const mHandler = new EmbedMessagesHandler(
                "moveContent.generalBaseInformation"
            );
            const initialEmbed = await mHandler.Mount({
                date: new Date().toISOString(),
                authorUsername: params.interaction.user.username,
                authorURL: params.interaction.user.displayAvatarURL(),
            });

            params.interaction.editReply({
                embeds: [initialEmbed.unwrap().data],
            });

            return Ok(mHandler);
        },
        updateMessage: async (params, handler, options) => {
            await handler.UpdateDescLine({
                line: options.line - 1,
                content: options.content,
            });

            try {
                await params.interaction.editReply({
                    embeds: [handler.embed.data],
                });
            } catch (err) {
                throw new BotErr({
                    message: "Ocorreu um erro ao editar a mensagem!",
                    origin: ErrorOrigin.External,
                    kind: ErrorKind.Other,
                    errObj: err,
                });
            }

            return Ok(void 0);
        },
        fetchUnordenedMessages: async (params) => {
            var stop = false;
            var delayCounter = 0;
            var lastMessageId;

            const messages = new Collection<string, Message<true>>();

            while (stop === false) {
                // Set Options
                const options = { limit: 100 };
                if (lastMessageId) {
                    Object.assign(options, { before: lastMessageId });
                }

                // Apply rate delay
                if (delayCounter % 15 === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                // Fetch and avaliate size
                try {
                    const fetchedMessages =
                        await params.originChat.messages.fetch(options);
                    if (fetchedMessages.size === 0) stop = true;

                    // Add to Collection
                    for (const [key, value] of fetchedMessages) {
                        messages.set(key, value);
                    }

                    // Modifications of the variables For
                    lastMessageId = fetchedMessages.last()?.id;
                    delayCounter += 1;
                } catch (err) {
                    throw new BotErr({
                        message: "Ocorreu um erro na busca de mensagens!",
                        origin: ErrorOrigin.External,
                        kind: ErrorKind.Other,
                        errObj: err,
                    });
                }
            }

            return Ok(messages);
        },
        sortMessages: (messages) => {
            const sortedMessages = new Collection<string, Message<true>>();
            const messagesArray = Array.from(messages.values());

            for (let i = messagesArray.length; i !== 0; i--) {
                sortedMessages.set(
                    messagesArray[i - 1].id,
                    messagesArray[i - 1]
                );
            }

            return Ok(sortedMessages);
        },
        filterMessagesWithContent: (messages) => {
            const newCollector = new Collection<string, Message<true>>();

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "video/mp4",
                "video/webm",
                "audio/mpeg",
                "audio/ogg",
            ];

            for (const [key, value] of messages) {
                if (value.attachments.size > 0) {
                    for (const att of value.attachments) {
                        if (
                            att[1].contentType &&
                            allowedTypes.includes(att[1].contentType)
                        ) {
                            newCollector.set(key, value);
                            break;
                        }
                    }
                }
            }

            return Ok(newCollector);
        },
        calculateTotalOfArchives: (messages) => {
            var totalOfArchives = 0;

            for (const value of messages) {
                totalOfArchives += value[1].attachments.size;
            }

            return Ok(totalOfArchives);
        },
        calculateLots: (totalOfArchives, filesPerLots) => {
            const lotsRest = totalOfArchives % filesPerLots;
            const lots =
                lotsRest === 0
                    ? totalOfArchives / filesPerLots
                    : (totalOfArchives - lotsRest) / filesPerLots + 1;

            return Ok(lots);
        },
        calculateApproximateTime: (params) => {
            const TOA = params.totalOfArchives;
            const TOL = params.totalOfLots;
            const TPF = params.timePerFile ? params.timePerFile : 2000;

            // Make sure there are no files
            if (TOA === 0) return Ok(0);

            const aproxTime = TOA * (TPF / 1000) + TOL * (params.delay / 1000);
            const currentDate = new Date();
            const finalTime =
                Math.floor(currentDate.getTime() / 1000) + aproxTime;

            return Ok(finalTime);
        },
        sendByLots: async (params) => {
            const messagesArray = Array.from(params.messages.values());

            // Loop of lots
            for (let lot = 1; lot <= params.info.totalOfLots; lot++) {
                const currentLot = messagesArray.splice(
                    0,
                    params.info.filesPerLot
                );

                for (let i = 0; i < currentLot.length; i++) {
                    const currentMessage = currentLot[i];
                    var attachments = [];

                    // Loop of attachments
                    for (const att of currentMessage.attachments) {
                        try {
                            if (!att[1].contentType) {
                                Log.PrintErr(new Error("Corrupted archive!"));
                                continue;
                            }

                            const response = await axios.get(att[1].url, {
                                responseType: "arraybuffer",
                            });
                            const newAtt = new AttachmentBuilder(
                                Buffer.from(response.data, "binary")
                            );
                            newAtt.setName(att[1].name);

                            attachments.push(newAtt);
                        } catch (err) {
                            throw new BotErr({
                                message: "Ocorreu um erro ao baixar o arquivo!",
                                origin: ErrorOrigin.External,
                                kind: ErrorKind.Other,
                                errObj: err,
                            });
                        }
                    }

                    try {
                        await params.essentialData.destinationChat.send({
                            files: attachments,
                        });
                    } catch (err) {
                        throw new BotErr({
                            message: "Ocorreu um erro ao enviar a mensagem!",
                            origin: ErrorOrigin.External,
                            kind: ErrorKind.NotSent,
                            errObj: err,
                        });
                    }
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, params.info.delay)
                );
            }

            await utils.actionFuns.updateMessage(
                params.essentialData,
                params.messageHandler,
                {
                    line: 8,
                    content:
                        ":white_check_mark: | ~~Baixar e enviar em lotes~~ " +
                        `(${params.info.totalOfLots} / ${params.info.totalOfLots})`,
                }
            );

            await params.essentialData.interaction.followUp({
                content: `${params.essentialData.interaction.user} Finalizado!`,
            });

            return Ok.EMPTY;
        },
    },
};
export const action: types.action = async (params) => {
    const main = async (mHandler: EmbedMessagesHandler): Promise<Ok<void>> => {
        const lotDelay = 3000;
        const filesPerLot = 4;

        //#region               Calculate Values
        // Fetch messages and sort they
        {
            const fetchedMessages =
                await utils.actionFuns.fetchUnordenedMessages(params);

            var sortedMessages = utils.actionFuns.sortMessages(
                fetchedMessages.val
            ).val;
        }
        // Send calculated total messages
        {
            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 4,
                content:
                    ":white_check_mark: | ~~Calcular o total de mensagens~~ " +
                    `(${sortedMessages.size})`,
            });

            // Hover next line
            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 5,
                content:
                    ":arrow_forward: | **Calcular o total de mensagens com arquivos** ",
            });
        }
        // Filter messages with content and send calculated total
        {
            var filteredMessages =
                utils.actionFuns.filterMessagesWithContent(sortedMessages).val;

            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 5,
                content:
                    ":white_check_mark: | ~~Calcular o total de mensagens com arquivos~~ " +
                    `(${filteredMessages.size})`,
            });

            // Hover next line
            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 6,
                content: ":arrow_forward: | **Calcular o total de arquivos** ",
            });
        }

        // Send calculated total of archives
        {
            var totalOfArchives =
                utils.actionFuns.calculateTotalOfArchives(filteredMessages).val;

            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 6,
                content:
                    ":white_check_mark: | ~~Calcular o total de arquivos~~ " +
                    `(${totalOfArchives})`,
            });

            // Hover next line
            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 7,
                content:
                    ":arrow_forward: | **Calcular o total de lotes e o tempo aproximado** ",
            });
        }
        // Calculate approximate time and lots
        {
            var totalOfLots = utils.actionFuns.calculateLots(
                filteredMessages.size,
                filesPerLot
            ).val;
            var approximateTime = utils.actionFuns.calculateApproximateTime({
                totalOfArchives,
                totalOfLots,
                delay: lotDelay,
            }).val;

            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 7,
                content:
                    ":white_check_mark: | ~~Calcular o total de lotes e o tempo aproximado~~ " +
                    `(${totalOfLots} lotes) / (<t:${approximateTime}:R>)`,
            });

            await utils.actionFuns.updateMessage(params, mHandler, {
                line: 8,
                content: ":arrow_forward: | ** Baixar e enviar em lotes** ",
            });
        }
        //#endregion

        // Send messages by Lots
        await utils.actionFuns.sendByLots({
            essentialData: params,
            messageHandler: mHandler,
            messages: filteredMessages,
            info: {
                totalOfLots,
                filesPerLot,
                approximateTime,
                delay: lotDelay,
            },
        });

        return Ok.EMPTY;
    };
    return new Promise((resolve) => {
        utils.actionFuns.sendInitialMessage(params).then((response) => {
            main(response.val).then((response) => {
                resolve(response);
            });
        });
    });
};
export const execute: types.execute = async (interaction) => {
    const getEphemeral = interaction.options.getBoolean("ephemeral");
    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    // Receive Data
    const getEssentialData = await utils.receiveEssentialData(interaction);

    const essentialData = getEssentialData.val;

    // Avaliate if the user wants to confirm
    {
        await utils.createDialog(
            { ...essentialData, interaction },
            async (interaction) => {
                await utils.sendCancelConfirmation({
                    ...essentialData,
                    interaction,
                });

                return Ok.EMPTY;
            },
            async (interaction) => {
                await action({
                    ...essentialData,
                    interaction,
                });

                return Ok.EMPTY;
            }
        );
    }

    return Ok.EMPTY;
};
//#endregion

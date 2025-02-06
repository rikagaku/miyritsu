/** @format */
//#region           External Libs
import {
    APIEmbed,
    AutocompleteInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    Events,
    GuildEmoji,
    Message,
    MessageReaction,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    Snowflake,
    TextBasedChannel,
    TextChannel,
    User,
} from "discord.js";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import reqs from "@/system/factories/rest.f";
import react from "@/external/factories/react.f";
import filter from "@/system/factories/filter.f";
import string from "@/system/factories/string.f";
import verify from "@/system/factories/verify.f";
import messagesLib from "@/external/factories/preseted.f";
import {
    errors,
    DefaultErr,
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
import { Log } from "@/system/handlers/log";
import { client, prisma } from "//index";
import { ListenerHandler } from "@/system/handlers/listener";
//#endregion
//#region           Typing
import { types as commandTypes } from "@/system/handlers/command";
export namespace types {
    export type PresetParams = {
        name: string;
        chat: TextBasedChannel;
        logChat: TextBasedChannel;
        emoji: string | Snowflake;
        customEmoji?: boolean;
    };

    export type ReceivedStoredParams = {
        name: string;
        chatID: string;
        logChatID: string;
        emoji: string;
        emojiID?: string;
        customEmoji?: boolean;
    };

    export type ReceivedData = {
        presetName: string;
        chat?: TextChannel;
        logChat?: TextChannel;
        receivedEmoji?: string;
        presetNewName?: string;
    };
    export type PossibleReceivedData = {
        [key: string]: string | TextChannel | undefined;
        presetName: string;
        chat?: TextChannel;
        logChat?: TextChannel;
        receivedEmoji?: string;
        presetNewName?: string;
    };

    // Funções
    export type Utils = {
        /**
         * Receive data from interaction object and return it.
         * @param interaction - Object of the interaction
         * @param isRequired - An array with the indexes of the properties that are required ->
         * *[0 = chat, 1 = logChat, 2 = emoji, 3 = preset-new-name]*
         */
        receiveData: (
            interaction: ChatInputCommandInteraction,
            isRequired: boolean[]
        ) => Ok<types.ReceivedData>;
    };
    export type SubCommands = {
        new: (interaction: ChatInputCommandInteraction) => Promise<Ok<string>>;
        edit: (interaction: ChatInputCommandInteraction) => Promise<Ok<string>>;
        rm: (interaction: ChatInputCommandInteraction) => Promise<Ok<string>>;
        list: (
            interaction: ChatInputCommandInteraction
        ) => Promise<Ok<string | APIEmbed>>;
    };

    export type actionListener = (
        message: Message,
        emoji: GuildEmoji | string
    ) => Ok<void>;
    export type data = () => Ok<
        commandTypes.CommandData<SlashCommandSubcommandsOnlyBuilder>
    >;
    export type actionFunction = (
        params: types.ReceivedStoredParams
    ) => Promise<Ok<AnyFunction>>;
    export type execute = (
        interaction: ChatInputCommandInteraction
    ) => Promise<Ok<void>>;
    export type autocomplete = (
        interaction: AutocompleteInteraction
    ) => Promise<Result<void>>;
}
//#endregion
//#region           Variables
import messages from "$/messages/normal.json";
const commandName = "autoreport";
//#endregion
//#region           Implementation
export const data: types.data = () => {
    const description = {
        comm: "Cria um preset para eu reagir nos chats!",
        ephemeral:
            "Deseja que eu esconda essa mensagem dos outros? (padrão: sim)",
        new: {
            subc: "Crie um novo preset para eu reagir às mensagens!",
            preset:
                "Dê um nome único para esse preset. " +
                "Pode conter: maiúsculas, minúsculas, sublinhados e números)!",
            chat: "Chat onde os usuários terão reações de reportar em suas mensagens :)",
            logChat: "Chat onde irei dedurar o usuário para a staff! >:)",
            emote: "Reação que usarei para os usuários poderem reportar alguém.",
        },
        edit: {
            subc: "Edita o preset que você criou para eu reagir nos chats!",
            preset: "Qual preset você deseja editar?",
            chat: "Qual será o novo chat para eu vigiar?",
            logChat: "Qual será o novo chat para eu dedurar os membros?",
            emote: "Qual vai ser a nova reação?",
            presetNewName: "Qual será o novo nome do preset?",
        },
        remove: {
            subc: "Remove o preset que você criou para eu reagir nos chats!",
            preset: "Qual preset você deseja remover?",
            preservePrevious:
                "Você deseja que eu continue lidando com as mensagens já reagidas? " +
                "(remoção parcial)",
        },
        list: {
            subc: "Lista todos os presets que você criou para eu reagir nos chats!",
            withOlds:
                "Decida se você quer que eu inclua os presets que " +
                "não foram totalmente removidos.",
        },
    };

    return Ok({
        properties: {
            guild: false,
        },
        slashData: new SlashCommandBuilder()
            .setName(commandName)
            .setDescription(description.comm)
            .addSubcommand((New) =>
                New.setName("new")
                    .setDescription(description.new.subc)
                    .addStringOption((presetName) =>
                        presetName
                            .setName("preset-name")
                            .setDescription(description.new.preset)
                            .setRequired(true)
                    )
                    .addChannelOption((chat) =>
                        chat
                            .setName("chat")
                            .setDescription(description.new.chat)
                            .addChannelTypes(ChannelType.GuildText)
                            .setRequired(true)
                    )
                    .addChannelOption((logChat) =>
                        logChat
                            .setName("log-chat")
                            .setDescription(description.new.logChat)
                            .addChannelTypes(ChannelType.GuildText)
                            .setRequired(true)
                    )
                    .addStringOption((emote) =>
                        emote
                            .setName("emote")
                            .setDescription(description.new.emote)
                            .setRequired(true)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .addSubcommand((edit) =>
                edit
                    .setName("edit")
                    .setDescription(description.edit.subc)
                    .addStringOption((presetName) =>
                        presetName
                            .setName("preset-name")
                            .setDescription(description.edit.preset)
                            .setAutocomplete(true)
                            .setRequired(true)
                    )
                    .addChannelOption((chat) =>
                        chat
                            .setName("chat")
                            .setDescription(description.edit.chat)
                            .addChannelTypes(ChannelType.GuildText)
                    )
                    .addChannelOption((logChat) =>
                        logChat
                            .setName("log-chat")
                            .setDescription(description.edit.logChat)
                            .addChannelTypes(ChannelType.GuildText)
                    )
                    .addStringOption((emote) =>
                        emote
                            .setName("emote")
                            .setDescription(description.edit.emote)
                    )
                    .addStringOption((presetNewName) =>
                        presetNewName
                            .setName("preset-new-name")
                            .setDescription(description.edit.presetNewName)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .addSubcommand((remove) =>
                remove
                    .setName("remove")
                    .setDescription(description.remove.subc)
                    .addStringOption((presetName) =>
                        presetName
                            .setName("preset-name")
                            .setDescription(description.remove.preset)
                            .setAutocomplete(true)
                            .setRequired(true)
                    )
                    .addBooleanOption((preservePrevious) =>
                        preservePrevious
                            .setName("preserve-previous")
                            .setDescription(description.remove.preservePrevious)
                    )
                    .addBooleanOption((ephemeral) =>
                        ephemeral
                            .setName("ephemeral")
                            .setDescription(description.ephemeral)
                            .setRequired(false)
                    )
            )
            .addSubcommand((list) =>
                list
                    .setName("list")
                    .setDescription(description.list.subc)
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
export const action: types.actionFunction = async (params) => {
    // Receive Preset data
    {
        const chatNotFound =
            "Algo de errado aconteceu!" +
            "Na requisição de verificação, o chat existia, porém não mais!";
        const emojiNotFound =
            "Algo de errado aconteceu!" +
            "Na requisição de verificação, o emoji existia, porém não mais!";
        const wrongTypeErr = "Você precisa entregar um canal de texto!";

        var chat: TextChannel;

        const getChat = await client.channels.fetch(params.chatID);
        {
            if (!getChat) {
                throw new BotErr({
                    message: chatNotFound,
                    origin: ErrorOrigin.External,
                    kind: ErrorKind.NotFound,
                });
            } else if (getChat instanceof TextChannel) {
                chat = getChat;
            } else {
                throw new BotErr({
                    message: wrongTypeErr,
                    origin: ErrorOrigin.User,
                    kind: ErrorKind.TypeError,
                });
            }
        }

        var logChat: TextChannel;
        const getLogChat = await client.channels.fetch(params.logChatID);
        {
            if (!getLogChat) {
                throw new BotErr({
                    message: chatNotFound,
                    origin: ErrorOrigin.External,
                    kind: ErrorKind.NotFound,
                });
            } else if (getLogChat instanceof TextChannel) {
                logChat = getLogChat;
            } else {
                throw new BotErr({
                    message: wrongTypeErr,
                    origin: ErrorOrigin.User,
                    kind: ErrorKind.TypeError,
                });
            }
        }

        var emoji: string | GuildEmoji;
        if (params.customEmoji && params.emojiID) {
            const getEmoji = client.emojis.resolve(params.emojiID);

            if (!getEmoji)
                throw new BotErr({
                    message: emojiNotFound,
                    origin: ErrorOrigin.External,
                    kind: ErrorKind.NotFound,
                });

            emoji = params.emojiID;
        } else {
            emoji = params.emoji;
        }

        var executionParams = {
            name: params.name,
            chat,
            logChat,
            emoji,
            customEmoji: params.customEmoji,
        };
    }

    const actionOnUserReaction = async (
        reaction: MessageReaction,
        user: User
    ): Promise<Ok<void>> => {
        if (
            reaction.message.channel.id !== params.chatID ||
            user.bot ||
            (reaction.emoji.id !== params.emojiID &&
                reaction.emoji.name !== params.emoji)
            ) {
            return Ok.EMPTY;
        }

        const message = (
            await reqs.getMessage(
                reaction.message.channel.id,
                reaction.message.id
            )
        ).val;

        const reason = await messagesLib.normal.sendReasonQuestion(
            message,
            user,
            {
                action: actionOnUserReaction,
                actionParams: executionParams,
            }
        );

        // Writing to the database
        {
            // Get data
            const dataTable = await prisma.autoReportPresetData.findUnique({
                where: { name: params.name },
            });
            if (!dataTable) throw new BotErr(errors.presetNotFound);

            // Put on 'alreadyReported'
            if (!Array.isArray(dataTable.alreadyReported))
                throw new BotErr(errors.typeErr);

            dataTable.alreadyReported.push(reaction.message.id);

            // Update database
            await prisma.autoReportPresetData.update({
                where: { name: params.name },
                data: {
                    alreadyReported: dataTable.alreadyReported,
                },
            });
        }

        // Cancel the report if the user requested
        if (!reason.val) return Ok.EMPTY;

        messagesLib.embed.sendReportMessage({
            interaction: reaction,
            user,
            logChat,
            reason: reason.val,
        });

        return Ok.EMPTY;
    };

    // Create Listeners
    {
        const actionOnFirstReaction = await react.reactOnNewMessage(
            executionParams
        );

        // React to new messages
        new ListenerHandler(
            Events.MessageCreate,
            `${Events.MessageCreate}-${params.name}`
        ).NewOn(actionOnFirstReaction.val);
        // Wait user reactions
        new ListenerHandler(
            Events.MessageReactionAdd,
            `${Events.MessageReactionAdd}-${params.name}`
        ).NewOn(actionOnUserReaction);
    }

    return Ok(actionOnUserReaction);
};
export const utils: types.Utils = {
    receiveData: (interaction, isRequired: boolean[]) => {
        const textBasedErr = {
            message: "This channel is not text based!",
            origin: ErrorOrigin.External,
            kind: ErrorKind.TypeError,
        };

        // Receber os dados
        const presetName = interaction.options.getString("preset-name", true);
        const chat = interaction.options.getChannel("chat", isRequired[0]);
        const logChat = interaction.options.getChannel(
            "log-chat",
            isRequired[1]
        );
        const receivedEmoji = interaction.options.getString(
            "emote",
            isRequired[2]
        );
        const presetNewName = interaction.options.getString(
            "preset-new-name",
            isRequired[3]
        );

        if (chat && !(chat instanceof TextChannel))
            throw new BotErr(textBasedErr);
        if (logChat && !(logChat instanceof TextChannel))
            throw new BotErr(textBasedErr);

        const data: Record<string, string | TextChannel | null> = {
            presetName,
            chat,
            logChat,
            receivedEmoji,
            presetNewName,
        };
        const newData: types.PossibleReceivedData = {
            presetName,
        };

        for (const obj in data) {
            if (obj === "presetName") continue;

            const newValue = data[obj];
            if (obj !== undefined && newValue !== null) {
                newData[obj] = newValue;
            }
        }

        return Ok(newData);
    },
};
const subCommands: Factory<types.SubCommands> = () => {
    const noReceivedRequiredParams: DefaultErr = {
        message:
            "Por algum motivo os parâmetros obrigatórios não foram recebidos.",
        origin: ErrorOrigin.External,
        kind: ErrorKind.MissingParam,
    };

    const factory: FactoryObj<types.SubCommands> = {
        new: async (interaction) => {
            var { presetName, chat, logChat, receivedEmoji } =
                utils.receiveData(interaction, [true, true, true]).val;

            if (!chat || !logChat || !receivedEmoji)
                throw new BotErr(noReceivedRequiredParams);

            const sanitizedEmoji = filter.sanitizeEmoji(receivedEmoji).val;
            const emojiId = sanitizedEmoji.filteredEmoji.id;
            const customEmoji = verify.customEmojiExists(
                interaction,
                sanitizedEmoji.filteredEmoji.name
            ).val;

            const presetParams = {
                chatID: chat.id,
                logChatID: logChat.id,
                emoji: sanitizedEmoji.filteredEmoji.name,
                emojiID: emojiId ? emojiId : undefined,
                customEmoji,
            };

            const presetInfo = await prisma.autoReportPresetInfo.create({
                data: {
                    name: presetName,
                    reactNewMessages: true,
                    ...presetParams,
                },
            });

            await prisma.autoReportPresetData.create({
                data: {
                    name: presetName,
                    alreadyReported: [],
                    infoUUID: presetInfo.uuid,
                },
            });

            await action({
                name: presetName,
                ...presetParams,
            });

            return Ok(
                string.varInterpreter(
                    messages.commands.mod.autoreport.utils.success.createPreset,
                    { presetName: presetName }
                ).val
            );
        },
        edit: async (interaction) => {
            // Receber Dados
            const receivedData: types.ReceivedData = utils.receiveData(
                interaction,
                [false, false, false, false]
            ).val;

            //#region   Verificações
            {
                // Tentativa de editar um preset parcialmente removido
                if (receivedData.presetName.startsWith("old_")) {
                    const getMessage = string.varInterpreter(
                        messages.commands.mod.autoreport.warns
                            .partialEditRemoval,
                        { presetName: receivedData.presetName }
                    );

                    throw new BotErr({
                        message: getMessage.val,
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.GhostEditing,
                    });
                }

                // Mínimo de parâmetros opcionais
                if (
                    !(
                        receivedData.chat ||
                        receivedData.logChat ||
                        receivedData.presetNewName ||
                        receivedData.receivedEmoji
                    )
                ) {
                    throw new BotErr({
                        message:
                            messages.commands.mod.autoreport.warns
                                .minimalOptionalParam,
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.NotEnoughArgs,
                    });
                }
            }
            //#endregion

            var sanitizeReceivedEmoji = receivedData.receivedEmoji
                ? filter.sanitizeEmoji(receivedData.receivedEmoji).val
                : null;
            const receivedCustomEmoji = sanitizeReceivedEmoji
                ? verify.customEmojiExists(
                      interaction,
                      sanitizeReceivedEmoji.filteredEmoji.name
                  ).val
                : null;

            const editedPreset = await prisma.autoReportPresetInfo.update({
                where: { name: receivedData.presetName },
                data: {
                    chatID: receivedData.chat
                        ? receivedData.chat.id
                        : undefined,
                    logChatID: receivedData.logChat
                        ? receivedData.logChat.id
                        : undefined,
                    name: receivedData.presetNewName,
                    emoji: sanitizeReceivedEmoji
                        ? sanitizeReceivedEmoji.filteredEmoji.name
                        : undefined,
                    emojiID: sanitizeReceivedEmoji
                        ? sanitizeReceivedEmoji.filteredEmoji.id
                        : undefined,
                    customEmoji:
                        sanitizeReceivedEmoji &&
                        typeof receivedCustomEmoji === "boolean"
                            ? receivedCustomEmoji
                            : undefined,
                },
            });

            const newObj = editedPreset;
            if (!newObj)
                throw new BotErr({
                    message:
                        "Algo de errado aconteceu! O editPreset não retornou o objeto.",
                    origin: ErrorOrigin.Internal,
                    kind: ErrorKind.Other,
                });

            if (typeof newObj.emoji === "string") {
                var sanitizedEmoji = filter.sanitizeEmoji(newObj.emoji).val;
            } else {
                throw new BotErr({
                    message:
                        "Something is wrong! The emoji cannot be sanitized.",
                    origin: ErrorOrigin.Internal,
                    kind: ErrorKind.Other,
                });
            }

            const customEmoji = verify.customEmojiExists(
                interaction,
                sanitizedEmoji.filteredEmoji.name
            ).val;

            if (
                typeof newObj.chatID !== "string" ||
                typeof newObj.logChatID !== "string" ||
                (newObj.emojiID !== null &&
                    newObj.emojiID !== undefined &&
                    typeof newObj.emojiID !== "string")
            )
                throw new BotErr({
                    message:
                        "Something is wrong! One of the IDs is not a Snowflake.",
                    origin: ErrorOrigin.Internal,
                    kind: ErrorKind.Other,
                });

            const executionParams = {
                name: newObj.name,
                chatID: newObj.chatID,
                logChatID: newObj.logChatID,
                emoji: "",
                emojiID: newObj.emojiID ? newObj.emojiID : undefined,
                customEmoji,
            };
            if (sanitizedEmoji.filteredEmoji.id)
                executionParams.emoji = sanitizedEmoji.filteredEmoji.id;
            else executionParams.emoji = sanitizedEmoji.filteredEmoji.name;

            if (sanitizedEmoji.emojiFormat === "custom" && !customEmoji) {
                const getMessage = string.varInterpreter(
                    messages.commands.mod.autoreport.errors.emojiNotFound,
                    { receivedEmoji: receivedData.receivedEmoji }
                );

                throw new BotErr({
                    message: getMessage.val,
                    origin: ErrorOrigin.User,
                    kind: ErrorKind.NotFound,
                });
            }

            new ListenerHandler(
                Events.MessageCreate,
                `${Events.MessageCreate}-${receivedData.presetName}`
            ).Remove();
            new ListenerHandler(
                Events.MessageReactionAdd,
                `${Events.MessageReactionAdd}-${receivedData.presetName}`
            ).Remove();

            await action(executionParams);

            const sucessMessage = string.varInterpreter(
                messages.commands.mod.autoreport.sucess.presetEdited,
                { presetName: receivedData.presetName }
            );

            return Ok(sucessMessage.val);
        },
        rm: async (interaction) => {
            const presetName = interaction.options.getString(
                "preset-name",
                true
            );
            const preservePrevious =
                interaction.options.getBoolean("preserve-previous");

            if (preservePrevious) {
                await prisma.autoReportPresetInfo.update({
                    where: { name: presetName },
                    data: { reactNewMessages: false },
                });
            } else {
                await prisma.autoReportPresetData.delete({
                    where: { name: presetName },
                });

                await prisma.autoReportPresetInfo.delete({
                    where: { name: presetName },
                });

                new ListenerHandler(
                    Events.MessageReactionAdd,
                    `${Events.MessageReactionAdd}-${presetName}`
                ).Remove();
            }

            new ListenerHandler(
                Events.MessageCreate,
                `${Events.MessageCreate}-${presetName}`
            ).Remove();

            return Ok(`O preset **${presetName}** foi removido`);
        },
        list: async (interaction) => {
            const messageEmbed = await messagesLib.embed.sendListMessage(
                {
                    commandName,
                },
                interaction,
                true
            );

            return Ok(messageEmbed.val.data);
        },
    };
    return factory;
};
export const execute: types.execute = async (interaction) => {
    const scomms = subCommands();
    const subcommand = interaction.options.getSubcommand(true);

    var response: Ok<string | APIEmbed>;
    const getEphemeral = interaction.options.getBoolean("ephemeral");

    await interaction.deferReply({
        ephemeral: getEphemeral !== null ? getEphemeral : true,
    });

    switch (subcommand) {
        case "new":
            response = await scomms.new(interaction);
            break;
        case "edit":
            response = await scomms.edit(interaction);
            break;
        case "remove":
            response = await scomms.rm(interaction);
            break;
        case "list":
            response = await scomms.list(interaction);
            break;
        default:
            throw new BotErr({
                message: "Nenhum subcomando foi atingido!",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.LogicError,
            });
    }

    if (typeof response.val === "object")
        await interaction.editReply({ embeds: [response.val] });
    else await interaction.editReply(response.val);

    new Log("interaction.usedCommand").Print({
        user: interaction.user.username,
        commandName: subcommand,
    });

    return Ok.EMPTY;
};
export const autocomplete: types.autocomplete = async (interaction) => {
    const focused = interaction.options.getFocused(true);
    const list = await prisma.autoReportPresetInfo.findMany({
        select: {
            name: true,
        },
    });

    const subComm = interaction.options.getSubcommand();

    if (subComm === "remove") {
        if (focused.name === "preset-name") {
            await interaction.respond(
                list.map((value) => ({
                    value: value.name,
                    name: value.name,
                }))
            );
        }
    } else if (subComm === "edit") {
        if (focused.name === "preset-name") {
            await interaction.respond(
                list
                    .filter((value) => !value.name.startsWith("old_"))
                    .map((value) => ({ value: value.name, name: value.name }))
            );
        }
    } else {
        return new BotErr({
            message:
                "You're enabling autocomplete for a subcommand " +
                "that doesn't implement it!",
            origin: ErrorOrigin.Internal,
            kind: ErrorKind.Other,
        });
    }

    return Ok.EMPTY;
};
//#endregion

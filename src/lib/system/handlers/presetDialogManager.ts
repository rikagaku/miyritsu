/** @format */

//#region           External
import {
    APIEmbed,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    ColorResolvable,
    PartialGroupDMChannel,
    Snowflake,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from "discord.js";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import { EmbedMessagesHandler } from "../../external/handlers/embed";
import { BotErr, ErrorOrigin, ErrorKind } from "@/system/handlers/errHandlers";
import { prisma } from "//index";
//#endregion
//#region           Types
export namespace types {
    export type ChannelDialogOptions = {
        globalButton?: boolean;
    };
    export type DataDialogs = {
        PresetName: () => Promise<Ok<string>>;
        String: (questionEmbed: APIEmbed) => Promise<Ok<string>>;
        Options: (
            data: {
                description: string;
                placeholder?: string;
            },
            optionsData: {
                label: string;
                description: string;
                value: string;
            }[]
        ) => Promise<Ok<string[]>>;
        Channels: (data: {
            description: string;
            placeholder?: string;
        }) => Promise<Ok<Snowflake>>;
    };
}
//#endregion
//#region           Implementation
export class PresetDialogHandler {
    interaction: ChatInputCommandInteraction;
    embedColor: ColorResolvable;
    action: string;

    baseEmbedParams: {
        date: string;
        authorUsername: string;
        authorURL: string;
        color: ColorResolvable;
    };

    readonly commandName: string;
    readonly commandLabel: string;
    readonly actionColors: Record<string, ColorResolvable>;

    constructor(
        interaction: ChatInputCommandInteraction,
        commandName: string,
        commandLabel: string
    ) {
        this.interaction = interaction;

        this.embedColor = "#2b2d31";
        this.action = "unknown";

        this.baseEmbedParams = {
            date: new Date(this.interaction.createdTimestamp).toISOString(),
            authorUsername: this.interaction.user.username,
            authorURL: this.interaction.user.displayAvatarURL(),
            color: this.embedColor,
        };

        this.commandName = commandName;
        this.commandLabel = commandLabel;
        this.actionColors = {
            add: "#00ff00",
            edit: "#00ffff",
            remove: "#ff0000",
            list: "#ffff00",
            unknown: "#2b2d31",
        };
    }

    private UpdateInfo(): Ok<void> {
        this.embedColor = this.actionColors[this.action];
        this.baseEmbedParams = {
            ...this.baseEmbedParams,
            color: this.embedColor,
        };

        return Ok.EMPTY;
    }

    public async GetActionDialog(): Promise<
        Ok<{ customID: string; interaction: ButtonInteraction }>
    > {
        //#region           Create buttons
        const addButton = new ButtonBuilder()
            .setCustomId("add")
            .setLabel("Adicionar")
            .setStyle(ButtonStyle.Success);
        const editButton = new ButtonBuilder()
            .setCustomId("edit")
            .setLabel("Editar")
            .setStyle(ButtonStyle.Primary);
        const removeButton = new ButtonBuilder()
            .setCustomId("rm")
            .setLabel("Remover")
            .setStyle(ButtonStyle.Danger);
        const listButton = new ButtonBuilder()
            .setCustomId("list")
            .setLabel("Listar")
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            addButton,
            editButton,
            removeButton,
            listButton
        );
        //#endregion

        //#region           Create embed
        const embed = await new EmbedMessagesHandler(
            "presetDialog.actionDialog"
        ).Mount(
            {
                commandName: this.commandLabel,
                ...this.baseEmbedParams,
            },
            {
                withBase: true,
            }
        );
        //#endregion

        const actionDialog = await this.interaction.editReply({
            embeds: [embed.unwrap().data],
            components: [row],
        });

        return new Promise((resolve) => {
            const collector = actionDialog.createMessageComponentCollector({
                time: 30000,
                max: 1,
            });
            collector.on("collect", async (buttonInteraction) => {
                if (!(buttonInteraction instanceof ButtonInteraction))
                    return void 0;

                this.action = buttonInteraction.customId;
                this.UpdateInfo();

                resolve(
                    Ok({
                        customID: buttonInteraction.customId,
                        interaction: buttonInteraction,
                    })
                );

                return void 0;
            });
        });
    }
    public async SuccessDialog(): Promise<Ok<void>> {
        const getEmbed = await new EmbedMessagesHandler(
            "presetDialog.successDialog"
        ).Mount({ commandName: this.commandLabel });

        await this.interaction.editReply({
            embeds: [getEmbed.unwrap().data],
            components: [],
            content: "",
        });

        return Ok.EMPTY;
    }
    public DataDialog(): FactoryObj<types.DataDialogs> {
        const factory: FactoryObj<types.DataDialogs> = {
            PresetName: async () => {
                if (this.interaction.channel === null) {
                    throw new BotErr({
                        message: "This interaction doesn't have a channel!",
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.TypeError,
                    });
                } else if (this.interaction.channel instanceof PartialGroupDMChannel) {
                    throw new BotErr({
                        message: "You can't use it with a channel of GroupDMChannel class!",
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.TypeError,
                    });
                }

                const verifyPresetExistence = async (
                    presetName: string
                ): Promise<Ok<boolean>> => {
                    try {
                        const getPreset =
                            prisma.autoReportPresetInfo.findUnique({
                                where: {
                                    name: presetName,
                                },
                            });

                        if (getPreset === null)
                            throw new BotErr({
                                message: "Preset not found!",
                                origin: ErrorOrigin.User,
                                kind: ErrorKind.NotFound,
                            });

                        return Ok(true);
                    } catch (err) {
                        if (
                            err instanceof BotErr &&
                            err.val.kind === ErrorKind.NotFound
                        )
                            return Ok(false);

                        throw err;
                    }
                };

                const embed = (
                    await new EmbedMessagesHandler(
                        "presetDialog.presetNameDialog"
                    ).Mount({ commandLabel: this.commandLabel })
                ).unwrap().data;

                this.interaction.editReply({
                    embeds: [embed],
                    components: [],
                });

                let awaitResponse = (
                    await this.interaction.channel.awaitMessages({
                        max: 1,
                        time: 60000,
                        filter: (i) => i.author.id === this.interaction.user.id,
                    })
                ).first();

                if (awaitResponse === undefined) {
                    throw new BotErr({
                        message: "Tempo esgotado!",
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.TimeOut,
                    });
                }

                let presetName = awaitResponse.content;
                await awaitResponse.delete();

                while ((await verifyPresetExistence(presetName)).val) {
                    const embed = (
                        await new EmbedMessagesHandler(
                            "presetDialog.err.presetAlreadyExists"
                        ).Mount({ presetName })
                    ).unwrap().data;

                    await this.interaction.editReply({
                        embeds: [embed],
                        components: [],
                    });

                    awaitResponse = (
                        await this.interaction.channel.awaitMessages({
                            max: 1,
                            time: 30000,
                            filter: (i) =>
                                i.author.id === this.interaction.user.id,
                        })
                    ).first();

                    if (awaitResponse === undefined) {
                        throw new BotErr({
                            message: "Tempo esgotado!",
                            origin: ErrorOrigin.User,
                            kind: ErrorKind.TimeOut,
                        });
                    }

                    presetName = awaitResponse.content;
                    await awaitResponse.delete();
                }

                return Ok(presetName);
            },
            String: async (questionEmbed) => {
                this.interaction.editReply({
                    embeds: [questionEmbed],
                    components: [],
                    content: "",
                });

                const getResponse = async (
                    interaction: ChatInputCommandInteraction
                ): Promise<Ok<string>> => {
                    if (interaction.channel === null) {
                        throw new BotErr({
                            message: "This interaction doesn't have a channel!",
                            origin: ErrorOrigin.User,
                            kind: ErrorKind.TypeError,
                        });
                    } else if (interaction.channel instanceof PartialGroupDMChannel) {
                        throw new BotErr({
                            message: "You can't use it with a channel of GroupDMChannel class!",
                            origin: ErrorOrigin.User,
                            kind: ErrorKind.TypeError,
                        });
                    }

                    const awaitResponse = (
                        await interaction.channel.awaitMessages({
                            max: 1,
                            time: 60000,
                            filter: (i) =>
                                i.author.id === this.interaction.user.id,
                        })
                    ).first();

                    if (awaitResponse === undefined) {
                        throw new BotErr({
                            message: "Tempo esgotado!",
                            origin: ErrorOrigin.User,
                            kind: ErrorKind.TimeOut,
                        });
                    }
                    await awaitResponse.delete();

                    return Ok(awaitResponse.content);
                };

                const receivedString = (await getResponse(this.interaction))
                    .val;

                return Ok(receivedString);
            },
            Options: async (data, optionsData) => {
                const defaultPlaceholder = "Selecione uma opção!";
                var options: StringSelectMenuOptionBuilder[] = [];

                for (const option of optionsData) {
                    options.push(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(option.label)
                            .setDescription(option.description)
                            .setValue(option.value)
                    );
                }

                const select = new StringSelectMenuBuilder()
                    .setCustomId("option")
                    .setPlaceholder(
                        data.placeholder ? data.placeholder : defaultPlaceholder
                    )
                    .addOptions(...optionsData)
                    .setMinValues(1)
                    .setMaxValues(1);

                const row =
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        select
                    );

                const embed = await new EmbedMessagesHandler(
                    "presetDialog.optionsDialog"
                ).Mount(
                    {
                        description: data.description,
                        ...this.baseEmbedParams,
                    },
                    {
                        withBase: true,
                    }
                );

                const dialog = await this.interaction.editReply({
                    embeds: [embed.unwrap().data],
                    components: [row],
                });

                return new Promise((resolve) => {
                    const collector = dialog.createMessageComponentCollector({
                        time: 30000,
                        max: 1,
                    });
                    collector.on("collect", async (interaction) => {
                        if (
                            !(
                                interaction instanceof
                                StringSelectMenuInteraction
                            )
                        )
                            return void 0;

                        await interaction.deferUpdate();

                        resolve(Ok(interaction.values));

                        return void 0;
                    });
                });
            },
            Channels: async (data) => {
                const defaultPlaceholder = "Selecione um canal!";
                const select = new ChannelSelectMenuBuilder()
                    .setCustomId("type")
                    .setPlaceholder(
                        data.placeholder ? data.placeholder : defaultPlaceholder
                    )
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setChannelTypes([
                        ChannelType.GuildText,
                        ChannelType.PublicThread,
                        ChannelType.PrivateThread,
                    ]);

                const menuRow =
                    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                        select
                    );

                const embed = await new EmbedMessagesHandler(
                    "presetDialog.channelsDialog"
                ).Mount(
                    {
                        description: data.description,
                        ...this.baseEmbedParams,
                    },
                    {
                        withBase: true,
                    }
                );

                const dialog = await this.interaction.editReply({
                    embeds: [embed.unwrap().data],
                    components: [menuRow],
                });

                return new Promise((resolve) => {
                    const collector = dialog.createMessageComponentCollector({
                        time: 30000,
                        max: 1,
                    });
                    collector.on("collect", async (interaction) => {
                        if (
                            interaction instanceof ChannelSelectMenuInteraction
                        ) {
                            await interaction.update({});

                            resolve(Ok(interaction.channelId));
                        }

                        return void 0;
                    });
                });
            },
        };
        return factory;
    }
}
//#endregion

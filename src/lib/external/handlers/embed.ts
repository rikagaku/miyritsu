/** @format */
//#region           External Libs
import {
    APIEmbed,
    APIEmbedAuthor,
    APIEmbedField,
    APIEmbedImage,
    APIEmbedProvider,
    APIEmbedThumbnail,
    APIEmbedVideo,
    Collection,
    ColorResolvable,
    EmbedBuilder,
    Message,
    TextChannel,
} from "discord.js";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import read from "@/system/factories/fs/read.f";
import string from "@/system/factories/string.f";
import {
    DefaultErr,
    BotErr,
    ErrorKind,
    ErrorOrigin,
    Result,
} from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
export namespace types {
    export interface BaseEmbedProperties {
        color?: string;
        timestamp?: string;
        footer?: {
            text: string;
            iconURL: string;
        };
    }
    export interface Embed extends BaseEmbedProperties {
        title: string;
        description: string;
        url?: string;
        image?: APIEmbedImage;
        thumbnail?: APIEmbedThumbnail;
        video?: APIEmbedVideo;
        provider?: APIEmbedProvider;
        author?: APIEmbedAuthor;
        fields?: APIEmbedField[];
    }

    export interface PresetedEmbeds {
        baseProperties: BaseEmbedProperties;
        reportEmbed: Embed;
        listEmbed: Embed;
        warn: {
            missingPermission: Embed;
        };
        moveContent: {
            confirmAction: Embed;
            canceledAction: Embed;
            generalBaseInformation: Embed;
        };
        presetDialog: {
            err: {
                presetAlreadyExists: Embed;
            };
            actionDialog: Embed;
            successDialog: Embed;
            presetNameDialog: Embed;
            optionsDialog: Embed;
            channelsDialog: Embed;
        };
    }

    export type MessageCollection = Collection<string, Message>;

    export type ReportReason = {
        reason: string;
        attURL?: string;
    };

    export type BaseEmbedParams = {
        date: Date;
        authorUsername: string;
        authorURL: string;
        color: ColorResolvable;
    };

    export type SendParams = {
        newEmbed: APIEmbed;
        chat: TextChannel;
        video?: {
            url: string;
        };
    };
    export type UpdateDescLineOptions = {
        line: number;
        content: string;
    };
    export type MountingOptions = {
        withBase: boolean;
    };

    export type UtilsFunctions = {
        /**
         * Search the embed object on the file and
         * return it with the interpreted data.
         * @param params
         */
        generateEmbed: (
            embedData: UnknownObj,
            withBase?: boolean
        ) => Promise<Ok<APIEmbed>>;
        /**
         * Mount the embed object.
         * @param embed
         */
        mountEmbed: (embed: APIEmbed) => Result<void>;
    };
}
//#endregion
//#region           Variables
import defaultEmbeds from "$/messages/embed.json";
const unmountedEmbedErr: DefaultErr = {
    message:
        "Você não montou o embed antes! " +
        "Como acha que irá atualizar algo que não existe?",
    origin: ErrorOrigin.Internal,
    kind: ErrorKind.MissingVariable,
};
const noDescriptionErr: DefaultErr = {
    message: "Descrição não encontrada!",
    origin: ErrorOrigin.Internal,
    kind: ErrorKind.NotFound,
};
//#endregion
//#region           Implementation
export class EmbedMessagesHandler {
    /**
     * Path to the object on the embeds file.
     */
    readonly name: string;

    /**
     * Object of the embeds file.
     */
    embeds: types.PresetedEmbeds;
    /**
     * Current embed being used.
     */
    currentEmbed: APIEmbed;
    /**
     * The EmbedBuilder.
     */
    embed: EmbedBuilder;

    constructor(name: string) {
        this.name = name;

        this.embeds = defaultEmbeds;
        this.currentEmbed = {};
        this.embed = new EmbedBuilder();
    }

    //#region           Built-in Utilities
    protected Utils(): types.UtilsFunctions {
        const factory: FactoryObj<types.UtilsFunctions> = {
            generateEmbed: async (embedData, withBase) => {
                const getJSON = read.accessPathInObj(this.name, this.embeds);

                var json;
                if (!withBase) {
                    json = getJSON.val;
                } else {
                    const getBaseJSON = read.accessPathInObj(
                        "baseProperties",
                        this.embeds
                    );

                    if (
                        typeof getJSON.val === "object" &&
                        typeof getBaseJSON.val === "object"
                    ) {
                        json = {
                            ...getJSON.val,
                            ...getBaseJSON.val,
                        };
                    } else {
                        throw new BotErr({
                            message: "The embed is not an object!",
                            origin: ErrorOrigin.Internal,
                            kind: ErrorKind.TypeError,
                        });
                    }
                }

                const baseEmbed = JSON.stringify(json);
                const embedString = string.varInterpreter(baseEmbed, embedData);
                const mountedEmbed = JSON.parse(embedString.val);

                this.currentEmbed = mountedEmbed;

                return Ok(mountedEmbed);
            },
            mountEmbed: (embed) => {
                if (embed.url) this.embed.setURL(embed.url);
                if (embed.color) this.embed.setColor(embed.color);
                if (embed.title) this.embed.setTitle(embed.title);
                if (embed.author) this.embed.setAuthor(embed.author);
                if (embed.footer) this.embed.setFooter(embed.footer);
                if (embed.image) this.embed.setImage(embed.image.url);
                if (embed.timestamp)
                    this.embed.setTimestamp(new Date(embed.timestamp));
                if (embed.fields) this.embed.setFields(...embed.fields);
                if (embed.thumbnail) this.embed.setThumbnail(embed.thumbnail.url);
                if (embed.description) this.embed.setDescription(embed.description);

                return Ok.EMPTY;
            },
        };
        return factory;
    }
    //#endregion
    //#region           Embed Initialization
    /**
     * Mount a new embed with the data provided.
     * @param embedData
     * @param options.withBase If true, the base properties will be used.
     * @returns
     */
    public async Mount(
        embedData: UnknownObj,
        options?: types.MountingOptions
    ): Promise<Result<EmbedBuilder>> {
        if (options && options.withBase) {
            var generatedEmbed = await this.Utils().generateEmbed(
                embedData,
                options.withBase
            );
        } else {
            var generatedEmbed = await this.Utils().generateEmbed(embedData);
        }

        this.Utils().mountEmbed(
            generatedEmbed.val
        ).unwrap();

        return Ok(this.embed);
    }
    //#endregion
    //#region           Data Manipulation
    /**
     * Update the entire embed data.
     * @param embedData
     */
    public async Update(embedData: APIEmbed): Promise<Ok<EmbedBuilder>> {
        if (!this.embed || !this.currentEmbed)
            throw new BotErr(unmountedEmbedErr);

        this.currentEmbed = embedData;

        this.Utils().mountEmbed(
            this.currentEmbed
        ).unwrap();

        return Ok(this.embed);
    }
    /**
     * Update a specific line of the description.
     * @param options.content The new content of the line.
     * @param options.line The line to be updated (starting at 0).
     * @example
     * // old description:
     * // "Hi!"
     * // "My name is Miyritsu and I..."
     * // "Like my dev!"
     * await new EmbedHandler("miyritsu.presentation").Data().UpdateDescLine({
     *     line: 2,
     *     content: "am a bot!",
     * });
     * // new description:
     * // "Hi!"
     * // "My name is Miyritsu and I..."
     * // "am a bot!"
     */
    public async UpdateDescLine(
        options: types.UpdateDescLineOptions
    ): Promise<Ok<EmbedBuilder>> {
        // Verify essential values
        if (!this.currentEmbed || !this.embed)
            throw new BotErr(unmountedEmbedErr);

        if (!this.currentEmbed.description) throw new BotErr(noDescriptionErr);

        // Edit lines
        const descLines = this.currentEmbed.description.split("\n");
        descLines[options.line] = options.content;
        this.currentEmbed.description = descLines.join("\n");

        // Update embed objects
        await this.Update(this.currentEmbed);

        return Ok(this.embed);
    }
    //#endregion
}
//#endregion

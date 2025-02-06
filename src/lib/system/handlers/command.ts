/** @format */

//#region           External Libs
import fsp from "fs/promises";
import path from "path";
import { Ok } from "ts-results";
import {
    ChatInputCommandInteraction,
    Collection,
    REST,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
} from "discord.js";
//#endregion
//#region           Modules
import { Log } from "@/system/handlers/log";
import { BotErr, ErrorOrigin, ErrorKind, Result } from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
import { types as mainTypes } from "../factories/general.f";
export namespace types {
    export type CommandsSlashDataJSON =
        RESTPostAPIChatInputApplicationCommandsJSONBody;

    export type CommandData<T = SlashCommandOptionsOnlyBuilder> = {
        properties: {
            guild: boolean;
        };
        slashData: T;
    };
    export type Command<T = SlashCommandBuilder> = {
        data: () => Promise<Ok<CommandData<T>>>;
        execute: (interaction: ChatInputCommandInteraction) => Promise<Result<void>>;
        autocomplete?: AnyFunction;
    };
    export type ReceivedCommand<T = SlashCommandBuilder> = {
        data?: () => Promise<Ok<CommandData<T>>>;
        execute?: AnyFunction;
        autocomplete?: AnyFunction;
    };

    export type CommsCollection = Collection<string, Command>;

    export type CommandsDataObj = {
        guild: CommandData[];
        global: CommandData[];
    };

    export type CommandsDataJSONObj = {
        guild: CommandsSlashDataJSON[];
        global: CommandsSlashDataJSON[];
    };

    export type CommsDataCollection = Collection<string, CommandsSlashDataJSON>;

    export type LoadCommandsParams = {
        client: mainTypes.MyClient;
        rest: REST;
        guild: string;
        clientId: string;
    };

    export interface UtilsFunctions {
        /**
         * This will load the data that's located
         * in the command's `data()` function and return it.
         * @param commandName Name of command to search in the collection.
         */
        getCommandData: (commandName: string) => Promise<Ok<types.CommandData>>;
        /**
         * This will save the data found in the command
         * in `this.commands_data` object and return it.
         * @param command The data returned by the `data()` command function.
         */
        saveCommandDataJSON: (
            command: types.CommandData
        ) => Ok<CommandsSlashDataJSON>;
        /**
         * Put the command in the `this.commands_collection`
         * and report it in the logs.
         * @param commandData The data returned by the `data()` command function.
         * @param command The imported command.
         */
        putCommandInCollection: (command: Command) => Promise<Ok<void>>;
    }
}
//#endregion
//#region           Variables
import { client } from "//index";
//#endregion
//#region           Implementation
/**
 * Handler of commands.
 * @since v0.1.0
 */
export class CommandHandler {
    commands_collection: types.CommsCollection;
    commands_data: types.CommandsDataJSONObj;

    private _rest: REST;
    private _clientId: string;
    private _guildId: string;

    private readonly _commands_path: string;

    constructor(rest: REST, clientId: string, guildId: string) {
        this._commands_path = path.join(__dirname, "../../../commands");

        this.commands_data = {
            guild: [],
            global: [],
        };
        this.commands_collection = new Collection();
        this._rest = rest;
        this._clientId = clientId;
        this._guildId = guildId;
    }

    //#region           Built-in Utilities
    protected Utils(): FactoryObj<types.UtilsFunctions> {
        const factory: FactoryObj<types.UtilsFunctions> = {
            getCommandData: async (commandName) => {
                const getCommand = this.commands_collection.get(commandName);
                var command;

                if (getCommand) {
                    const getCommandData = await getCommand.data();

                    command = getCommandData.val;
                } else {
                    throw new BotErr({
                        message:
                            "Something is wrong! The command is not found!",
                        origin: ErrorOrigin.Internal,
                        kind: ErrorKind.NotFound,
                    });
                }

                return Ok(command);
            },
            saveCommandDataJSON: (command) => {
                const commandData = command.slashData.toJSON();
                var isGuild = command.properties.guild;

                if (isGuild) this.commands_data.guild.push(commandData);
                else if (!isGuild) this.commands_data.global.push(commandData);
                else
                    throw new BotErr({
                        message:
                            "The requested command doesn't have" +
                            "the property declarations!",
                        origin: ErrorOrigin.Internal,
                        kind: ErrorKind.NotFound,
                    });

                return Ok(commandData);
            },
            putCommandInCollection: async (command) => {
                const commandData = (await command.data()).val;
                const commandName = commandData.slashData.name;
                const subcommands = commandData.slashData.options;

                this.commands_collection.set(commandName, command);

                if (subcommands.length > 0) {
                    const subcommandsNames: string[] = [];

                    subcommands.forEach((subcommand) => {
                        subcommandsNames.push(subcommand.toJSON().name);
                    });

                    new Log("success.definedCommandWithSubCommands").Print({
                        commandName: commandName,
                        subcommands: subcommandsNames,
                    });
                } else {
                    new Log("success.definedCommand").Print({
                        commandName: commandName,
                    });
                }

                return Ok.EMPTY;
            },
        };

        return factory;
    }
    //#endregion
    //#region           Public Methods
    /**
     * Load all the commands.
     *
     * This will save the collection in `this.commands_collection`
     * and return `Ok<void>`. That object is public, so you can use it.
     */
    public async LoadCommands(): Promise<Ok<void>> {
        const utils = this.Utils();

        const regex = /^(?!.*\.map).*\.js$/;
        const getFiles = await fsp.readdir(this._commands_path, {
            recursive: true,
        });
        const files = getFiles.filter((filePath) => regex.test(filePath));

        for (const file of files) {
            const commandName = file.replace(/^.*\//, "").replace(/\.js$/, "");
            const currentFile = path.join(this._commands_path, file);

            const command: types.Command = await import(currentFile);

            await utils.putCommandInCollection(command);

            const commandData = (await utils.getCommandData(commandName)).val;

            utils.saveCommandDataJSON(commandData);
        }

        return Ok.EMPTY;
    }
    /**
     * Deploy commands to Discord.
     *
     * You need to run `ListCommands()` first. After all, it is
     * impossible to deploy commands that are not known!
     */
    public async Deploy(): Promise<Ok<void>> {
        if (!(this.commands_collection.size > 0)) {
            throw new BotErr({
                message: "Are you trying to deploy... Any command? What?",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.EmptyValue,
            });
        }

        // Print Commands log
        {
            const allCommands = [
                ...this.commands_data.global,
                ...this.commands_data.guild,
            ];
            new Log("loading.refreshCommands").Print({
                commandsLength: allCommands.length,
            });
        }

        // Deploy
        {
            await this._rest.put(Routes.applicationCommands(this._clientId), {
                body: this.commands_data.global,
            });

            const guild = await client.guilds.fetch(this._guildId);

            if (guild) {
                if (this.commands_data.guild.length > 0) {
                    await this._rest.put(
                        Routes.applicationGuildCommands(
                            this._clientId,
                            this._guildId
                        ),
                        { body: this.commands_data.guild }
                    );

                    new Log("success.refreshGuildCommands").Print({
                        count: this.commands_data.guild.length,
                        name: guild.name,
                    });
                }
            }

            new Log("success.refreshGlobalCommands").Print({
                count: this.commands_data.global.length,
            });
        }

        return Ok.EMPTY;
    }
    //#endregion
}
//#endregion

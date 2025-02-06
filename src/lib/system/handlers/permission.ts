/** @format */

//#region           External Libs
import { Ok } from "ts-results";
import { Snowflake } from "discord.js";
//#endregion
//#region           Modules
import { Log } from "@/system/handlers/log";
import {
    Result,
    BotErr,
    ErrorOrigin,
    ErrorKind,
} from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
export namespace types {
    export interface CommandPermissions {
        roles: {
            /**
             * If it's public, everyone can use it.
             * If it's private, only administrators can use it.
             */
            allowed: "public" | "private" | Snowflake[];
            /**
             * Bitfield of who can use it.
             */
            minViewer: "public" | "private" | Snowflake;
        };
    }
    export interface GuildObject {
        /**
         * Name of the guild.
         */
        name: string;
        /**
         * Permissions separated by commands.
         */
        commands: { [commandName: string]: CommandPermissions };
    }

    export interface SettingsFile {
        [guild: Snowflake]: GuildObject;
    }
}
//#endregion
//#region           Variables
import { client, guild, prisma } from "//index";
//#endregion
//#region           Implementation
export class PermissionsHandler {
    //#region           Getters
    /**
     * Check the visibility bitfield based on the roles.
     * @param commandName The name of the command.
     * @returns The bigint permission bitfield.
     */
    public static async MinViewers(
        commandName: string,
        guildId: Snowflake
    ): Promise<Result<bigint>> {
        const configs = await prisma.commandPermissions.findMany({
            where: {
                guildId,
            },
        });

        const commandPermissions = configs.find(
            (config) => config.commandName === commandName
        );
        if (!commandPermissions) {
            return new BotErr({
                message:
                    `The command with the name: ${commandName} was not ` +
                    "found in the config file! Problably there is a problem in " +
                    "the PermissionsHandler.EnsureCommandsPermissions() call!",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.NotFound,
            });
        }
        const minViewer = commandPermissions.minViewer;

        if (minViewer === "public") return Ok(0n);
        else if (minViewer === "private") return Ok(8n);

        const gld = await client.guilds.fetch(guild);
        const rolePermissions = await gld.roles.fetch(minViewer);

        if (!rolePermissions)
            return new BotErr({
                message: `The role with the id: ${minViewer} was not found!`,
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.NotFound,
            });

        const bitFieldPerms = rolePermissions.permissions.bitfield;

        return Ok(bitFieldPerms);
    }
    /**
     * Check which roles are allowed to use the command.
     * @param commandName The name of the command.
     * @returns
     * Return a `string` if a specific role was found.
     * Return a `boolean` if the command is
     * public (true) or private (false).
     */
    public static async AllowedRoles(
        commandName: string,
        guildId: Snowflake
    ): Promise<Result<string[] | boolean>> {
        const configs = await prisma.commandPermissions.findMany({
            where: {
                guildId,
            },
        });

        const commandPermissions = configs.find(
            (config) => config.commandName === commandName
        );
        if (!commandPermissions) {
            return new BotErr({
                message:
                    `The command with the name: ${commandName} was not ` +
                    "found in the config file! Problably there is a problem in " +
                    "the PermissionsHandler.EnsureCommandsPermissions() call!",
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.NotFound,
            });
        }
        const allowed = commandPermissions.allowed;

        const gld = await client.guilds.fetch(guild);
        if (!gld)
            return new BotErr({
                message: `The guild with the id: ${guild} was not found!`,
                origin: ErrorOrigin.Internal,
                kind: ErrorKind.NotFound,
            });

        if (allowed[0] === "public") return Ok(true);
        else if (allowed[0] === "private") return Ok(false);
        else {
            var roles = [];
            for (let i = 0; i < allowed.length; i++) {
                const roleObj = await gld.roles.fetch(allowed[i]);

                if (roleObj !== null) {
                    roles.push(allowed[i]);
                } else {
                    const message = `The role with the id: ${allowed[i]} was not found!`;

                    Log.PrintErr(
                        new BotErr({
                            message,
                            origin: ErrorOrigin.Internal,
                            kind: ErrorKind.NotFound,
                        })
                    );
                }
            }

            return new Ok(roles);
        }
    }
    //#endregion
    //#region           Setters
    /**
     * This will ensure that the permissions file has all the
     * commands, if not, it will add them with a empty
     * configuration. (allowed: private, minViewer: private)
     */
    public static async EnsureCommandsPermissions(
        guildId: Snowflake
    ): Promise<Result<void>> {
        const configs = await prisma.commandPermissions.findMany({
            where: {
                guildId,
            },
        });

        for (const [key] of client.commands) {
            const hasCommand = configs.some(
                (config) => config.commandName === key
            );

            if (!hasCommand) {
                await prisma.commandPermissions.create({
                    data: {
                        commandName: key,
                        allowed: ["private"],
                        minViewer: "private",
                        guildId,
                    },
                });
            }
        }

        return Ok.EMPTY;
    }
    //#endregion
}
//#endregion

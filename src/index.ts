/** @format */
//#region           External Lib
import * as dotenv from "dotenv";
import { Ok } from "ts-results";
import { REST } from "discord.js";
import { PrismaClient } from "@prisma/client";
//#endregion
//#region           Modules
import general from "@/system/factories/general.f";
import { Log } from "@/system/handlers/log";
import { CommandHandler } from "@/system/handlers/command";
import { PermissionsHandler } from "@/system/handlers/permission";
import { InteractionHandler } from "@/system/handlers/interaction";
//#endregion
//#region           Typing
import { ListenerHandler } from "@/system/handlers/listener";
//#endregion
//#region           Variables
dotenv.config();

import pkg from "../package.json";
import { PresetHandler } from "./lib/system/handlers/presetHandler";

const token = process.env.TOKEN || process.exit(1);
const clientId = process.env.CLIENT_ID || process.exit(1);
export const guild = process.env.GUILD_ID || process.exit(1);
export const DEVELOPER_ID = process.env.DEVELOPER_ID || process.exit(1);
export const LOCALE = process.env.LOCALE || "en-US";

export const client = general.createClient({
    token,
    version: pkg.version,
}).val;
export const prisma = new PrismaClient();

//#endregion
//#region           Implementation
const main = async (): Promise<Ok<void>> => {
    const rest: REST = new REST({ version: "10" }).setToken(token);

    // Load and Deploy Commands
    {
        const commandHandler = new CommandHandler(rest, clientId, guild);

        await commandHandler.LoadCommands();

        client.commands = commandHandler.commands_collection;

        await commandHandler.Deploy();
    }

    // Ensure the databases and their files
    {
        (await PermissionsHandler.EnsureCommandsPermissions(guild)).unwrap();
    }
    // Initializate listeners and other essential stuff
    {
        InteractionHandler.LaunchListener();
        ListenerHandler.PredefinedListeners();
        await PresetHandler.InitializateAll();
    }

    new Log("success.endOfMain").Print();
    return Ok.EMPTY;
};

process.on("unhandledRejection", (err) => {
    Log.PrintErr(err);
});

main().catch((err) => Log.PrintErr(err));

delete process.env.TOKEN;
delete process.env.CLIENT_ID;
//#endregion

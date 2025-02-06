/** @format */
// * External Libs
import fs from "fs/promises";
import { Ok } from "ts-results";
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    GuildEmoji,
    Interaction,
    Message,
} from "discord.js";

// * Modules
import { PermissionsHandler } from "@/system/handlers/permission";

export namespace types {
    export interface VerifyFunctions {
        /**
         * Verify if an custom emoji exists.
         *
         * This will make a request with the emoji
         * and return if it exists or not.
         * @param interaction Interaction (required to get the client object).
         * @param emoji Emoji to be verified.
         */
        customEmojiExists: (
            interaction: Interaction,
            emoji: string
        ) => Ok<boolean>;
        /**
         * Verify if a message has a certain length.
         *
         * *If the message has more than 200 characters,
         * it will use the repeatFn, if not, it will return the message.*
         * @param collection The message collection.
         * @param repeatFn Function to request a new message.
         * Will create a loop! You can leave it empty if you
         * don't want to repeat the process.
         * @example
         * const message = "Pretend this message is long";
         *
         * const repeatFn = async (): Promise<Message> => {
         *     // Request new message
         * }
         *
         * const result = await verify.messageLenght(
         *     await mountMessage(message),
         *     repeatFn
         * );
         */
        messageLenght: (
            collection: Message,
            repeatFn?: () => Promise<Message>
        ) => Promise<Ok<Message>>;
        /**
         * Use `PermissionsHandler` to check whether the
         * user has the necessary permissions to use the command.
         * @param interaction The interaction.
         */
        permissions: (
            interaction: ChatInputCommandInteraction | AutocompleteInteraction
        ) => Promise<Ok<boolean>>;
        /**
         * Check if a directory exists.
         *
         * This use `fs.access`, it's just a wrapper
         * to create a boolean case, instead the
         * original "access or error".
         * @param dir Directory to be checked.
         */
        exists: (dir: string) => Promise<Ok<boolean>>;
        /**
         * Verify if a file can be parsed to JSON
         * without the necessity of using try/catch.
         * @param path Path to the file.
         */
        isJSON: (parh: string) => Promise<Ok<boolean>>;
    }
}

// * Implementation
const Default: Factory<types.VerifyFunctions> = () => {
    const factory: FactoryObj<types.VerifyFunctions> = {
        customEmojiExists: (interaction, emoji) => {
            const emojiFind = (searchEmoji: GuildEmoji): unknown =>
                searchEmoji.name === emoji;
            const searchEmoji = interaction.client.emojis.cache.find(emojiFind);

            if (searchEmoji) return Ok(true);
            else return Ok(false);
        },
        messageLenght: async function (message, repeatFn?) {
            if (message.content.length > 200) {
                if (repeatFn) {
                    message = await repeatFn();

                    return await this.messageLenght(message, repeatFn);
                }
            }

            return Ok(message);
        },
        permissions: async (interaction) => {

            const allowedIds = await PermissionsHandler.AllowedRoles(
                interaction.commandName,
                interaction.guild?.id || "" //!DEV
            );

            if (typeof allowedIds.val === "boolean")
                return Ok(allowedIds.val);

            for (const id of allowedIds) {
                if (interaction.member) {
                    const roles = interaction.member.roles;

                    // Verificação de tipo
                    if (Array.isArray(roles)) {
                        if (roles.includes(id)) return Ok(true);
                    } else {
                        if (roles.cache.has(id)) return Ok(true);
                    }
                }
            }

            return Ok(false);
        },
        exists: async (dir) => {
            try {
                await fs.access(dir);

                return Ok(true);
            } catch (err) {
                return Ok(false);
            }
        },
        isJSON: async (path) => {
            try {
                var file = await fs.readFile(path, "utf-8");

                JSON.parse(file);

                return Ok(true);
            } catch (err) {
                // TODO: Verification if it's an access or parse error.
                return Ok(false);
            }
        },
    };
    return factory;
};
export default Default();

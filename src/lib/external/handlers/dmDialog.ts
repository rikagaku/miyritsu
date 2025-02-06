/** @format */
//#region           External Modules
import { promisify } from "util";
import { Ok } from "ts-results";
import {
    User,
    DiscordAPIError,
    MessageReaction,
    MessageCollectorOptions,
    AwaitReactionsOptions,
    Message,
    MessagePayload,
    Collection,
    PartialGroupDMChannel,
} from "discord.js";
//#endregion
//#region           Modules
import { BotErr, ErrorKind, ErrorOrigin } from "@/system/handlers/errHandlers";
//#endregion
//#region           Types
export namespace types {
    export type UtilsFunctions = {
        verifyIfDMIsOpened: (
            message: string | MessagePayload
        ) => Promise<Ok<Message>>;
    };

    export type DMResponse =
        | Collection<string, Message<boolean>>
        | "canceled"
        | "dmclosed"
        | "timeisover";
}
//#endregion
//#region           Variables
const dmClosedWarn = "O usuário não tem a DM aberta.";
//#endregion
//#region           Implementation
export class DMDialog {
    private readonly cancelEmoji: string;

    user: User;
    wasClosed: boolean;
    context: MessageReaction; //! TEMP

    constructor(user: User, context: MessageReaction) {
        this.cancelEmoji = "⛔";

        this.user = user;
        this.context = context;
        this.wasClosed = false;
    }

    private Utils(): types.UtilsFunctions {
        const factory: FactoryObj<types.UtilsFunctions> = {
            verifyIfDMIsOpened: async (message) => {
                try {
                    var messageSent = await this.user.send(message);
                } catch (err) {
                    if (err instanceof DiscordAPIError) {
                        if (this.context.message.channel instanceof PartialGroupDMChannel) {
                            throw new BotErr({
                                message:
                                    "You can't use it with a channel of GroupDMChannel class!",
                                origin: ErrorOrigin.User,
                                kind: ErrorKind.TypeError,
                            });
                        }

                        const dmWarn = await this.context.message.channel.send({
                            content: `Ei! Você precisa ter a DM aberta.\n\n||${this.user}||`,
                        });

                        const timeOut = promisify(setTimeout);

                        await timeOut(3000);

                        dmWarn.delete();

                        throw new BotErr({
                            message: dmClosedWarn,
                            origin: ErrorOrigin.User,
                            kind: ErrorKind.BlockedAction,
                        });
                    } else {
                        throw new BotErr({
                            message:
                                "Ocorreu um problema ao enviar a mensagem!",
                            origin: ErrorOrigin.Unknown,
                            kind: ErrorKind.Other,
                            errObj: err,
                        });
                    }
                }

                return Ok(messageSent);
            },
        };

        return factory;
    }

    public async SingleAnswer(
        message: string,
        timeout?: number
    ): Promise<Ok<types.DMResponse>> {
        // Check and create the initial message
        try {
            var messageSent: Message = (
                await this.Utils().verifyIfDMIsOpened(message)
            ).val;

            // Add reaction
            await messageSent.react(this.cancelEmoji);
        } catch (err) {
            if (err instanceof BotErr && err.val.message === dmClosedWarn) {
                return new Ok("dmclosed");
            }

            throw err;
        }

        const cancelOptions: AwaitReactionsOptions = {
            max: 1,
            filter: (reaction, user) =>
                !user.bot && reaction.emoji.name === this.cancelEmoji,
        };
        const messageOptions: MessageCollectorOptions = {
            filter: (m) => m.author.id === this.user.id,
            max: 1,
        };

        return new Promise((resolve) => {
            const finish = (result: types.DMResponse): void => {
                this.wasClosed = true;
                resolve(Ok(result));
                return void 0;
            };

            // Listen to cancel option
            messageSent.awaitReactions(cancelOptions).then(async () => {
                finish("canceled");

                return void 0;
            });

            {
                if (messageSent.channel instanceof PartialGroupDMChannel) {
                    throw new BotErr({
                        message:
                            "You can't use it with a channel of GroupDMChannel class!",
                        origin: ErrorOrigin.User,
                        kind: ErrorKind.TypeError,
                    });
                }

                // Listen to response
                messageSent.channel
                    .awaitMessages(messageOptions)
                    .then(async (response) => {
                        finish(response);
                    });
            }

            // Finish it if time is over
            if (timeout)
                setTimeout(() => {
                    finish("timeisover");
                }, timeout);
        });
    }
}
//#endregion

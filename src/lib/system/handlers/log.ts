/** @format */
//#region           External Libs
import fs from "fs/promises";
import path from "path";
import moment from "moment";
import { Ok } from "ts-results";
//#endregion
//#region           Modules
import read from "@/system/factories/fs/read.f";
import string from "@/system/factories/string.f";
import { BotErr, ErrorOrigin, ErrorKind } from "@/system/handlers/errHandlers";
//#endregion
//#region           Typing
export namespace types {
    export interface UtilsFunctions {
        /**
         * Print something in the general log file.
         * @param message The message to be printed.
         */
        printInGeneralLog: (message: string | UnknownObj) => Promise<Ok<void>>;
    }
}
//#endregion
//#region           Variables
import logs from "$/logs.json";

const defaultEmergencyMessages = {
    valueError:
        "Este valor não existe! Procure direito " +
        "antes de me fazer rodar coisas erradas! >:(",
    nestedValueWarn:
        "Parabéns! Você descobriu um valor aninhado, " +
        "aqui estão os valores dentro dele:",
};
const DELogs = defaultEmergencyMessages; // Alias
const baseDir = path.join(__dirname, "../../../../../logs");
//#endregion
//#region           Implementation
/**
 * Log utilities.
 * @since v0.2.0
 */
export class Log {
    readonly path: string;
    readonly time: string;

    private readonly _write_in_log: boolean;
    private readonly _obj;
    private readonly _general_log_path: string;

    constructor(path: string) {
        this.path = path;
        this.time = process.env.REMOVE_LOG_TIMESTAMP
            ? `(${moment().format("HH:mm:ss - MM/DD/YY")}): `
            : "";
        this._write_in_log =
            process.env.DEV_MODE !== "true" ||
            process.env.NO_NORMAL_LOGS === "true";
        this._obj = logs;
        this._general_log_path = `${baseDir}/general.out`;
    }
    //#region           Utils
    protected Utils(): FactoryObj<types.UtilsFunctions> {
        const factory: FactoryObj<types.UtilsFunctions> = {
            printInGeneralLog: async (
                message: string | UnknownObj
            ): Promise<Ok<void>> => {
                var messageToPrint = message + "\n";

                if (typeof messageToPrint !== "string") {
                    messageToPrint = JSON.stringify(messageToPrint);
                }

                await fs.appendFile(this._general_log_path, messageToPrint);

                return Ok.EMPTY;
            },
        };
        return factory;
    }
    //#endregion
    //#region           Public Methods
    /**
     * Print an error with elegancy.
     * @param error The error to be printed.
     * @param message The message to specify if the erro is unknown.
     * @example
     * // [...]
     * // If a BotErr() or Error():
     * Log.PrintErr(err);
     * // If it's unknown:
     * Log.PrintErr(err, "Something went wrong!");
     *
     */
    public static PrintErr(
        error: Error | BotErr | unknown,
        message?: string
    ): Ok<void> {
        const noPrint = process.env.NO_CONSOLE_LOG === "true";

        if (noPrint) return Ok.EMPTY;
        // TODO: LogErr archive writing

        var errMsg = "";
        var separatedContent = null;
        var printSeparated = false;

        if (error instanceof Error) {
            const stack = error.stack;

            errMsg = `${error.message}\n${stack}`;
        } else if (error instanceof BotErr) {
            const stack =
                error.val.origin === ErrorOrigin.Unknown
                    ? error.val.errObj
                    : error.stack;

            errMsg = error.val.message;

            printSeparated = true;
            separatedContent = stack;
        } else {
            const stack = new Error().stack;

            const defaultErrMessage = "No message specified for this error!";
            const finalErrMessage = message ? message : defaultErrMessage;

            errMsg = `${finalErrMessage}\n${stack}`;
        }

        console.log("\x1b[31m%s\x1b[0m", errMsg);
        if (printSeparated) console.log(separatedContent);

        return Ok.EMPTY;
    }
    /**
     * Print a message with elegancy (and abstraction).
     *
     * With this, you can print a beautiful log without
     * giant strings in your code. Put the message in the
     * log file and find and specify the path. Then, you
     * can use it to print any message you want.
     * @param data
     * If the message require data, you can specify it here.
     * @example
     * // log file: {
     * //     "example": {
     * //         "of": {
     * //             "message": "This is a message, print ${something} here!"
     * //         }
     * //     }
     * // }
     * const something = "a beautiful message";
     *
     * new Log("example.of.message").Print({ something });
     * // prints: "This is a message, print a beautiful message here!"
     */
    public async Print(data?: UnknownObj): Promise<Ok<void>> {
        const noLogs = process.env.NO_LOGS === "true";

        if (noLogs) return Ok.EMPTY;

        // Get log message
        {
            const getLogMessage = read.accessPathInObj(
                this.path,
                this._obj
            ).val;

            var logMessage: string | UnknownObj;
            if (typeof getLogMessage === "string") {
                logMessage = getLogMessage;
            } else {
                throw new BotErr({
                    message: "The requested log doesn't exist!",
                    origin: ErrorOrigin.Internal,
                    kind: ErrorKind.NotFound,
                });
            }
        }

        // Log de Valores Simples ou Aninhados
        {
            // Receber valor e verificar erros.

            // Log caso seja um valor aninhado.
            {
                if (typeof logMessage === "object") {
                    const firstMessage = `${this.time}${DELogs.nestedValueWarn}\n`;
                    const secondMessage = logMessage;

                    if (this._write_in_log) {
                        await this.Utils().printInGeneralLog(firstMessage);
                        await this.Utils().printInGeneralLog(secondMessage);
                    }

                    console.log(firstMessage);
                    console.log(secondMessage);

                    return Ok.EMPTY;
                }
            }
            // Log no caso de um valor simples.
            {
                if (!data) {
                    const message = this.time + logMessage;

                    if (this._write_in_log) {
                        await this.Utils().printInGeneralLog(message);
                    }

                    console.log(message);

                    return Ok.EMPTY;
                }
            }
        }
        // Log de Valores Complexos
        {
            const complexValue = string.varInterpreter(logMessage, data);
            const message = `${this.time}${complexValue.val}`;

            if (this._write_in_log) {
                await this.Utils().printInGeneralLog(message);
            }

            console.log(message);
        }

        return Ok.EMPTY;
    }
    //#endregion
}
//#endregion

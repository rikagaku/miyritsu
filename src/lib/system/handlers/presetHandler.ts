/**
 * @format
 */

//#region               External Libs
import { Ok } from "ts-results";
import { Collection } from "discord.js";
//#endregion
//#region               Modules
import { prisma } from "//index";
import { action as autoReportAction } from "//commands/mod/autoreport";
//#endregion
//#region               Typing
export namespace types {
    export type Preset = { data: UnknownObj; name: string };
    export type Presets = Collection<string, Preset>;
    export type PresetsObject = { [key: string]: Preset };

    export type PresetInfo = { uuid: string; name: string };
    export type PresetObject = { uuid: string; object: Preset };

    export type PresetVerify =
        | {
              exists: true;
              uuid: string;
          }
        | {
              exists: false;
          };
}
//#endregion
//#region               Implementation
/**
 * Manipulador de Presets.
 */
export class PresetHandler {
    // Utilitários Externos
    public static async InitializateAll(): Promise<Ok<void>> {
        // Inicializate Autoreport
        {
            const presets = await prisma.autoReportPresetInfo.findMany();

            for (const preset of presets) {
                await autoReportAction({
                    name: preset.name,
                    chatID: preset.chatID,
                    logChatID: preset.logChatID,
                    emoji: preset.emoji,
                    emojiID: preset.emojiID ? preset.emojiID : undefined,
                    customEmoji: preset.customEmoji,
                });
            }
        }

        return Ok.EMPTY;
    }
}
//#endregion

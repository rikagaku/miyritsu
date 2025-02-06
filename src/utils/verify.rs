use regex::Regex;

use super::values::enums::EmojiFormat;

/// Verify what kind of emoji is used.
///
/// # Example
/// ```
/// let emoji = "<:emoji:123456789>".to_string();
/// let emoji_format = get_emoji_format(&emoji);
///
/// dbg!(emoji_format);
/// // EmojiFormat::Custom
/// ```
pub fn get_emoji_format(emoji: &String) -> EmojiFormat {
    let custom_test = Regex::new(r"<:(\w+):(\d+)>").unwrap().is_match(emoji);
    let unicode_test = Regex::new(
        r"[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F004}-\u{1F0CF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]"
    )
    .unwrap()
    .is_match(emoji);

    if unicode_test {
        EmojiFormat::Unicode
    } else if custom_test {
        EmojiFormat::Custom
    } else {
        EmojiFormat::Discord
    }
}

use regex::Regex;

use crate::handlers::error::{BotErr, Error, BotError, ErrorKind, ErrorOrigin};

use super::{values::structs::ExtractedEmoji, verify};

/// Extract an emoji
///
/// It will return an struct that will separate
/// the name from a possible id (if it's a custom emoji)
/// and will remove the characters that Discord uses to
/// identify an emoji (`<,:,>`)
///
/// # Example
///
/// ```
/// let emoji = "<:emoji:123456789>".to_string();
/// let extracted_emoji = custom_emoji(&emoji).unwrap();
///
/// dbg!(extracted_emoji)
/// // {
/// //     is_custom: true,
/// //     name: "emoji",
/// //     id: Some("123456789"),
/// //}
/// ```
pub fn extract_emoji(emoji: &String) -> Result<ExtractedEmoji, BotErr> {
    let re = Regex::new(r"<:(\w+):(\d+)>|:(\w+):").unwrap();

    let emoji_kind = verify::get_emoji_format(emoji);

    if let Some(captures) = re.captures(emoji) {
        dbg!(re.captures(emoji));

        if let (Some(name), Some(id)) = (captures.get(1), captures.get(2)) {
            return Ok(ExtractedEmoji {
                is_custom: true,
                kind: emoji_kind,
                name: name.as_str().to_string(),
                id: Some(id.as_str().to_string())
            });
        } else if let Some(name) = captures.get(3) {
            return Ok(ExtractedEmoji {
                is_custom: false,
                kind: emoji_kind,
                name: name.as_str().to_string(),
                id: None
            });
        }
    }

    Err(BotError::new(
        t!("syntax.emoji.is_not").to_string(),
        ErrorKind::InvalidValue,
        ErrorOrigin::User
    ))
}

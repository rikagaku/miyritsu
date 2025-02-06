#[cfg(test)]
pub mod filter {
    use crate::utils::filter::extract_emoji;
    use crate::utils::values::{enums::EmojiFormat, structs::ExtractedEmoji};

    #[test]
    pub fn extract_complex_emoji() {
        let emoji = "<:emoji:123456789>".to_string();

        let extracted_emoji = extract_emoji(&emoji).unwrap();

        assert_eq!(
            extracted_emoji,
            ExtractedEmoji {
                is_custom: true,
                kind: EmojiFormat::Custom,
                name: "emoji".to_string(),
                id: Some("123456789".to_string())
            }
        );
    }
    #[test]
    pub fn extract_simple_emoji() {
        let emoji = ":heart:".to_string();

        let extracted_emoji = extract_emoji(&emoji).unwrap();

        assert_eq!(
            extracted_emoji,
            ExtractedEmoji {
                is_custom: false,
                kind: EmojiFormat::Discord,
                name: "heart".to_string(),
                id: None
            }
        );
    }
}
#[cfg(test)]
pub mod verify {
    use crate::utils::{values::enums::EmojiFormat, verify::get_emoji_format};

    #[test]
    pub fn emoji_discord() {
        let emoji = ":heart:".to_string();

        assert_eq!(get_emoji_format(&emoji), EmojiFormat::Discord);
    }
    #[test]
    pub fn emoji_custom() {
        let emoji = "<:emoji:123456789>".to_string();

        assert_eq!(get_emoji_format(&emoji), EmojiFormat::Custom);
    }
    #[test]
    pub fn emoji_unicode() {
        let emoji = "\u{2764}\u{FE0F}".to_string();

        assert_eq!(get_emoji_format(&emoji), EmojiFormat::Unicode);
    }
}
#[cfg(test)]
pub mod parse {
    use crate::utils::parse::limit_to_milli;

    #[test]
    pub fn limit_basic_minutes_sum() {
        assert_eq!(
            limit_to_milli("1min".to_string()).unwrap(),
            60000,
            "Test simple conversion, 1min to 120000"
        );

        assert_eq!(
            limit_to_milli("1min + 1min".to_string()).unwrap(),
            120000,
            "Test simple sum, 1min + 1min to 240000"
        );
    }
    #[test]
    pub fn limit_basic_sum_and_subtract() {
        assert_eq!(
            limit_to_milli("1min - 1min".to_string()).unwrap(),
            0,
            "Test simple subtraction, 1min - 1min to 0"
        );

        assert_eq!(
            limit_to_milli("1min + 1min - 1min".to_string()).unwrap(),
            60000,
            "Test simple sum and subtraction, 1min + 1min - 1min to 60000"
        );

        assert_eq!(
            limit_to_milli("1min - 1min + 1d".to_string()).unwrap(),
            60000,
            "Test inverted sum and subtraction, 1min - 1min + 1min to 60000"
        );
    }
    #[test]
    #[should_panic(expected = "attempt to subtract with overflow")]
    pub fn limit_negative_case() {
        limit_to_milli("1min - 2min".to_string()).unwrap();
    }
}

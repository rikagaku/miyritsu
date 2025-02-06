use super::enums::EmojiFormat;

#[derive(PartialEq, Debug)]
pub struct ExtractedEmoji {
    pub is_custom: bool,
    pub kind: EmojiFormat,
    pub name: String,
    pub id: Option<String>,
}
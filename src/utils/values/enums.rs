use strum_macros::{EnumIter, Display};

#[derive(PartialEq, Debug)]
pub enum EmojiFormat {
    Unicode,
    Custom,
    Discord
}

#[derive(EnumIter, Display)]
pub enum SupportedLocales {
    #[strum(serialize = "en-US")]
    EnUs,
    #[strum(serialize = "pt-BR")]
    PtBr,
}
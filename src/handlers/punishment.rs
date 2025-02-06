use std::sync::Arc;

use chrono::DateTime;
use chrono::Utc;
use prisma_client_rust::Direction;
use prisma_client_rust::QueryError;
use serenity::all::{GuildId, UserId};
use tokio::sync::Mutex;

use crate::prisma;
use crate::prisma::user_punishment;
use crate::prisma::PrismaClient;
use crate::prisma::PunishmentType;

pub struct PunishmentHandler {
    pub guild_id: GuildId,
    pub prisma: Arc<Mutex<PrismaClient>>,
}

impl PunishmentHandler {
    /// Adds a punishment to a user.
    ///
    /// # Arguments
    ///
    /// * `user_id`: The ID of the user to punish.
    /// * `moderator_id`: The ID of the moderator who is punishing.
    /// * `punishment_type`: The type of punishment.
    /// * `reason`: The reason why the user is being punished.
    /// * `created_at`: The time when the punishment is created.
    /// * `expires_at`: The time when the punishment expires.
    ///
    /// # Errors
    ///
    /// * A `QueryError` if the query fails.
    pub async fn add(
        &self,
        user_id: UserId,
        moderator_id: UserId,
        punishment_type: PunishmentType,
        reason: String,
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<(), QueryError> {
        let prisma = self.prisma.lock().await;

        let current_case: i32;
        {
            let last_punishment = prisma
                .user_punishment()
                .find_first(vec![user_punishment::guild_id::equals(
                    self.guild_id.to_string(),
                )])
                .order_by(user_punishment::case::order(Direction::Desc))
                .exec()
                .await?;

            if let Some(last_punishment) = last_punishment {
                current_case = last_punishment.case + 1;
            } else {
                current_case = 1;
            }
        }

        prisma
            .user_punishment()
            .create(
                current_case,
                created_at.into(),
                expires_at.into(),
                reason,
                punishment_type,
                false,
                prisma::user::UniqueWhereParam::IdEquals(moderator_id.to_string()),
                prisma::user::UniqueWhereParam::IdEquals(user_id.to_string()),
                prisma::guild::UniqueWhereParam::IdEquals(self.guild_id.to_string()),
                vec![],
            )
            .exec()
            .await?;

        Ok(())
    }
}

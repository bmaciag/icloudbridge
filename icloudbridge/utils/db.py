"""Database utilities for tracking note synchronization state."""

import logging
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)


class NotesDB:
    """
    Manages SQLite database for tracking note synchronization state.

    Stores mappings between local Apple Notes (by UUID) and remote markdown files (by path).
    This allows iCloudBridge to track which notes have been synced and when.
    """

    def __init__(self, db_path: Path):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._connection: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        """
        Initialize database schema if it doesn't exist.

        Creates the note_mapping table for tracking local-to-remote associations.
        """
        # Ensure database directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS note_mapping (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    local_uuid TEXT NOT NULL,
                    local_name TEXT NOT NULL,
                    local_folder_uuid TEXT NOT NULL,
                    remote_path TEXT NOT NULL,
                    last_sync_timestamp REAL NOT NULL,
                    UNIQUE(local_uuid, remote_path)
                )
                """
            )

            # Create index for faster lookups
            await db.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_local_uuid
                ON note_mapping(local_uuid)
                """
            )

            await db.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_remote_path
                ON note_mapping(remote_path)
                """
            )

            await db.commit()
            logger.debug(f"Database initialized at {self.db_path}")

    async def get_mapping(self, local_uuid: str) -> dict | None:
        """
        Get the remote mapping for a local note UUID.

        Args:
            local_uuid: UUID of the local Apple Note

        Returns:
            Dictionary with mapping details, or None if not found
            Keys: id, local_uuid, local_name, local_folder_uuid,
                  remote_path, last_sync_timestamp
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT * FROM note_mapping
                WHERE local_uuid = ?
                """,
                (local_uuid,),
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def get_mapping_by_remote_path(self, remote_path: str) -> dict | None:
        """
        Get the local mapping for a remote note path.

        Args:
            remote_path: Path to the remote markdown file

        Returns:
            Dictionary with mapping details, or None if not found
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT * FROM note_mapping
                WHERE remote_path = ?
                """,
                (str(remote_path),),
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def upsert_mapping(
        self,
        local_uuid: str,
        local_name: str,
        local_folder_uuid: str,
        remote_path: Path,
        timestamp: float,
    ) -> None:
        """
        Create or update a note mapping.

        Args:
            local_uuid: UUID of the local Apple Note
            local_name: Name of the note
            local_folder_uuid: UUID of the folder containing the note
            remote_path: Path to the remote markdown file
            timestamp: Last sync timestamp (Unix timestamp)
        """
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO note_mapping
                (local_uuid, local_name, local_folder_uuid, remote_path, last_sync_timestamp)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(local_uuid, remote_path) DO UPDATE SET
                    local_name = excluded.local_name,
                    local_folder_uuid = excluded.local_folder_uuid,
                    last_sync_timestamp = excluded.last_sync_timestamp
                """,
                (local_uuid, local_name, local_folder_uuid, str(remote_path), timestamp),
            )
            await db.commit()
            logger.debug(f"Upserted mapping: {local_uuid} -> {remote_path}")

    async def delete_mapping(self, local_uuid: str) -> None:
        """
        Delete a note mapping.

        Args:
            local_uuid: UUID of the local Apple Note
        """
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                DELETE FROM note_mapping
                WHERE local_uuid = ?
                """,
                (local_uuid,),
            )
            await db.commit()
            logger.debug(f"Deleted mapping for: {local_uuid}")

    async def delete_mapping_by_remote_path(self, remote_path: str) -> None:
        """
        Delete a note mapping by remote path.

        Args:
            remote_path: Path to the remote markdown file
        """
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                DELETE FROM note_mapping
                WHERE remote_path = ?
                """,
                (str(remote_path),),
            )
            await db.commit()
            logger.debug(f"Deleted mapping for: {remote_path}")

    async def get_all_mappings(self) -> list[dict]:
        """
        Get all note mappings.

        Returns:
            List of dictionaries, each containing mapping details
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM note_mapping") as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def get_mappings_for_folder(self, folder_uuid: str) -> list[dict]:
        """
        Get all mappings for a specific folder.

        Args:
            folder_uuid: UUID of the folder

        Returns:
            List of dictionaries containing mapping details
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                """
                SELECT * FROM note_mapping
                WHERE local_folder_uuid = ?
                """,
                (folder_uuid,),
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def cleanup_orphaned_mappings(
        self, existing_local_uuids: set[str], existing_remote_paths: set[str]
    ) -> int:
        """
        Remove mappings for notes that no longer exist locally or remotely.

        Args:
            existing_local_uuids: Set of UUIDs that currently exist locally
            existing_remote_paths: Set of paths that currently exist remotely

        Returns:
            Number of orphaned mappings cleaned up
        """
        count = 0
        mappings = await self.get_all_mappings()

        async with aiosqlite.connect(self.db_path) as db:
            for mapping in mappings:
                local_uuid = mapping["local_uuid"]
                remote_path = mapping["remote_path"]

                # If note doesn't exist on either side, remove mapping
                if local_uuid not in existing_local_uuids and remote_path not in existing_remote_paths:
                    await db.execute(
                        "DELETE FROM note_mapping WHERE id = ?",
                        (mapping["id"],),
                    )
                    count += 1
                    logger.debug(f"Cleaned up orphaned mapping: {local_uuid} -> {remote_path}")

            await db.commit()

        if count > 0:
            logger.info(f"Cleaned up {count} orphaned note mappings")

        return count

    async def close(self) -> None:
        """Close database connection if open."""
        if self._connection:
            await self._connection.close()
            self._connection = None

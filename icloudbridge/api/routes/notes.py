"""Notes synchronization endpoints."""

import json
import logging
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep, NotesDBDep, NotesSyncEngineDep
from icloudbridge.api.models import NotesSyncRequest
from icloudbridge.utils.db import SyncLogsDB

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/folders")
async def list_folders(engine: NotesSyncEngineDep):
    """List all Apple Notes folders.

    Returns:
        List of folder names with note counts
    """
    try:
        folders = await engine.list_folders()
        return {
            "folders": [
                {
                    "name": folder["name"],
                    "uuid": folder.get("uuid", ""),
                    "note_count": folder.get("note_count", 0),
                }
                for folder in folders
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list folders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list folders: {str(e)}"
        )


@router.post("/sync")
async def sync_notes(
    request: NotesSyncRequest,
    engine: NotesSyncEngineDep,
    config: ConfigDep,
):
    """Trigger notes synchronization.

    Args:
        request: Sync configuration options

    Returns:
        Sync results with statistics
    """
    # Create sync log entry
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()

    log_id = await sync_logs_db.create_log(
        service="notes",
        sync_type="manual",
        status="running",
    )

    start_time = time.time()

    try:
        # Perform sync
        result = await engine.sync_folder(
            folder_name=request.folder,
            markdown_subfolder=None,
            dry_run=request.dry_run,
            skip_deletions=request.skip_deletions,
            deletion_threshold=request.deletion_threshold,
        )

        duration = time.time() - start_time

        # Update sync log with success
        await sync_logs_db.update_log(
            log_id=log_id,
            status="success",
            duration_seconds=duration,
            stats_json=json.dumps(result),
        )

        return {
            "status": "success",
            "duration_seconds": duration,
            "stats": result,
        }

    except Exception as e:
        duration = time.time() - start_time
        error_msg = str(e)

        logger.error(f"Notes sync failed: {error_msg}")

        # Update sync log with error
        await sync_logs_db.update_log(
            log_id=log_id,
            status="error",
            duration_seconds=duration,
            error_message=error_msg,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {error_msg}"
        )


@router.get("/status")
async def get_status(notes_db: NotesDBDep, config: ConfigDep):
    """Get notes sync status.

    Returns:
        Status information including last sync and mapping count
    """
    stats = await notes_db.get_stats()

    # Get last sync from logs
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()
    logs = await sync_logs_db.get_logs(service="notes", limit=1)

    return {
        "enabled": config.notes.enabled,
        "remote_folder": str(config.notes.remote_folder) if config.notes.remote_folder else None,
        "total_mappings": stats.get("total", 0),
        "last_sync": logs[0] if logs else None,
    }


@router.get("/history")
async def get_history(
    config: ConfigDep,
    limit: int = 10,
    offset: int = 0,
):
    """Get notes sync history.

    Args:
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of sync log entries
    """
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()

    logs = await sync_logs_db.get_logs(
        service="notes",
        limit=limit,
        offset=offset,
    )

    return {
        "logs": logs,
        "limit": limit,
        "offset": offset,
    }


@router.post("/reset")
async def reset_database(notes_db: NotesDBDep, engine: NotesSyncEngineDep):
    """Reset notes sync database.

    Clears all note mappings from the database. This will cause
    all notes to be re-synced on the next sync operation.

    Returns:
        Success message
    """
    try:
        await engine.reset_database()
        logger.info("Notes database reset successfully")

        return {
            "status": "success",
            "message": "Notes database reset successfully. All mappings cleared.",
        }
    except Exception as e:
        logger.error(f"Failed to reset notes database: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )

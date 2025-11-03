"""Reminders synchronization endpoints."""

import json
import logging
import time

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep, RemindersDBDep, RemindersSyncEngineDep
from icloudbridge.api.models import RemindersSyncRequest
from icloudbridge.utils.credentials import CredentialStore
from icloudbridge.utils.db import SyncLogsDB

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/calendars")
async def list_calendars(engine: RemindersSyncEngineDep):
    """List all Apple Reminders calendars.

    Returns:
        List of calendar names with reminder counts
    """
    try:
        # Get Apple calendars
        from icloudbridge.sources.reminders.eventkit import RemindersAdapter

        adapter = RemindersAdapter()
        await adapter.request_access()
        calendars = adapter.list_calendars()

        return {
            "calendars": [
                {
                    "title": cal["title"],
                    "calendar_identifier": cal["calendar_identifier"],
                }
                for cal in calendars
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list calendars: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list calendars: {str(e)}"
        )


@router.post("/sync")
async def sync_reminders(
    request: RemindersSyncRequest,
    engine: RemindersSyncEngineDep,
    config: ConfigDep,
):
    """Trigger reminders synchronization.

    Args:
        request: Sync configuration options

    Returns:
        Sync results with statistics
    """
    # Create sync log entry
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()

    log_id = await sync_logs_db.create_log(
        service="reminders",
        sync_type="manual",
        status="running",
    )

    start_time = time.time()

    try:
        # Perform sync based on mode
        if request.auto:
            # Auto mode - sync all calendars
            result = await engine.discover_and_sync_all(
                base_mappings=config.reminders.calendar_mappings,
                dry_run=request.dry_run,
                skip_deletions=request.skip_deletions,
                deletion_threshold=request.deletion_threshold,
            )
        else:
            # Manual mode - sync specific calendar pair
            if not request.apple_calendar or not request.caldav_calendar:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="apple_calendar and caldav_calendar required for manual mode"
                )

            result = await engine.sync_calendar(
                apple_calendar_name=request.apple_calendar,
                caldav_calendar_name=request.caldav_calendar,
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

        logger.error(f"Reminders sync failed: {error_msg}")

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
async def get_status(reminders_db: RemindersDBDep, config: ConfigDep):
    """Get reminders sync status.

    Returns:
        Status information including last sync and mapping count
    """
    stats = await reminders_db.get_stats()

    # Get last sync from logs
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()
    logs = await sync_logs_db.get_logs(service="reminders", limit=1)

    # Check if password is available
    credential_store = CredentialStore()
    has_password = credential_store.has_caldav_password(config.reminders.caldav_username or "")

    return {
        "enabled": config.reminders.enabled,
        "caldav_url": config.reminders.caldav_url,
        "caldav_username": config.reminders.caldav_username,
        "has_password": has_password,
        "sync_mode": config.reminders.sync_mode,
        "total_mappings": stats.get("total", 0),
        "last_sync": logs[0] if logs else None,
    }


@router.get("/history")
async def get_history(
    config: ConfigDep,
    limit: int = 10,
    offset: int = 0,
):
    """Get reminders sync history.

    Args:
        limit: Maximum number of logs to return
        offset: Number of logs to skip

    Returns:
        List of sync log entries
    """
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()

    logs = await sync_logs_db.get_logs(
        service="reminders",
        limit=limit,
        offset=offset,
    )

    return {
        "logs": logs,
        "limit": limit,
        "offset": offset,
    }


@router.post("/reset")
async def reset_database(engine: RemindersSyncEngineDep):
    """Reset reminders sync database.

    Clears all reminder mappings from the database. This will cause
    all reminders to be re-synced on the next sync operation.

    Returns:
        Success message
    """
    try:
        await engine.reset_database()
        logger.info("Reminders database reset successfully")

        return {
            "status": "success",
            "message": "Reminders database reset successfully. All mappings cleared.",
        }
    except Exception as e:
        logger.error(f"Failed to reset reminders database: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset database: {str(e)}"
        )


@router.post("/password")
async def set_password(username: str, password: str):
    """Store CalDAV password in system keyring.

    Args:
        username: CalDAV username
        password: CalDAV password

    Returns:
        Success message
    """
    try:
        credential_store = CredentialStore()
        credential_store.set_caldav_password(username, password)

        logger.info(f"CalDAV password stored for user: {username}")

        return {
            "status": "success",
            "message": f"Password stored securely for {username}",
        }
    except Exception as e:
        logger.error(f"Failed to store CalDAV password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store password: {str(e)}"
        )


@router.delete("/password")
async def delete_password(username: str):
    """Delete CalDAV password from system keyring.

    Args:
        username: CalDAV username

    Returns:
        Success message
    """
    try:
        credential_store = CredentialStore()
        credential_store.delete_caldav_password(username)

        logger.info(f"CalDAV password deleted for user: {username}")

        return {
            "status": "success",
            "message": f"Password deleted for {username}",
        }
    except Exception as e:
        logger.error(f"Failed to delete CalDAV password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete password: {str(e)}"
        )

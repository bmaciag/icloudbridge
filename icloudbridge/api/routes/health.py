"""Health check and status endpoints."""

import logging
import sys
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends

from icloudbridge import __version__
from icloudbridge.api.dependencies import (
    ConfigDep,
    NotesDBDep,
    PasswordsDBDep,
    RemindersDBDep,
)
from icloudbridge.api.models import HealthResponse, StatusResponse, VersionResponse
from icloudbridge.utils.db import SyncLogsDB

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint.

    Returns basic health status of the API server.
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
    )


@router.get("/version", response_model=VersionResponse)
async def get_version():
    """Get version information.

    Returns the current version of iCloudBridge and Python runtime.
    """
    return VersionResponse(
        version=__version__,
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.patch}",
    )


@router.get("/status", response_model=StatusResponse)
async def get_status(
    config: ConfigDep,
    notes_db: NotesDBDep,
    reminders_db: RemindersDBDep,
    passwords_db: PasswordsDBDep,
):
    """Get overall sync status for all services.

    Returns:
        StatusResponse with status information for each service
    """
    # Get sync logs database
    sync_logs_db = SyncLogsDB(config.general.data_dir / "sync_logs.db")
    await sync_logs_db.initialize()

    # Get last sync for each service
    notes_logs = await sync_logs_db.get_logs(service="notes", limit=1)
    reminders_logs = await sync_logs_db.get_logs(service="reminders", limit=1)
    passwords_logs = await sync_logs_db.get_logs(service="passwords", limit=1)

    # Get counts
    notes_count_result = await notes_db.get_stats()
    notes_count = notes_count_result.get("total", 0)

    reminders_count_result = await reminders_db.get_stats()
    reminders_count = reminders_count_result.get("total", 0)

    passwords_count_result = await passwords_db.get_stats()
    passwords_count = passwords_count_result.get("total", 0)

    return StatusResponse(
        notes={
            "enabled": config.notes.enabled,
            "sync_count": notes_count,
            "last_sync": notes_logs[0] if notes_logs else None,
        },
        reminders={
            "enabled": config.reminders.enabled,
            "sync_count": reminders_count,
            "last_sync": reminders_logs[0] if reminders_logs else None,
        },
        passwords={
            "enabled": config.passwords.enabled,
            "sync_count": passwords_count,
            "last_sync": passwords_logs[0] if passwords_logs else None,
        },
    )

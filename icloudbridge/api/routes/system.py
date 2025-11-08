"""System and utility endpoints."""

import logging
import platform

from fastapi import APIRouter

from icloudbridge.api.dependencies import ConfigDep

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/db-paths")
async def get_database_paths(config: ConfigDep) -> dict:
    """Get all database file locations.

    Returns:
        Dictionary with database paths for notes, reminders, and passwords,
        including existence status for each.
    """
    config.ensure_data_dir()

    notes_db = config.general.data_dir / "notes.db"
    reminders_db = config.general.data_dir / "reminders.db"
    passwords_db = config.general.data_dir / "passwords.db"

    return {
        "notes_db": str(notes_db),
        "reminders_db": str(reminders_db),
        "passwords_db": str(passwords_db),
        "metadata": {
            "notes_exists": notes_db.exists(),
            "reminders_exists": reminders_db.exists(),
            "passwords_exists": passwords_db.exists(),
        }
    }


@router.get("/info")
async def get_system_info(config: ConfigDep) -> dict:
    """Get system information and application metadata.

    Returns:
        System and application information including version,
        platform details, and configuration path.
    """
    try:
        from icloudbridge import __version__
    except ImportError:
        __version__ = "unknown"

    return {
        "version": __version__,
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "data_dir": str(config.general.data_dir),
    }

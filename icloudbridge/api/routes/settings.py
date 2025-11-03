"""Settings management endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep
from icloudbridge.api.models import SettingUpdate
from icloudbridge.utils.db import SettingsDB

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def get_all_settings(config: ConfigDep):
    """Get all settings.

    Returns:
        Dictionary of all settings
    """
    try:
        settings_db = SettingsDB(config.general.data_dir / "settings.db")
        await settings_db.initialize()

        settings = await settings_db.get_all_settings()

        return {"settings": settings}

    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get settings: {str(e)}"
        )


@router.get("/{key}")
async def get_setting(key: str, config: ConfigDep):
    """Get a specific setting.

    Args:
        key: Setting key

    Returns:
        Setting value
    """
    try:
        settings_db = SettingsDB(config.general.data_dir / "settings.db")
        await settings_db.initialize()

        value = await settings_db.get_setting(key)

        if value is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )

        return {"key": key, "value": value}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get setting: {str(e)}"
        )


@router.put("")
async def update_settings(updates: list[SettingUpdate], config: ConfigDep):
    """Update multiple settings.

    Args:
        updates: List of setting updates

    Returns:
        Success message
    """
    try:
        settings_db = SettingsDB(config.general.data_dir / "settings.db")
        await settings_db.initialize()

        for update in updates:
            await settings_db.set_setting(update.key, update.value)

        logger.info(f"Updated {len(updates)} settings")

        return {
            "status": "success",
            "message": f"Updated {len(updates)} settings",
        }

    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}"
        )


@router.put("/{key}")
async def update_setting(key: str, value: str, config: ConfigDep):
    """Update a single setting.

    Args:
        key: Setting key
        value: New setting value

    Returns:
        Updated setting
    """
    try:
        settings_db = SettingsDB(config.general.data_dir / "settings.db")
        await settings_db.initialize()

        await settings_db.set_setting(key, value)

        logger.info(f"Setting updated: {key} = {value}")

        return {"key": key, "value": value}

    except Exception as e:
        logger.error(f"Failed to update setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update setting: {str(e)}"
        )


@router.delete("/{key}")
async def delete_setting(key: str, config: ConfigDep):
    """Delete a setting.

    Args:
        key: Setting key

    Returns:
        Success message
    """
    try:
        settings_db = SettingsDB(config.general.data_dir / "settings.db")
        await settings_db.initialize()

        await settings_db.delete_setting(key)

        logger.info(f"Setting deleted: {key}")

        return {
            "status": "success",
            "message": f"Setting '{key}' deleted",
        }

    except Exception as e:
        logger.error(f"Failed to delete setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete setting: {str(e)}"
        )

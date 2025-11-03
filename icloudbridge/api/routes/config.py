"""Configuration management endpoints."""

import logging
from functools import lru_cache

from fastapi import APIRouter, HTTPException, status

from icloudbridge.api.dependencies import ConfigDep
from icloudbridge.api.models import ConfigResponse, ConfigUpdateRequest
from icloudbridge.utils.credentials import CredentialStore

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ConfigResponse)
async def get_config(config: ConfigDep):
    """Get current configuration.

    Returns the current configuration without sensitive data (passwords).
    """
    return ConfigResponse(
        notes_enabled=config.notes.enabled,
        reminders_enabled=config.reminders.enabled,
        passwords_enabled=config.passwords.enabled,
        notes_remote_folder=str(config.notes.remote_folder) if config.notes.remote_folder else None,
        reminders_caldav_url=config.reminders.caldav_url,
        reminders_caldav_username=config.reminders.caldav_username,
        passwords_vaultwarden_url=config.passwords.vaultwarden_url,
        passwords_vaultwarden_email=config.passwords.vaultwarden_email,
    )


@router.put("", response_model=ConfigResponse)
async def update_config(update: ConfigUpdateRequest, config: ConfigDep):
    """Update configuration.

    Updates the configuration and saves to disk. Passwords are stored
    in the system keyring for security.

    Args:
        update: Configuration update request

    Returns:
        Updated configuration
    """
    credential_store = CredentialStore()

    # Update general config
    if update.data_dir is not None:
        from pathlib import Path
        config.general.data_dir = Path(update.data_dir).expanduser()

    # Update notes config
    if update.notes_enabled is not None:
        config.notes.enabled = update.notes_enabled
    if update.notes_remote_folder is not None:
        from pathlib import Path
        config.notes.remote_folder = Path(update.notes_remote_folder).expanduser()

    # Update reminders config
    if update.reminders_enabled is not None:
        config.reminders.enabled = update.reminders_enabled
    if update.reminders_caldav_url is not None:
        config.reminders.caldav_url = update.reminders_caldav_url
    if update.reminders_caldav_username is not None:
        config.reminders.caldav_username = update.reminders_caldav_username
    if update.reminders_caldav_password is not None:
        # Store password in keyring
        try:
            username = update.reminders_caldav_username or config.reminders.caldav_username
            if not username:
                raise ValueError("CalDAV username is required to store password")
            credential_store.set_caldav_password(username, update.reminders_caldav_password)
            logger.info(f"CalDAV password stored in keyring for user: {username}")
        except Exception as e:
            logger.error(f"Failed to store CalDAV password in keyring: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store CalDAV password: {str(e)}"
            )

    # Update passwords config
    if update.passwords_enabled is not None:
        config.passwords.enabled = update.passwords_enabled
    if update.passwords_vaultwarden_url is not None:
        config.passwords.vaultwarden_url = update.passwords_vaultwarden_url
    if update.passwords_vaultwarden_email is not None:
        config.passwords.vaultwarden_email = update.passwords_vaultwarden_email
    if update.passwords_vaultwarden_password is not None:
        # Store password in keyring
        try:
            email = update.passwords_vaultwarden_email or config.passwords.vaultwarden_email
            if not email:
                raise ValueError("VaultWarden email is required to store password")
            credential_store.set_vaultwarden_credentials(
                email=email,
                password=update.passwords_vaultwarden_password,
            )
            logger.info(f"VaultWarden credentials stored in keyring for: {email}")
        except Exception as e:
            logger.error(f"Failed to store VaultWarden credentials in keyring: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store VaultWarden credentials: {str(e)}"
            )

    # Save config to disk
    try:
        config.save_to_file(config.default_config_path)

        # Clear the cached config so next request gets updated version
        from icloudbridge.api.dependencies import get_config
        get_config.cache_clear()

        logger.info("Configuration updated successfully")
    except Exception as e:
        logger.error(f"Failed to save configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save configuration: {str(e)}"
        )

    return ConfigResponse(
        notes_enabled=config.notes.enabled,
        reminders_enabled=config.reminders.enabled,
        passwords_enabled=config.passwords.enabled,
        notes_remote_folder=str(config.notes.remote_folder) if config.notes.remote_folder else None,
        reminders_caldav_url=config.reminders.caldav_url,
        reminders_caldav_username=config.reminders.caldav_username,
        passwords_vaultwarden_url=config.passwords.vaultwarden_url,
        passwords_vaultwarden_email=config.passwords.vaultwarden_email,
    )


@router.get("/validate")
async def validate_config(config: ConfigDep):
    """Validate current configuration.

    Checks if the configuration is valid and all required fields are set.

    Returns:
        Validation status and any errors
    """
    errors = []

    # Validate notes config
    if config.notes.enabled:
        if not config.notes.remote_folder:
            errors.append("Notes remote folder is not configured")
        elif not config.notes.remote_folder.exists():
            errors.append(f"Notes remote folder does not exist: {config.notes.remote_folder}")

    # Validate reminders config
    if config.reminders.enabled:
        if not config.reminders.caldav_url:
            errors.append("Reminders CalDAV URL is not configured")
        if not config.reminders.caldav_username:
            errors.append("Reminders CalDAV username is not configured")

        # Check if password is available
        credential_store = CredentialStore()
        if not credential_store.has_caldav_password(config.reminders.caldav_username):
            errors.append("Reminders CalDAV password is not stored in keyring")

    # Validate passwords config
    if config.passwords.enabled:
        if not config.passwords.vaultwarden_url:
            errors.append("Passwords VaultWarden URL is not configured")
        if not config.passwords.vaultwarden_email:
            errors.append("Passwords VaultWarden email is not configured")

        # Check if credentials are available
        credential_store = CredentialStore()
        if not credential_store.has_vaultwarden_credentials(config.passwords.vaultwarden_email):
            errors.append("Passwords VaultWarden credentials are not stored in keyring")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


@router.post("/test-connection")
async def test_connection(service: str, config: ConfigDep):
    """Test connection to a service.

    Tests the connection to CalDAV or VaultWarden to ensure credentials
    and configuration are correct.

    Args:
        service: Service to test (reminders, passwords)

    Returns:
        Connection test result
    """
    if service == "reminders":
        try:
            from icloudbridge.sources.reminders.caldav_adapter import CalDAVAdapter

            password = config.reminders.get_caldav_password()
            if not password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="CalDAV password not found in keyring"
                )

            adapter = CalDAVAdapter(
                config.reminders.caldav_url,
                config.reminders.caldav_username,
                password,
            )

            # Try to connect and list calendars
            calendars = await adapter.list_calendars()

            return {
                "success": True,
                "message": f"Successfully connected to CalDAV server. Found {len(calendars)} calendars.",
                "calendars": [cal["name"] for cal in calendars],
            }
        except Exception as e:
            logger.error(f"CalDAV connection test failed: {e}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
            }

    elif service == "passwords":
        try:
            from icloudbridge.sources.passwords.vaultwarden_api import VaultwardenAPIClient

            credential_store = CredentialStore()
            credentials = credential_store.get_vaultwarden_credentials(config.passwords.vaultwarden_email)

            if not credentials:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="VaultWarden credentials not found in keyring"
                )

            client = VaultwardenAPIClient(
                config.passwords.vaultwarden_url,
                credentials['email'],
                credentials['password'],
                credentials.get('client_id'),
                credentials.get('client_secret'),
            )

            # Try to authenticate
            client.authenticate()

            return {
                "success": True,
                "message": "Successfully connected to VaultWarden server.",
            }
        except Exception as e:
            logger.error(f"VaultWarden connection test failed: {e}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
            }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown service: {service}"
        )

"""Pydantic models for API request/response validation."""

from datetime import datetime

from pydantic import BaseModel, Field

from icloudbridge.core.models import SyncStatus


class SyncRequest(BaseModel):
    """Request model for synchronization operations."""

    dry_run: bool = Field(
        default=False,
        description="Preview changes without applying them",
    )
    force: bool = Field(
        default=False,
        description="Force sync even if no changes detected",
    )


class SyncResponse(BaseModel):
    """Response model for synchronization operations."""

    status: SyncStatus
    items_synced: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_deleted: int = 0
    errors: list[str] = Field(default_factory=list)
    duration_seconds: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class NoteFolderResponse(BaseModel):
    """Response model for note folder information."""

    uuid: str
    name: str
    note_count: int = 0
    last_sync: datetime | None = None
    enabled: bool = True

    class Config:
        from_attributes = True


class ReminderListResponse(BaseModel):
    """Response model for reminder list information."""

    uuid: str
    name: str
    reminder_count: int = 0
    last_sync: datetime | None = None
    enabled: bool = True

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    """Response model for sync status."""

    current_status: SyncStatus
    last_sync: datetime | None = None
    last_result: SyncResponse | None = None


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = "healthy"
    version: str
    timestamp: datetime = Field(default_factory=datetime.now)


class VersionResponse(BaseModel):
    """Response model for version information."""

    version: str
    python_version: str
    platform: str


class ConfigResponse(BaseModel):
    """Response model for configuration."""

    notes_enabled: bool
    reminders_enabled: bool
    notes_remote_folder: str | None = None
    reminders_caldav_url: str | None = None
    reminders_caldav_username: str | None = None


class ConfigUpdateRequest(BaseModel):
    """Request model for configuration updates."""

    notes_enabled: bool | None = None
    reminders_enabled: bool | None = None
    notes_remote_folder: str | None = None
    reminders_caldav_url: str | None = None
    reminders_caldav_username: str | None = None
    reminders_caldav_password: str | None = Field(
        default=None,
        description="Password will be stored in system keyring",
    )


class ErrorResponse(BaseModel):
    """Response model for errors."""

    detail: str
    error_type: str = "error"
    timestamp: datetime = Field(default_factory=datetime.now)

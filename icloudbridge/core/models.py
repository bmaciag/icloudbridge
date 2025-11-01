"""Core domain models for iCloudBridge."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path


class SyncStatus(str, Enum):
    """Synchronization status."""

    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    ERROR = "error"


class SyncDirection(str, Enum):
    """Direction of synchronization."""

    BIDIRECTIONAL = "bidirectional"
    LOCAL_TO_REMOTE = "local_to_remote"
    REMOTE_TO_LOCAL = "remote_to_local"


@dataclass
class Attachment:
    """Represents an attachment in a note."""

    filename: str
    url: str | None = None
    content: bytes | None = None
    mime_type: str | None = None

    @property
    def is_image(self) -> bool:
        """Check if attachment is an image."""
        if self.mime_type:
            return self.mime_type.startswith("image/")
        if self.filename:
            ext = Path(self.filename).suffix.lower()
            return ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
        return False


@dataclass
class Note:
    """Represents a note from Apple Notes or remote storage."""

    uuid: str
    name: str
    created_date: datetime
    modified_date: datetime
    body_html: str = ""
    body_markdown: str = ""
    attachments: list[Attachment] = field(default_factory=list)
    folder_uuid: str | None = None
    folder_name: str | None = None

    def __post_init__(self):
        """Ensure dates are datetime objects."""
        if isinstance(self.created_date, str):
            self.created_date = datetime.fromisoformat(self.created_date)
        if isinstance(self.modified_date, str):
            self.modified_date = datetime.fromisoformat(self.modified_date)


@dataclass
class NoteFolder:
    """Represents a folder containing notes."""

    uuid: str
    name: str
    note_count: int = 0
    last_sync: datetime | None = None
    enabled: bool = True


@dataclass
class Reminder:
    """Represents a reminder from Apple Reminders or CalDAV."""

    uuid: str
    name: str
    created_date: datetime
    modified_date: datetime
    completed: bool = False
    completion_date: datetime | None = None
    due_date: datetime | None = None
    all_day: bool = False
    remind_me_date: datetime | None = None
    priority: int = 0
    notes: str = ""
    list_uuid: str | None = None
    list_name: str | None = None

    def __post_init__(self):
        """Ensure dates are datetime objects."""
        if isinstance(self.created_date, str):
            self.created_date = datetime.fromisoformat(self.created_date)
        if isinstance(self.modified_date, str):
            self.modified_date = datetime.fromisoformat(self.modified_date)
        if self.completion_date and isinstance(self.completion_date, str):
            self.completion_date = datetime.fromisoformat(self.completion_date)
        if self.due_date and isinstance(self.due_date, str):
            self.due_date = datetime.fromisoformat(self.due_date)
        if self.remind_me_date and isinstance(self.remind_me_date, str):
            self.remind_me_date = datetime.fromisoformat(self.remind_me_date)


@dataclass
class ReminderList:
    """Represents a list of reminders."""

    uuid: str
    name: str
    reminder_count: int = 0
    last_sync: datetime | None = None
    enabled: bool = True


@dataclass
class SyncResult:
    """Result of a synchronization operation."""

    status: SyncStatus
    items_synced: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_deleted: int = 0
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)

    @property
    def success(self) -> bool:
        """Check if sync was successful."""
        return self.status == SyncStatus.SUCCESS and len(self.errors) == 0

    def add_error(self, error: str) -> None:
        """Add an error message to the result."""
        self.errors.append(error)
        if self.status != SyncStatus.ERROR:
            self.status = SyncStatus.ERROR

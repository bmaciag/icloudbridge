# iCloudBridge: Implementation Plan

## Overview

iCloudBridge is a simplified rewrite of TaskBridge, designed to synchronize Apple Notes and Reminders with cross-platform services (NextCloud, CalDAV, local folders). This implementation focuses on maintainability, clean architecture, and modern Python practices.

## 1. Technology Stack

### Core Technologies

**Language & Runtime:**
- **Python 3.11+** - Modern Python with better performance and type hints
- **Poetry** - Dependency management (consistent with TaskBridge)

**API Layer:**
- **FastAPI** - Modern, fast, async-capable web framework
  - Built-in OpenAPI/Swagger documentation
  - Type hints and validation via Pydantic
  - Easy to run as local service or package
  - Minimal overhead compared to Flask/Django

**Apple Integration:**
- **PyObjC (EventKit)** - Native Reminders access via EventKit framework
  - `pyobjc-framework-EventKit` - Reminders/Calendar access
  - `pyobjc-framework-Cocoa` - Foundation classes
- **AppleScript** - Notes access only (via subprocess)

**Remote Sync:**
- **caldav** - CalDAV client (same as TaskBridge)
- **aiofiles** - Async file operations for note folders
- **httpx** - Modern async HTTP client (if needed for NextCloud APIs)

**Format Conversion:**
- **markdown-it-py** - Pure Python Markdown parser (faster than markdown2)
- **markdownify** - HTML to Markdown (same as TaskBridge)

**Configuration & Storage:**
- **Pydantic Settings** - Type-safe configuration from files/env vars
- **SQLite (minimal)** - Only for tracking sync state (simplified schema)
- **Keyring** - Secure credential storage (same as TaskBridge)

**CLI:**
- **Typer** - Modern CLI framework built on type hints
  - Auto-generates help from docstrings
  - Clean, intuitive syntax
  - Built by FastAPI author

**Testing & Quality:**
- **pytest** - Testing framework
- **pytest-asyncio** - Async test support
- **ruff** - Fast Python linter (replaces flake8 + black)

### Why This Stack?

1. **FastAPI** provides clean separation between API and consumers (CLI now, GUI later)
2. **PyObjC EventKit** eliminates AppleScript parsing complexity for reminders
3. **Typer** makes CLI extremely simple (10x less code than argparse)
4. **Async support** allows concurrent operations (fetch local + remote simultaneously)
5. **Modern Python tooling** reduces boilerplate and maintenance

---

## 2. Simplified Architecture

### High-Level Structure

```
iCloudBridge/
├── icloudbridge/              # Main package
│   ├── __init__.py
│   ├── api/                   # FastAPI application
│   │   ├── __init__.py
│   │   ├── app.py            # FastAPI app instance
│   │   ├── models.py         # Pydantic request/response models
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── notes.py      # Notes sync endpoints
│   │       ├── reminders.py  # Reminders sync endpoints
│   │       └── config.py     # Configuration endpoints
│   ├── core/                  # Core business logic
│   │   ├── __init__.py
│   │   ├── config.py         # Configuration management
│   │   ├── models.py         # Domain models (Note, Reminder, etc.)
│   │   └── sync.py           # Sync orchestration logic
│   ├── sources/               # Data source adapters
│   │   ├── __init__.py
│   │   ├── notes/
│   │   │   ├── __init__.py
│   │   │   ├── applescript.py    # AppleScript notes access
│   │   │   └── markdown.py       # Markdown folder access
│   │   └── reminders/
│   │       ├── __init__.py
│   │       ├── eventkit.py       # EventKit reminders access
│   │       └── caldav_sync.py    # CalDAV access
│   ├── cli/                   # CLI application
│   │   ├── __init__.py
│   │   └── main.py           # Typer CLI
│   └── utils/                 # Shared utilities
│       ├── __init__.py
│       ├── converters.py     # HTML/Markdown conversion
│       └── db.py             # Minimal SQLite helpers
├── tests/                     # Test suite
├── docs/                      # Documentation
├── pyproject.toml
└── README.md
```

### Simplification Strategy

#### Eliminate from TaskBridge:

1. **PyQt6 GUI** - Start with CLI only, add later
2. **Complex threading** - Use async/await instead
3. **Staged file system** - EventKit provides direct access for reminders
4. **Multiple sync direction options** - Start with bidirectional only
5. **Extensive database schema** - Minimal state tracking only
6. **Configuration UI** - Config files + CLI args

#### Keep from TaskBridge:

1. **Conflict resolution** - Timestamp-based, newest wins
2. **CalDAV support** - Critical for reminders
3. **Markdown folder support** - Critical for notes
4. **Secure credential storage** - Keyring integration
5. **Association tracking** - Which local items map to which remote items

#### Key Simplifications:

| TaskBridge | iCloudBridge |
|------------|--------------|
| 3 sync modes per folder | Bidirectional only (simplify later if needed) |
| Complex SQLite schema (4 tables) | 2 simple tables (note_mapping, reminder_mapping) |
| AppleScript for everything | EventKit for reminders, AppleScript only for notes |
| Staged file parsing | Direct API access (EventKit) |
| Custom threading | Built-in async/await |
| Manual config management | Pydantic settings with validation |
| Argparse CLI | Typer (auto-generated help) |

**Estimated Complexity Reduction:** ~60-70% less code to maintain

---

## 3. API Design for Future GUI

### Core Principle: Async-First, Stateless API

The API will run as a **library** initially (imported directly by CLI), but designed to also run as a **local HTTP service** (for future GUI).

### API Endpoints (FastAPI)

```python
# Notes
POST   /api/v1/notes/sync              # Trigger notes sync
GET    /api/v1/notes/folders           # List local note folders
GET    /api/v1/notes/status            # Get sync status
GET    /api/v1/notes/preview           # Preview changes before sync

# Reminders
POST   /api/v1/reminders/sync          # Trigger reminders sync
GET    /api/v1/reminders/lists         # List local reminder lists
GET    /api/v1/reminders/status        # Get sync status
GET    /api/v1/reminders/preview       # Preview changes before sync

# Configuration
GET    /api/v1/config                  # Get current config
PUT    /api/v1/config                  # Update config
POST   /api/v1/config/validate         # Validate config without saving

# System
GET    /api/v1/health                  # Health check
GET    /api/v1/version                 # Version info
```

### Pydantic Models (Type-Safe)

```python
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class SyncStatus(str, Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    ERROR = "error"

class NoteFolder(BaseModel):
    uuid: str
    name: str
    note_count: int
    last_sync: datetime | None = None

class SyncRequest(BaseModel):
    dry_run: bool = False
    force: bool = False

class SyncResult(BaseModel):
    status: SyncStatus
    items_synced: int
    items_created: int
    items_updated: int
    items_deleted: int
    errors: list[str] = []
    duration_seconds: float
```

### CLI → API Usage Pattern

```python
# CLI calls API directly (no HTTP)
from icloudbridge.api.app import api
from icloudbridge.api.models import SyncRequest

# Direct function call (no server needed)
result = await api.sync_notes(SyncRequest(dry_run=False))
print(f"Synced {result.items_synced} notes")
```

### Future GUI → API Usage Pattern

```python
# GUI calls API via HTTP
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/api/v1/notes/sync",
        json={"dry_run": False}
    )
    result = response.json()
```

---

## 4. macOS & AppleScript Considerations

### Must Remain macOS-Only

**Reasoning:**
- **Notes:** No alternative to AppleScript (CloudKit API forbidden, no public API)
- **Reminders:** EventKit is macOS/iOS only (via PyObjC)
- **Target Users:** Mac users wanting cross-platform access to their data

### Hybrid Approach: EventKit + AppleScript

#### EventKit for Reminders (New Approach)

**Advantages over AppleScript:**

1. **Direct API access** - No string parsing required
2. **Type safety** - Native Python objects via PyObjC
3. **Better performance** - No subprocess overhead
4. **Richer metadata** - Access to all reminder properties
5. **Simpler code** - ~50% less code than AppleScript approach

**Example EventKit Code:**

```python
from EventKit import EKEventStore, EKEntityTypeReminder
from Foundation import NSDate, NSPredicate

# Request access
store = EKEventStore.alloc().init()
store.requestAccessToEntityType_completion_(
    EKEntityTypeReminder,
    lambda granted, error: None
)

# Fetch all reminders
calendars = store.calendarsForEntityType_(EKEntityTypeReminder)
predicate = store.predicateForRemindersInCalendars_(calendars)

# Get reminders
reminders = store.fetchRemindersMatchingPredicate_completion_(
    predicate,
    lambda reminders: process_reminders(reminders)
)
```

#### AppleScript for Notes (Simplified)

**Keep only essential scripts:**
- Fetch notes from folder (minimal metadata)
- Create/update note
- Delete note
- List folders

**Simplification:** Remove staged file complexity, parse directly in Python

---

## 5. Implementation Phases

### Phase 1: Core Foundation (Week 1)

**Tasks:**
1. **Project setup**
   - Initialize Poetry project
   - Add dependencies
   - Set up project structure
   - Configure ruff linting

2. **Core models**
   - Define domain models (Note, Reminder, Folder, List)
   - Pydantic models for API
   - Configuration models

3. **Basic CLI**
   - Typer setup
   - Config file loading
   - Version command
   - Health check

**Deliverables:**
- Working project structure
- Basic CLI with `--version` and `--help`
- Configuration loading from file

---

### Phase 2: Notes Implementation (Week 2)

**Tasks:**
1. **AppleScript notes adapter**
   - Simplified note fetching (no staged files)
   - Create/update/delete operations
   - Folder management

2. **Markdown folder adapter**
   - Read/write markdown files
   - Attachment handling (images only initially)
   - Directory scanning

3. **Notes sync logic**
   - Bidirectional sync algorithm
   - Conflict resolution (timestamp-based)
   - Minimal state tracking (SQLite)

4. **CLI commands**
   - `icloudbridge notes sync`
   - `icloudbridge notes list`
   - `icloudbridge notes status`

**Deliverables:**
- Full notes synchronization working
- CLI commands for notes
- Basic error handling

---

### Phase 3: Reminders Implementation (Week 3)

**Tasks:**
1. **EventKit reminders adapter**
   - EKEventStore setup and permissions
   - Fetch reminders from all lists
   - Create/update/delete reminders
   - Handle metadata (due dates, alarms, completion)

2. **CalDAV adapter**
   - Connection management
   - VTODO conversion
   - Calendar operations

3. **Reminders sync logic**
   - Bidirectional sync
   - List/calendar associations
   - State tracking

4. **CLI commands**
   - `icloudbridge reminders sync`
   - `icloudbridge reminders list`
   - `icloudbridge reminders status`

**Deliverables:**
- Full reminders synchronization working
- CLI commands for reminders
- EventKit permission handling

---

### Phase 4: API Layer (Week 4)

**Tasks:**
1. **FastAPI application**
   - Define all endpoints
   - Wire up core logic
   - Add OpenAPI documentation

2. **Run modes**
   - Library mode (direct imports)
   - Server mode (uvicorn)

3. **CLI integration**
   - CLI calls API layer
   - Proper error handling
   - Progress indicators

**Deliverables:**
- Working FastAPI server
- CLI using API layer
- OpenAPI documentation at `/docs`

---

### Phase 5: Polish & Testing (Week 5)

**Tasks:**
1. **Testing**
   - Unit tests for core logic
   - Integration tests for sync
   - Mock EventKit/AppleScript for CI

2. **Documentation**
   - README with examples
   - API documentation (auto-generated)
   - Configuration guide

3. **Packaging**
   - PyPI package setup
   - Basic distribution (PyInstaller optional)

**Deliverables:**
- Comprehensive test coverage
- Complete documentation
- Installable package

---

## 6. Database Schema (Simplified)

### Minimal State Tracking

Only 2 tables needed (vs 4 in TaskBridge):

```sql
-- Track note associations
CREATE TABLE note_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_uuid TEXT NOT NULL,
    local_name TEXT NOT NULL,
    local_folder_uuid TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    last_sync_timestamp REAL NOT NULL,
    UNIQUE(local_uuid, remote_path)
);

-- Track reminder associations
CREATE TABLE reminder_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_uuid TEXT NOT NULL,
    local_calendar_uuid TEXT NOT NULL,
    remote_uid TEXT NOT NULL,
    remote_calendar_url TEXT NOT NULL,
    last_sync_timestamp REAL NOT NULL,
    UNIQUE(local_uuid, remote_uid)
);
```

**Simplification:** No separate folder/container tables needed

---

## 7. Configuration Management

### Configuration File Format (TOML)

```toml
[general]
log_level = "INFO"
data_dir = "~/.icloudbridge"

[notes]
enabled = true
remote_folder = "~/NextCloud/Notes"

[notes.folders]
# Map local folder names to sync behavior
"Personal" = { enabled = true }
"Work" = { enabled = true }
"Archive" = { enabled = false }

[reminders]
enabled = true
caldav_url = "https://nextcloud.example.com/remote.php/dav"
caldav_username = "user@example.com"
# Password stored in system keyring, not in config file

[reminders.lists]
# Map local reminder lists to remote calendars
"Reminders" = { enabled = true, calendar = "Tasks" }
"Work" = { enabled = true, calendar = "Work Tasks" }
```

### Pydantic Settings

```python
from pydantic_settings import BaseSettings

class NotesConfig(BaseSettings):
    enabled: bool = True
    remote_folder: Path
    folders: dict[str, FolderConfig] = {}

class RemindersConfig(BaseSettings):
    enabled: bool = True
    caldav_url: str
    caldav_username: str
    lists: dict[str, ListConfig] = {}

class AppConfig(BaseSettings):
    notes: NotesConfig
    reminders: RemindersConfig

    class Config:
        env_prefix = "ICLOUDBRIDGE_"
        env_nested_delimiter = "__"
```

**Features:**
- Type validation
- Environment variable overrides
- Nested configuration
- Secure password handling (keyring)

---

## 8. Migration Strategy

### No Direct Migration Required

iCloudBridge is a **clean rewrite**, not a migration. Users can:

1. Run both tools side-by-side initially
2. Stop TaskBridge scheduled syncs
3. Configure iCloudBridge with same remote paths/servers
4. First sync will re-associate items automatically (by name/UUID)

### Configuration Mapping

TaskBridge config → iCloudBridge config requires manual conversion:

- User manually creates TOML config based on TaskBridge JSON
- Passwords need to be re-entered (both use keyring)
- Folder/list associations preserved by name matching

---

## 9. Testing Strategy

### Unit Tests

- Core models (Note, Reminder)
- Sync logic (conflict resolution)
- Converters (HTML ↔ Markdown)
- Configuration loading

### Integration Tests

- Mock EventKit responses
- Mock AppleScript execution
- Mock CalDAV server
- End-to-end sync scenarios

### CI/CD

- GitHub Actions workflow
- Run tests on macOS runner (for EventKit)
- Linting with ruff
- Coverage reporting

---

## 10. Future Enhancements

### Phase 6+ (Future)

1. **GUI Application**
   - Connect to FastAPI server
   - Configuration UI
   - Sync status monitoring
   - System tray integration

2. **Advanced Features**
   - Scheduled sync (cron-like)
   - Conflict resolution strategies (beyond timestamp)
   - Selective sync filters
   - Multiple remote destinations

3. **Performance Optimizations**
   - Incremental sync (only changed items)
   - Parallel sync operations
   - Caching layer

4. **Extended Platform Support**
   - Additional CalDAV servers
   - WebDAV for notes
   - Custom sync backends

---

## 11. Success Criteria

### Minimum Viable Product (MVP)

- ✅ Sync notes bidirectionally to markdown folder
- ✅ Sync reminders bidirectionally to CalDAV server
- ✅ Simple CLI interface
- ✅ Basic error handling
- ✅ Configuration file support

### Production Ready

- ✅ Comprehensive test coverage (>80%)
- ✅ Complete documentation
- ✅ Error recovery mechanisms
- ✅ Logging and debugging support
- ✅ PyPI package distribution

### Feature Complete

- ✅ FastAPI server mode
- ✅ GUI application
- ✅ Scheduled sync
- ✅ Advanced conflict resolution

---

## 12. Development Guidelines

### Code Style

- Use **ruff** for linting and formatting
- Type hints on all functions
- Async/await for I/O operations
- Descriptive variable names

### Documentation

- Docstrings for all public functions
- Type hints serve as inline documentation
- README with quick start guide
- API documentation auto-generated from FastAPI

### Error Handling

- Use custom exceptions for domain errors
- Log errors with context
- Graceful degradation where possible
- User-friendly error messages

### Testing

- Write tests alongside code
- Mock external dependencies
- Test error conditions
- Maintain >80% coverage

---

## 13. Dependencies Summary

### Production Dependencies

```toml
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
pydantic = "^2.5.0"
pydantic-settings = "^2.1.0"
typer = {extras = ["all"], version = "^0.9.0"}
caldav = "^1.3.0"
aiofiles = "^23.2.0"
httpx = "^0.26.0"
markdown-it-py = "^3.0.0"
markdownify = "^0.12.0"
keyring = "^24.3.0"
pyobjc-framework-EventKit = "^10.1"
pyobjc-framework-Cocoa = "^10.1"
```

### Development Dependencies

```toml
[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
pytest-asyncio = "^0.23.0"
pytest-cov = "^4.1.0"
ruff = "^0.1.0"
```

---

## Conclusion

This implementation plan provides a clear path to building iCloudBridge as a simplified, maintainable alternative to TaskBridge. The hybrid approach (EventKit + AppleScript) and modern Python stack (FastAPI + Typer + async) will result in significantly less code while maintaining full functionality.

**Estimated Timeline:** 5 weeks for MVP, 8-10 weeks for production-ready release

**Next Steps:** Begin Phase 1 (Core Foundation)

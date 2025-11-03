# Development of Web UI for iCloudBridge

The Web UI for iCloudBridge is developed using modern web technologies to provide a user-friendly interface for managing iCloud data. The following sections outline the key components and technologies used in the development process.

## Technology

- A React frontend using Talwind CSS and shadcn components. 
- A FastAPI backend to handle API requests and interact with the iCloudBridge core functionalities.
- WebSocket for real-time updates and notifications.

## Features

- No auth for now, as only local access envisaged. 
- Clear separation between functionality:
    - Notes.
    - Reminders.
    - Passwords.
    - Photos (TBD).
- Abilities
    - Every singly CLI command has a corresponding frontend control. 
    - Real-time status updates during sync operations.
    - The frontend has to be as powerful as the CLI.
    - Responsive design for accessibility on various devices.
    - User-friendly error messages and notifications.
    - Dark mode support.
- Progressive detail
    - By default, the UI should be minimalist, showing only essential information.
    - Users can expand sections to view more detailed information and options as needed, including logs for ongoing processes. 
    - The web UI will be running 24/7, so the cli needs to be able to run in a non-interactive mode, with an option to launch the web UI server.
- Scheduling
    - Users are able to set a schedule for the sync of notes/reminders/photos.
    - These will then create launchd jobs on macOS.
    - Refer to taskbridge.ui to see the old PyQt implementation - however this is just for reference, not to be reused. The UI is horrible. 

## Non-technical Features & Other Considerations

- All CLI abilities must be accessible from the web UI, including database reset.
- When the database for a particular server is empty (or reset), the UI should display a first-run wizard, helping them to set up sync for that particular item. The wizard should be dismissible for advanced users.

---

## Development Plan

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  (Tailwind CSS + shadcn/ui + WebSocket client)  │
└─────────────────┬───────────────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────────────┐
│                 FastAPI Backend                  │
│  ┌──────────────────────────────────────────┐   │
│  │   REST API Routes (auth-ready)           │   │
│  │   /api/notes, /api/reminders, /api/passwords│
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │   WebSocket Manager (real-time updates)  │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │   Scheduler Manager (APScheduler)        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Existing Sync Engines (Reused)          │
│  NotesSyncEngine, RemindersSyncEngine,          │
│  PasswordsSyncEngine                             │
└──────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Backend API Foundation (Week 1)
- FastAPI application setup with CORS and middleware
- Database extensions (sync_logs, schedules, settings tables)
- Core API routes for all services (notes, reminders, passwords)
- WebSocket manager for real-time updates
- Scheduler manager with APScheduler
- CLI server command (`icloudbridge serve`)

#### Phase 2: Frontend Foundation (Week 2)
- Project setup (Vite + React + TypeScript + Tailwind)
- API client with TypeScript types
- WebSocket integration
- shadcn/ui component installation
- Core reusable components (Layout, StatusBadge, SyncProgress, LogViewer)
- State management with Zustand

#### Phase 3: Core Feature Pages (Week 3)
- Dashboard with service overview cards
- Notes page (folders, sync, history)
- Reminders page (calendars, CalDAV config, sync)
- Passwords page (VaultWarden config, CSV upload, sync)
- Schedules page (create, edit, manage schedules)
- Settings page (log retention, theme, API settings)

#### Phase 4: Advanced Features (Week 4)
- First-run wizard (modal-based, auto-detect config)
- Real-time log viewer (WebSocket streaming)
- Sync history with detailed stats
- Enhanced configuration management
- Error handling and toast notifications
- Dark mode support

#### Phase 5: Polish & Production (Week 5)
- Responsive design (mobile-friendly)
- Performance optimization (code splitting, lazy loading)
- Testing (unit, integration, E2E)
- Documentation updates
- Build and deployment configuration
- macOS service installation (`install-service` command)

### Scheduling Decision

**Approach**: API Scheduling Manager (instead of launchd plists)

**Reasoning**:
- Cross-platform compatible
- Centralized management in SQLite
- Real-time updates via WebSocket
- Easier to implement and debug
- Single launchd plist for server auto-start

**Implementation**:
- APScheduler with SQLite job store
- Interval-based (e.g., every 4 hours) or cron-style (e.g., daily at 2am)
- Schedules managed via web UI
- Background execution with progress updates

### Key Features

1. **Real-Time Updates**: WebSocket for sync progress, logs, and status
2. **Progressive Detail**: Minimalist UI by default, expandable sections for details
3. **Feature Parity**: Every CLI command accessible from web UI
4. **First-Run Wizard**: Guided setup for new services (dismissible)
5. **Scheduling**: Create/manage sync schedules via UI
6. **Dark Mode**: Full theme support
7. **Log Management**: 7-day retention (configurable), real-time streaming
8. **Error Handling**: User-friendly error messages and notifications
9. **Responsive**: Works on desktop, tablet, and mobile

### Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | Week 1 | Backend API Foundation |
| Phase 2 | Week 2 | Frontend Foundation |
| Phase 3 | Week 3 | Core Feature Pages |
| Phase 4 | Week 4 | Advanced Features |
| Phase 5 | Week 5 | Polish & Production |
| **Total** | **5 weeks** | **Full implementation** |

### Progress Tracking

Detailed progress tracking is maintained in [WEB_DEVELOPMENT_LOG.md](WEB_DEVELOPMENT_LOG.md).

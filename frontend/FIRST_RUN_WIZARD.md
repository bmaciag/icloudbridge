# First-Run Wizard

The First-Run Wizard guides new users through the initial setup of iCloudBridge.

## Features

### 5-Step Setup Process

1. **Welcome** - Introduction to iCloudBridge features
2. **iCloud Configuration** - Enter iCloud credentials and data directory
3. **Service Selection** - Choose which services to enable (Notes, Reminders, Passwords)
4. **Connection Test** - Verify iCloud connection before proceeding
5. **Complete** - Setup confirmation and next steps

## User Experience

### When it Appears
- Automatically on first app load
- When no iCloud configuration is detected
- Can be manually triggered by clearing browser localStorage

### Cannot Be Dismissed
- Modal cannot be closed until setup is complete
- Ensures users complete initial configuration
- Prevents accessing app without proper setup

### Progress Tracking
- Visual progress bar showing step completion
- Step counter (e.g., "Step 2 of 5")
- Percentage completion indicator

## Technical Details

### First-Run Detection

The wizard detects first run by:
1. Checking if `wizardCompleted` flag is in localStorage
2. Attempting to fetch configuration from API
3. Checking if `icloud_username` exists in config
4. If any check fails or returns empty, shows wizard

```typescript
// In App.tsx
const checkFirstRun = async () => {
  const config = await apiClient.getConfig();
  if (config.icloud_username && wizardCompleted) {
    setIsFirstRun(false);
  } else {
    setIsFirstRun(true);
  }
};
```

### State Management

Wizard state is managed in Zustand store:

```typescript
// Persisted to localStorage
wizardCompleted: boolean;  // Tracks if wizard was completed
isFirstRun: boolean;        // Controls wizard visibility
```

### Form Validation

Each step has its own validation:
- **Step 2**: Requires iCloud email address
- **Step 3**: At least one service must be enabled
- **Step 4**: Connection test must pass
- **Step 5**: Final configuration save must succeed

### Connection Testing

Step 4 performs actual connection test:
1. Saves current configuration to backend
2. Calls `/api/config/test-connection` endpoint
3. Displays real-time test results
4. Auto-advances to next step on success
5. Shows error message on failure

## Development

### Testing the Wizard

To test the wizard during development:

```javascript
// In browser console
localStorage.removeItem('icloudbridge-app-storage');
location.reload();
```

This clears the persisted state and triggers the wizard on next load.

### Modifying Steps

Steps are defined in `STEPS` array:

```typescript
const STEPS = [
  { id: 'welcome', title: 'Welcome', description: '...' },
  { id: 'icloud', title: 'iCloud', description: '...' },
  // ...
];
```

Add new steps by:
1. Adding to `STEPS` array
2. Implementing case in `renderStepContent()`
3. Adding validation in navigation handlers

### Styling

Uses shadcn/ui components:
- Dialog for modal container
- Progress for completion indicator
- Button for navigation
- Input, Label, Switch for form controls
- Alert for error/success messages

## User Flow

```
┌─────────────┐
│   Welcome   │ → Overview of features
└──────┬──────┘
       ↓
┌─────────────┐
│   iCloud    │ → Enter credentials
└──────┬──────┘
       ↓
┌─────────────┐
│  Services   │ → Select what to sync
└──────┬──────┘
       ↓
┌─────────────┐
│    Test     │ → Verify connection
└──────┬──────┘
       ↓
┌─────────────┐
│  Complete   │ → Setup finished!
└─────────────┘
```

## Best Practices

### For Users
1. Have your iCloud credentials ready
2. Know which services you want to sync
3. Complete all steps before closing browser
4. Note the data directory location

### For Developers
1. Always validate user input
2. Provide clear error messages
3. Save progress between steps
4. Test connection before allowing completion
5. Handle API errors gracefully

## Future Enhancements

Possible improvements:
- Add "Skip" option for experienced users
- Save partial progress
- Add "Back" functionality on error steps
- Include video tutorials or help links
- Support multiple iCloud accounts
- Import configuration from file

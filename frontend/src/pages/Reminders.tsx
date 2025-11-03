import { useEffect, useState } from 'react';
import { Calendar, RefreshCw, Trash2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import apiClient from '@/lib/api-client';
import { useSyncStore } from '@/store/sync-store';
import type { RemindersCalendar, SyncLog } from '@/types/api';

export default function Reminders() {
  const [calendars, setCalendars] = useState<RemindersCalendar[]>([]);
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [caldavUrl, setCaldavUrl] = useState('');
  const [caldavPassword, setCaldavPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const { activeSyncs } = useSyncStore();
  const activeSync = activeSyncs.get('reminders');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [calendarsData, historyData] = await Promise.all([
        apiClient.getRemindersCalendars(),
        apiClient.getRemindersHistory(10),
      ]);
      setCalendars(calendarsData);
      setHistory(historyData.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const result = await apiClient.syncReminders({
        mode,
        caldav_url: mode === 'manual' ? caldavUrl : undefined,
      });

      setSuccess(`Sync completed: ${result.message}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPassword = async () => {
    try {
      setLoading(true);
      await apiClient.setRemindersPassword(caldavPassword);
      setSuccess('CalDAV password saved successfully');
      setCaldavPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save password');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePassword = async () => {
    if (!confirm('Are you sure you want to delete the stored CalDAV password?')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteRemindersPassword();
      setSuccess('CalDAV password deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete password');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset Reminders sync? This will clear all sync state.')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.resetReminders();
      setSuccess('Reminders sync reset successfully');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Reminders Sync
          </h1>
          <p className="text-muted-foreground">
            Sync Apple Reminders with CalDAV
          </p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Active Sync Progress */}
      {activeSync && (
        <Card>
          <CardHeader>
            <CardTitle>Sync in Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{activeSync.message}</span>
                <span>{activeSync.progress}%</span>
              </div>
              <Progress value={activeSync.progress} />
            </div>
            {activeSync.stats && Object.keys(activeSync.stats).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(activeSync.stats).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
          <CardDescription>Configure and run reminders synchronization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sync Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={mode === 'auto' ? 'default' : 'outline'}
                onClick={() => setMode('auto')}
                className="flex-1"
              >
                Auto (iCloud)
              </Button>
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                onClick={() => setMode('manual')}
                className="flex-1"
              >
                Manual (CalDAV)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'auto' && 'Automatically detect iCloud CalDAV settings'}
              {mode === 'manual' && 'Manually specify CalDAV server URL'}
            </p>
          </div>

          {mode === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="caldav-url">CalDAV Server URL</Label>
              <Input
                id="caldav-url"
                type="url"
                placeholder="https://caldav.example.com"
                value={caldavUrl}
                onChange={(e) => setCaldavUrl(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing || !!activeSync}
              className="flex-1"
            >
              {syncing || activeSync ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Sync
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="destructive"
              disabled={loading || syncing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Management */}
      <Card>
        <CardHeader>
          <CardTitle>CalDAV Credentials</CardTitle>
          <CardDescription>Manage CalDAV server password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordForm ? (
            <div className="flex gap-2">
              <Button onClick={() => setShowPasswordForm(true)} className="flex-1">
                <Lock className="w-4 h-4 mr-2" />
                Set Password
              </Button>
              <Button onClick={handleDeletePassword} variant="outline">
                Delete Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caldav-password">CalDAV Password</Label>
                <Input
                  id="caldav-password"
                  type="password"
                  placeholder="Enter CalDAV password"
                  value={caldavPassword}
                  onChange={(e) => setCaldavPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSetPassword} disabled={!caldavPassword || loading}>
                  Save Password
                </Button>
                <Button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCaldavPassword('');
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendars */}
      <Card>
        <CardHeader>
          <CardTitle>Reminders Calendars</CardTitle>
          <CardDescription>Available calendars in your Reminders.app</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : calendars.length === 0 ? (
            <div className="text-center text-muted-foreground">No calendars found</div>
          ) : (
            <div className="space-y-2">
              {calendars.map((calendar) => (
                <div
                  key={calendar.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{calendar.name}</span>
                  </div>
                  <Badge variant="outline">{calendar.reminder_count} reminders</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground">No sync history</div>
          ) : (
            <div className="space-y-3">
              {history.map((log) => (
                <div key={log.id} className="border-l-2 pl-4 py-2 space-y-1" style={{
                  borderColor: log.status === 'completed' ? 'rgb(34 197 94)' :
                               log.status === 'failed' ? 'rgb(239 68 68)' :
                               'rgb(59 130 246)'
                }}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.operation}</span>
                    <Badge variant={log.status === 'completed' ? 'success' : log.status === 'failed' ? 'destructive' : 'default'}>
                      {log.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{log.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(log.started_at)}</span>
                    {log.duration_seconds && (
                      <span>{log.duration_seconds}s</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

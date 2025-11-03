import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Upload, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import apiClient from '@/lib/api-client';
import { useSyncStore } from '@/store/sync-store';
import type { NotesFolder, SyncLog } from '@/types/api';

export default function Notes() {
  const [folders, setFolders] = useState<NotesFolder[]>([]);
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'import' | 'export' | 'bidirectional'>('bidirectional');

  const { activeSyncs } = useSyncStore();
  const activeSync = activeSyncs.get('notes');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [foldersData, historyData] = await Promise.all([
        apiClient.getNotesFolders(),
        apiClient.getNotesHistory(10),
      ]);
      setFolders(foldersData);
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

      const result = await apiClient.syncNotes({ mode });

      setSuccess(`Sync completed: ${result.message}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset Notes sync? This will clear all sync state.')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.resetNotes();
      setSuccess('Notes sync reset successfully');
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
            <FileText className="w-8 h-8" />
            Notes Sync
          </h1>
          <p className="text-muted-foreground">
            Sync Apple Notes with your markdown files
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
          <CardDescription>Configure and run notes synchronization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sync Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={mode === 'import' ? 'default' : 'outline'}
                onClick={() => setMode('import')}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                variant={mode === 'export' ? 'default' : 'outline'}
                onClick={() => setMode('export')}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant={mode === 'bidirectional' ? 'default' : 'outline'}
                onClick={() => setMode('bidirectional')}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Bidirectional
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'import' && 'Import notes from iCloud to markdown files'}
              {mode === 'export' && 'Export markdown files to iCloud Notes'}
              {mode === 'bidirectional' && 'Two-way sync between iCloud and markdown files'}
            </p>
          </div>

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

      {/* Folders */}
      <Card>
        <CardHeader>
          <CardTitle>Notes Folders</CardTitle>
          <CardDescription>Available folders in your Notes.app</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : folders.length === 0 ? (
            <div className="text-center text-muted-foreground">No folders found</div>
          ) : (
            <div className="space-y-2">
              {folders.map((folder) => (
                <div
                  key={folder.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span>{folder.name}</span>
                  </div>
                  <Badge variant="outline">{folder.note_count} notes</Badge>
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
                  {log.stats && Object.keys(log.stats).length > 0 && (
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      {Object.entries(log.stats).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground">{key}:</span>{' '}
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

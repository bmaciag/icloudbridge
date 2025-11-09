import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Trash2, AlertTriangle, PlayCircle, ChevronDown, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FolderMappingTable } from '@/components/FolderMappingTable';
import apiClient from '@/lib/api-client';
import { useSyncStore } from '@/store/sync-store';
import type { SyncLog, SetupVerificationResponse, NotesAllFoldersResponse, FolderMapping, AppConfig } from '@/types/api';

export default function Notes() {
  const [allFolders, setAllFolders] = useState<NotesAllFoldersResponse | null>(null);
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verification, setVerification] = useState<SetupVerificationResponse | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [showMappings, setShowMappings] = useState(false);

  const { activeSyncs } = useSyncStore();
  const activeSync = activeSyncs.get('notes');

  useEffect(() => {
    loadData();
    loadVerification();
  }, []);

  // Set to manual mode if there are existing mappings
  useEffect(() => {
    if (config?.notes_folder_mappings && Object.keys(config.notes_folder_mappings).length > 0) {
      setMode('manual');
      setShowMappings(true);
    }
  }, [config]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allFoldersData, historyData, configData] = await Promise.all([
        apiClient.getAllNotesFolders(),
        apiClient.getNotesHistory(10),
        apiClient.getConfig(),
      ]);
      setAllFolders(allFoldersData);
      setHistory(historyData.logs);
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadVerification = async () => {
    try {
      const result = await apiClient.verifySetup();
      setVerification(result);
    } catch (err) {
      console.error('Failed to load verification:', err);
    }
  };

  const handleSync = async (dryRun: boolean = false) => {
    try {
      if (dryRun) {
        setSimulating(true);
        setSimulationResult(null);
      } else {
        setSyncing(true);
      }
      setError(null);
      setSuccess(null);

      const result = await apiClient.syncNotes({
        dry_run: dryRun,
      });

      if (dryRun) {
        setSimulationResult(result);
        setSuccess('Simulation completed - see results below');
      } else {
        setSuccess(`Sync completed: ${result.message}`);
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (dryRun ? 'Simulation failed' : 'Sync failed'));
    } finally {
      if (dryRun) {
        setSimulating(false);
      } else {
        setSyncing(false);
      }
    }
  };

  const handleSimulateSync = () => handleSync(true);

  const handleSaveMappings = async (mappings: Record<string, FolderMapping>) => {
    try {
      setError(null);
      setSuccess(null);

      await apiClient.updateConfig({
        notes_folder_mappings: mappings,
      });

      setSuccess('Folder mappings saved successfully');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mappings');
      throw err; // Re-throw so FolderMappingTable knows it failed
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

      {/* Setup Verification Warning */}
      {verification && !verification.all_ready && (
        <Alert variant="warning" className="border-orange-500 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <AlertTitle>Setup Incomplete</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Your Notes sync setup needs attention:
              </p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                {verification.shortcuts.some(s => !s.installed) && (
                  <li>
                    {verification.shortcuts.filter(s => !s.installed).length} of {verification.shortcuts.length} required shortcuts not installed
                  </li>
                )}
                {!verification.full_disk_access.has_access && (
                  <li>Python does not have Full Disk Access</li>
                )}
                {verification.notes_folder.path && !verification.notes_folder.exists && (
                  <li>Notes folder does not exist: {verification.notes_folder.path}</li>
                )}
                {verification.notes_folder.exists && !verification.notes_folder.writable && (
                  <li>Notes folder is not writable</li>
                )}
              </ul>
              <Button
                size="sm"
                variant="outline"
                onClick={loadVerification}
                className="bg-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            </AlertDescription>
          </div>
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
          <CardDescription>Configure and run notes synchronisation</CardDescription>
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
                Auto
              </Button>
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                onClick={() => setMode('manual')}
                className="flex-1"
              >
                Manual
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'auto' && 'Automatically sync all Apple Notes folders to markdown folders with matching names using 1:1 mapping.'}
              {mode === 'manual' && 'Manually configure which Apple Notes folders sync to which markdown folders. Only mapped folders will sync.'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleSync(false)}
              disabled={syncing || simulating || !!activeSync}
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
              onClick={handleSimulateSync}
              disabled={syncing || simulating || !!activeSync}
              variant="outline"
              className="flex-1"
            >
              {simulating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Simulate Sync
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="destructive"
              disabled={loading || syncing || simulating}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Simulation Results</CardTitle>
            <CardDescription>Preview of what would happen during sync</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {simulationResult.message && (
                <div className="text-sm text-muted-foreground">{simulationResult.message}</div>
              )}
              {simulationResult.stats && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(simulationResult.stats).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                onClick={() => setSimulationResult(null)}
                variant="outline"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Folder Mappings</CardTitle>
          <CardDescription>
            {mode === 'auto'
              ? 'View automatic folder mappings (read-only)'
              : 'Configure which Apple Notes folders sync to which markdown folders'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'auto' ? (
            <Collapsible open={showMappings} onOpenChange={setShowMappings}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full flex justify-between items-center">
                  <span>View Automatic Mappings</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMappings ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                {loading || !allFolders ? (
                  <div className="text-center text-muted-foreground">Loading...</div>
                ) : Object.keys(allFolders.folders).length === 0 ? (
                  <div className="text-center text-muted-foreground">No folders found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Apple Notes Folder</th>
                          <th className="text-left p-3 font-medium">Markdown Folder</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Merge folders by normalized path to avoid duplicates
                          const mergedFolders = new Map<string, { apple: boolean; markdown: boolean }>();

                          Object.entries(allFolders.folders).forEach(([path, info]) => {
                            // Normalize path by removing iCloud/ prefix
                            const normalizedPath = path.startsWith('iCloud/') ? path.slice(7) : path;

                            // Merge info for the same normalized path
                            const existing = mergedFolders.get(normalizedPath);
                            if (existing) {
                              mergedFolders.set(normalizedPath, {
                                apple: existing.apple || info.apple,
                                markdown: existing.markdown || info.markdown,
                              });
                            } else {
                              mergedFolders.set(normalizedPath, {
                                apple: info.apple,
                                markdown: info.markdown,
                              });
                            }
                          });

                          return Array.from(mergedFolders.entries())
                            .filter(([_, info]) => info.apple || info.markdown)
                            .map(([displayPath, info]) => (
                              <tr key={displayPath} className="border-b">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{displayPath}</span>
                                    {!info.apple && info.markdown && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        Will be created
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{displayPath}</span>
                                    {info.apple && !info.markdown && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        Will be created
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            loading || !allFolders || !config ? (
              <div className="text-center text-muted-foreground py-8">Loading folders...</div>
            ) : (
              <FolderMappingTable
                folders={allFolders.folders}
                mappings={config.notes_folder_mappings || {}}
                onSave={handleSaveMappings}
                manualMappingEnabled={mode === 'manual'}
              />
            )
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

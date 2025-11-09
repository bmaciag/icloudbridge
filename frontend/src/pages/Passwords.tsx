import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, RefreshCw, Upload, Download, Trash2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import apiClient from '@/lib/api-client';
import { useSyncStore } from '@/store/sync-store';
import type { AppConfig, SyncLog } from '@/types/api';

export default function Passwords() {
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vaultwardenUrl, setVaultwardenUrl] = useState('');
  const [vaultwardenToken, setVaultwardenToken] = useState('');
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { activeSyncs } = useSyncStore();
  const activeSync = activeSyncs.get('passwords');

  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await apiClient.getConfig();
      setConfig(cfg);
      if (cfg.passwords_vaultwarden_url) {
        setVaultwardenUrl(cfg.passwords_vaultwarden_url);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const historyData = await apiClient.getPasswordsHistory(10);
      setHistory(historyData.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleImportApple = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await apiClient.importApplePasswords(file);
      setSuccess(`Import completed: ${result.message}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBitwarden = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await apiClient.importBitwardenPasswords(file);
      setSuccess(`Import completed: ${result.message}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportApple = async () => {
    try {
      setLoading(true);
      const blob = await apiClient.exportApplePasswords();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passwords_apple_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('Export completed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBitwarden = async () => {
    try {
      setLoading(true);
      const blob = await apiClient.exportBitwardenPasswords();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passwords_bitwarden_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('Export completed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const result = await apiClient.syncPasswords({
        vaultwarden_url: vaultwardenUrl || undefined,
      });

      setSuccess(`Sync completed: ${result.message}`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSetCredentials = async () => {
    try {
      setLoading(true);
      await apiClient.setVaultwardenCredentials(vaultwardenUrl, vaultwardenToken);
      setSuccess('VaultWarden credentials saved successfully');
      setVaultwardenUrl('');
      setVaultwardenToken('');
      setShowCredentialsForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete the stored VaultWarden credentials?')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteVaultwardenCredentials();
      setSuccess('VaultWarden credentials deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset Passwords sync? This will clear all sync state.')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.resetPasswords();
      setSuccess('Passwords sync reset successfully');
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

  const handleFileSelect = (type: 'apple' | 'bitwarden') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (type === 'apple') {
          await handleImportApple(file);
        } else {
          await handleImportBitwarden(file);
        }
      }
    };
    input.click();
  };

  if (!loading && config && config.passwords_enabled === false) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Passwords sync is disabled</CardTitle>
            <CardDescription>Enable Passwords sync in Settings to unlock VaultWarden tools.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the Settings screen to turn Passwords sync back on. Once enabled, you can manage imports, exports,
              and VaultWarden credentials here.
            </p>
            <Button asChild>
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8" />
            Passwords Sync
          </h1>
          <p className="text-muted-foreground">
            Sync passwords with VaultWarden and manage exports
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

      {/* VaultWarden Sync */}
      <Card>
        <CardHeader>
          <CardTitle>VaultWarden Sync</CardTitle>
          <CardDescription>Sync passwords with VaultWarden server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  Sync to VaultWarden
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

      {/* VaultWarden Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>VaultWarden Credentials</CardTitle>
          <CardDescription>Manage VaultWarden server credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showCredentialsForm ? (
            <div className="flex gap-2">
              <Button onClick={() => setShowCredentialsForm(true)} className="flex-1">
                <Lock className="w-4 h-4 mr-2" />
                Set Credentials
              </Button>
              <Button onClick={handleDeleteCredentials} variant="outline">
                Delete Credentials
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vw-url">VaultWarden URL</Label>
                <Input
                  id="vw-url"
                  type="url"
                  placeholder="https://vault.example.com"
                  value={vaultwardenUrl}
                  onChange={(e) => setVaultwardenUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vw-token">API Token</Label>
                <Input
                  id="vw-token"
                  type="password"
                  placeholder="Enter API token"
                  value={vaultwardenToken}
                  onChange={(e) => setVaultwardenToken(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSetCredentials}
                  disabled={!vaultwardenUrl || !vaultwardenToken || loading}
                >
                  Save Credentials
                </Button>
                <Button
                  onClick={() => {
                    setShowCredentialsForm(false);
                    setVaultwardenUrl('');
                    setVaultwardenToken('');
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

      {/* Import/Export */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle>Import Passwords</CardTitle>
            <CardDescription>Import from CSV files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => handleFileSelect('apple')}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Apple CSV
            </Button>
            <Button
              onClick={() => handleFileSelect('bitwarden')}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Bitwarden CSV
            </Button>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle>Export Passwords</CardTitle>
            <CardDescription>Export to CSV files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={handleExportApple}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Apple CSV
            </Button>
            <Button
              onClick={handleExportBitwarden}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Bitwarden CSV
            </Button>
          </CardContent>
        </Card>
      </div>

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

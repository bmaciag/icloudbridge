import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, RefreshCw, Save, Trash2, FileText, Calendar, Key, Download, Shield, AlertTriangle, ExternalLink, CheckCircle, Loader2, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FolderBrowserDialog } from '@/components/FolderBrowserDialog';
import { useAppStore } from '@/store/app-store';
import apiClient from '@/lib/api-client';
import type { AppConfig, SetupVerificationResponse } from '@/types/api';

export default function Settings() {
  const { config, setConfig, setIsFirstRun, resetWizard } = useAppStore();
  const [formData, setFormData] = useState<Partial<AppConfig>>({});
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [verification, setVerification] = useState<SetupVerificationResponse | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Load verification when Notes is enabled
  useEffect(() => {
    if (formData.notes_enabled) {
      loadVerification();
    }
  }, [formData.notes_enabled]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const data = await apiClient.getConfig();
      setConfig(data);
      setFormData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadVerification = async () => {
    try {
      setVerifying(true);
      const result = await apiClient.verifySetup();
      setVerification(result);
    } catch (err) {
      console.error('Failed to load verification:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = () => {
    // Reset form data to current config
    if (config) {
      setFormData(config);
      setError(null);
      setSuccess(null);
    }
  };

  const handleServiceReset = async (service: 'notes' | 'reminders' | 'passwords') => {
    const serviceNames = {
      notes: 'Notes',
      reminders: 'Reminders',
      passwords: 'Passwords'
    };

    const serviceName = serviceNames[service];

    if (!confirm(`Are you sure you want to reset ${serviceName}?\n\nThis will:\n- Delete the ${serviceName} database\n- Clear ${serviceName} sync history\n- Delete ${serviceName} keychain passwords\n- Reset ${serviceName} settings\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setResetting(service);
      setError(null);

      if (service === 'notes') {
        await apiClient.resetNotes();
      } else if (service === 'reminders') {
        await apiClient.resetReminders();
      } else if (service === 'passwords') {
        await apiClient.resetPasswords();
      }

      // Update config to disable the service
      const updatedFormData = { ...formData };
      if (service === 'notes') {
        updatedFormData.notes_enabled = false;
        updatedFormData.notes_remote_folder = '';
      } else if (service === 'reminders') {
        updatedFormData.reminders_enabled = false;
        updatedFormData.reminders_caldav_url = '';
        updatedFormData.reminders_caldav_username = '';
        updatedFormData.reminders_caldav_password = '';
        updatedFormData.reminders_use_nextcloud = true;
        updatedFormData.reminders_nextcloud_url = '';
      } else if (service === 'passwords') {
        updatedFormData.passwords_enabled = false;
        updatedFormData.passwords_vaultwarden_url = '';
        updatedFormData.passwords_vaultwarden_email = '';
        updatedFormData.passwords_vaultwarden_password = '';
      }

      // Save the updated config
      const updated = await apiClient.updateConfig(updatedFormData);
      setConfig(updated);
      setFormData(updated);

      setSuccess(`${serviceName} reset successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to reset ${serviceName}`);
    } finally {
      setResetting(null);
    }
  };

  const handleResetConfiguration = async () => {
    if (!confirm('Are you sure you want to completely reset all configuration?\n\nThis will:\n- Delete all databases (notes, reminders, passwords)\n- Delete all sync history and state\n- Delete all passwords from macOS Keychain\n- Delete the configuration file\n- Delete the data directory\n\nNote: Your synced markdown files will NOT be deleted.\n\nThis action cannot be undone!')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the comprehensive reset endpoint
      await apiClient.resetConfig();

      // Reset wizard state in Zustand
      resetWizard();
      setIsFirstRun(true);

      // Reload the page to show the wizard
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset configuration');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const updated = await apiClient.updateConfig(formData);
      setConfig(updated);
      setSuccess('Configuration saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Configure iCloudBridge sync services
          </p>
        </div>
        <Button onClick={loadConfig} variant="outline" disabled={loading}>
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

      {/* Data Storage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Data Storage</CardTitle>
              <CardDescription>Configure where iCloudBridge stores its data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data-dir">Data Directory</Label>
            <Input
              id="data-dir"
              placeholder="~/.icloudbridge"
              value={formData.data_dir || ''}
              onChange={(e) => setFormData({ ...formData, data_dir: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Where to store sync data and databases
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Notes Sync</CardTitle>
                <CardDescription>Sync Apple Notes with markdown files</CardDescription>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleServiceReset('notes')}
              disabled={resetting === 'notes' || loading}
            >
              {resetting === 'notes' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset Notes
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Localhost Warning */}
          {verification && !verification.is_localhost && (
            <Alert variant="warning" className="border-orange-500 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Remote Access Detected</strong>
                <p className="mt-1">
                  Shortcut installation and permission settings must be configured on the same Mac where iCloudBridge is running.
                  You can skip these steps for now and set them up later when accessing from that machine.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Enable Notes Sync</Label>
              <p className="text-sm text-muted-foreground">
                Sync your Apple Notes to markdown
              </p>
            </div>
            <Switch
              checked={formData.notes_enabled || false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notes_enabled: checked })
              }
            />
          </div>

          {formData.notes_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="notes-folder">Notes Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="notes-folder"
                    placeholder="~/Documents/Notes"
                    value={formData.notes_remote_folder || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, notes_remote_folder: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFolderBrowser(true)}
                  >
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Directory on your macOS sync machine where markdown files will be stored
                </p>
              </div>

              {/* Shortcuts Installation Section */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    <Label className="text-base">Install Apple Shortcuts</Label>
                  </div>
                  {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  Three shortcuts are required for rich notes support (images, tables, formatting).
                </p>

                <div className="space-y-2">
                  {verification?.shortcuts.map((shortcut) => (
                    <div key={shortcut.name} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative">
                          <img
                            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23007AFF'%3E%3Cpath d='M6 6h12v2H6zm0 4h12v2H6zm0 4h12v2H6z'/%3E%3C/svg%3E"
                            alt="Shortcuts"
                            className="w-6 h-6"
                          />
                          {shortcut.installed && (
                            <CheckCircle className="w-3 h-3 text-green-500 absolute -top-1 -right-1 bg-white rounded-full" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{shortcut.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={shortcut.installed ? "outline" : "default"}
                        disabled={shortcut.installed}
                        onClick={() => window.open(shortcut.url, '_blank')}
                      >
                        {shortcut.installed ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Installed
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Install
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadVerification}
                  className="w-full"
                >
                  Refresh Status
                </Button>
              </div>

              {/* Full Disk Access Section */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <Label className="text-base">Full Disk Access</Label>
                  </div>
                  {verification?.full_disk_access.has_access ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Python needs Full Disk Access to read your Notes database.
                </p>

                {verification && (
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-md text-sm">
                      <div className="font-medium mb-1">Python Path:</div>
                      <code className="text-xs break-all">{verification.full_disk_access.python_path}</code>
                    </div>

                    {!verification.full_disk_access.has_access && (
                      <div className="space-y-2">
                        <p className="text-sm">To grant Full Disk Access:</p>
                        <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                          <li>Open System Settings → Privacy & Security → Full Disk Access</li>
                          <li>Click the lock icon to make changes</li>
                          <li>Click the + button</li>
                          <li>Navigate to and select the Python executable above</li>
                          <li>Restart this application</li>
                        </ol>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
                          }}
                          className="w-full"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open System Settings
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadVerification}
                  className="w-full"
                >
                  Check Access
                </Button>
              </div>
            </>
          )}

          <Alert>
            <AlertDescription>
              Notes sync stores a copy of your Apple Notes as markdown in a folder.
              You can sync with cloud storage services like Nextcloud by pointing the notes folder to your synced directory.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Reminders Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Reminders Sync</CardTitle>
                <CardDescription>Sync Apple Reminders via CalDAV</CardDescription>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleServiceReset('reminders')}
              disabled={resetting === 'reminders' || loading}
            >
              {resetting === 'reminders' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset Reminders
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Enable Reminders Sync</Label>
              <p className="text-sm text-muted-foreground">
                Sync with CalDAV servers like Nextcloud or iCloud
              </p>
            </div>
            <Switch
              checked={formData.reminders_enabled || false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, reminders_enabled: checked })
              }
            />
          </div>

          {formData.reminders_enabled && (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use-nextcloud"
                  checked={formData.reminders_use_nextcloud ?? true}
                  onChange={(e) => {
                    const useNextcloud = e.target.checked;
                    setFormData({
                      ...formData,
                      reminders_use_nextcloud: useNextcloud,
                      reminders_caldav_url: '',
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="use-nextcloud" className="text-sm font-normal cursor-pointer">
                  Use Nextcloud
                </Label>
              </div>

              {formData.reminders_use_nextcloud !== false && (
                <div className="space-y-2">
                  <Label htmlFor="nextcloud-url">Nextcloud URL</Label>
                  <Input
                    id="nextcloud-url"
                    type="url"
                    placeholder="https://nextcloud.example.org"
                    value={formData.reminders_nextcloud_url || ''}
                    onChange={(e) => {
                      const nextcloudUrl = e.target.value;
                      const caldavUrl = nextcloudUrl ? `${nextcloudUrl.replace(/\/$/, '')}/remote.php/dav` : '';
                      setFormData({
                        ...formData,
                        reminders_nextcloud_url: nextcloudUrl,
                        reminders_caldav_url: caldavUrl,
                      });
                    }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="caldav-username">Username</Label>
                <Input
                  id="caldav-username"
                  placeholder="username"
                  value={formData.reminders_caldav_username || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminders_caldav_username: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caldav-password">Password</Label>
                <Input
                  id="caldav-password"
                  type="password"
                  placeholder="Password"
                  value={formData.reminders_caldav_password || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminders_caldav_password: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {formData.reminders_use_nextcloud !== false
                    ? 'Your Nextcloud password or app password'
                    : 'For iCloud, use an app-specific password from appleid.apple.com'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="caldav-url">CalDAV URL</Label>
                <Input
                  id="caldav-url"
                  type="url"
                  placeholder="https://caldav.icloud.com"
                  value={formData.reminders_caldav_url || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminders_caldav_url: e.target.value,
                    })
                  }
                  disabled={formData.reminders_use_nextcloud !== false}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.reminders_use_nextcloud !== false
                    ? 'Auto-filled from Nextcloud URL'
                    : 'Full CalDAV server URL'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Passwords Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Passwords Sync</CardTitle>
                <CardDescription>Sync passwords with Bitwarden or Vaultwarden</CardDescription>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleServiceReset('passwords')}
              disabled={resetting === 'passwords' || loading}
            >
              {resetting === 'passwords' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset Passwords
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Enable Passwords Sync</Label>
              <p className="text-sm text-muted-foreground">
                Sync passwords with Bitwarden or Vaultwarden
              </p>
            </div>
            <Switch
              checked={formData.passwords_enabled || false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, passwords_enabled: checked })
              }
            />
          </div>

          {formData.passwords_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="vw-url">Bitwarden/Vaultwarden URL</Label>
                <Input
                  id="vw-url"
                  type="url"
                  placeholder="https://vault.bitwarden.com"
                  value={formData.passwords_vaultwarden_url || ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    setFormData({
                      ...formData,
                      passwords_vaultwarden_url: url,
                    });
                  }}
                  onFocus={(e) => {
                    e.target.setAttribute('list', 'bitwarden-urls');
                  }}
                />
                <datalist id="bitwarden-urls">
                  <option value="https://vault.bitwarden.com" />
                  <option value="https://vault.bitwarden.eu" />
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Use vault.bitwarden.com, vault.bitwarden.eu, or your self-hosted server URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vw-email">Bitwarden/Vaultwarden Email</Label>
                <Input
                  id="vw-email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.passwords_vaultwarden_email || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passwords_vaultwarden_email: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vw-password">Bitwarden/Vaultwarden Password</Label>
                <Input
                  id="vw-password"
                  type="password"
                  placeholder="Your master password"
                  value={formData.passwords_vaultwarden_password || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passwords_vaultwarden_password: e.target.value,
                    })
                  }
                />
              </div>
            </>
          )}

          <Alert>
            <AlertDescription>
              iCloudBridge does not store your passwords - these will be stored in your Bitwarden or Vaultwarden vault.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>Configuration file path and danger zone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-file">Configuration File</Label>
            <Input
              id="config-file"
              placeholder="/path/to/config.toml"
              value={formData.config_file || ''}
              onChange={(e) => setFormData({ ...formData, config_file: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Optional path to TOML configuration file
            </p>
          </div>

          <div className="pt-4 border-t">
            <div className="space-y-3">
              <div>
                <Label className="text-destructive">Danger Zone</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Completely reset iCloudBridge by deleting all databases, sync history,
                  keychain passwords, configuration files, and the data directory.
                  Your synced markdown files will NOT be deleted.
                </p>
              </div>
              <Button
                onClick={handleResetConfiguration}
                variant="destructive"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Complete Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleReset} variant="outline" disabled={loading}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      <FolderBrowserDialog
        open={showFolderBrowser}
        onOpenChange={setShowFolderBrowser}
        onSelect={(path) => setFormData({ ...formData, notes_remote_folder: path })}
        initialPath={formData.notes_remote_folder || '~'}
        title="Select Notes Folder"
        description="Choose where to store your Notes as markdown files"
      />
    </div>
  );
}

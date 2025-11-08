import { useState, useEffect } from 'react';
import { Folder, Home, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import apiClient from '@/lib/api-client';
import type { BrowseFoldersResponse } from '@/types/api';

interface FolderBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  title?: string;
  description?: string;
}

export function FolderBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath = '~',
  title = 'Select Folder',
  description = 'Browse and select a folder on your server',
}: FolderBrowserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BrowseFoldersResponse | null>(null);

  useEffect(() => {
    if (open) {
      loadFolders(initialPath);
    }
  }, [open, initialPath]);

  const loadFolders = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.browseFolders(path);
      setData(result);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (path: string) => {
    loadFolders(path);
  };

  const handleParentClick = () => {
    if (data?.parent_path) {
      loadFolders(data.parent_path);
    }
  };

  const handleSelect = () => {
    if (data?.current_path) {
      onSelect(data.current_path);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Current Path */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          <Home className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <code className="text-sm flex-1 truncate">
            {data?.current_path || initialPath}
          </code>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Folder List */}
        <div className="h-[400px] border rounded-md overflow-y-auto">
          <div className="p-2 space-y-1">
            {/* Parent Directory Link */}
            {data?.parent_path && (
              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-2"
                onClick={handleParentClick}
                disabled={loading}
              >
                <Folder className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm">.. (Parent Directory)</span>
              </Button>
            )}

            {/* Folder List */}
            {data?.folders && data.folders.length > 0 ? (
              data.folders.map((folder) => (
                <Button
                  key={folder.path}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2"
                  onClick={() => handleFolderClick(folder.path)}
                  disabled={loading}
                >
                  <Folder className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="text-sm flex-1 text-left">{folder.name}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                {loading ? 'Loading folders...' : 'No subfolders found'}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!data?.current_path || loading}>
            Select This Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

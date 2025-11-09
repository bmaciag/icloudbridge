import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  Apple,
  FileText,
  X,
  AlertCircle,
  ArrowLeftRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Autocomplete } from '@/components/ui/autocomplete';
import type { FolderInfo, FolderMapping } from '@/types/api';

interface FolderNode {
  path: string;
  name: string;
  level: number;
  source: FolderInfo;
  children: FolderNode[];
  parent: FolderNode | null;
  isExpanded: boolean;
}

interface FolderMappingTableProps {
  folders: Record<string, FolderInfo>;
  mappings: Record<string, FolderMapping>;
  onSave: (mappings: Record<string, FolderMapping>) => Promise<void>;
  manualMappingEnabled: boolean;
}

export function FolderMappingTable({
  folders,
  mappings,
  onSave,
  manualMappingEnabled,
}: FolderMappingTableProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editedMappings, setEditedMappings] = useState<Record<string, FolderMapping>>(mappings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build folder tree structure
  const { folderTree, treeRoots } = useMemo(() => {
    const nodeMap = new Map<string, FolderNode>();
    const rootNodes: FolderNode[] = [];

    // Create nodes for all folders
    Object.entries(folders).forEach(([path, source]) => {
      const parts = path.split('/');
      const name = parts[parts.length - 1];
      const level = parts.length - 1;

      const node: FolderNode = {
        path,
        name,
        level,
        source,
        children: [],
        parent: null,
        isExpanded: expandedFolders.has(path),
      };

      nodeMap.set(path, node);
    });

    // Build parent-child relationships
    nodeMap.forEach((node) => {
      if (node.level === 0) {
        rootNodes.push(node);
      } else {
        const parts = node.path.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        const parent = nodeMap.get(parentPath);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        } else {
          rootNodes.push(node); // Orphaned node
        }
      }
    });

    // Sort nodes
    const sortNodes = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(rootNodes);

    return { folderTree: nodeMap, treeRoots: rootNodes };
  }, [folders, expandedFolders]);

  // Get list of Apple Notes folders and Markdown folders
  const appleFolders = useMemo(() => {
    return Array.from(folderTree.values()).filter((node) => node.source.apple);
  }, [folderTree]);

  const markdownFolders = useMemo(() => {
    return Array.from(folderTree.values()).filter((node) => node.source.markdown);
  }, [folderTree]);

  // Determine which folders are mapped
  const mappedAppleFolders = useMemo(() => {
    return new Set(Object.keys(editedMappings));
  }, [editedMappings]);

  const mappedMarkdownFolders = useMemo(() => {
    return new Set(Object.values(editedMappings).map((m) => m.markdown_folder));
  }, [editedMappings]);

  // Get unmapped root-level folders for each source
  const unmappedAppleRoots = useMemo(() => {
    return treeRoots.filter((node) => node.source.apple && !mappedAppleFolders.has(node.path));
  }, [treeRoots, mappedAppleFolders]);

  const unmappedMarkdownRoots = useMemo(() => {
    return treeRoots.filter(
      (node) => node.source.markdown && !mappedMarkdownFolders.has(node.path)
    );
  }, [treeRoots, mappedMarkdownFolders]);

  // Track new folders that will be created
  const newFolders = useMemo(() => {
    const result = {
      apple: [] as string[],
      markdown: [] as string[],
    };

    Object.entries(editedMappings).forEach(([appleFolder, mapping]) => {
      // Check if apple folder is new (doesn't exist yet)
      if (!folders[appleFolder]?.apple) {
        result.apple.push(appleFolder);
      }
      // Check if markdown folder is new (doesn't exist yet)
      if (!folders[mapping.markdown_folder]?.markdown) {
        result.markdown.push(mapping.markdown_folder);
      }
    });

    return result;
  }, [editedMappings, folders]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const createMapping = (appleFolder: string, markdownFolder: string) => {
    setEditedMappings((prev) => ({
      ...prev,
      [appleFolder]: {
        markdown_folder: markdownFolder,
        mode: 'bidirectional',
      },
    }));
    setHasChanges(true);
  };

  const updateMappingMode = (appleFolder: string, mode: 'import' | 'export' | 'bidirectional') => {
    setEditedMappings((prev) => ({
      ...prev,
      [appleFolder]: {
        ...prev[appleFolder],
        mode,
      },
    }));
    setHasChanges(true);
  };

  const removeMapping = (appleFolder: string) => {
    setEditedMappings((prev) => {
      const next = { ...prev };
      delete next[appleFolder];
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedMappings);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedMappings(mappings);
    setHasChanges(false);
  };

  // Render a folder node in the tree
  const renderFolderNode = (node: FolderNode, isMapped: boolean) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = node.isExpanded;
    const indent = node.level * 24;

    return (
      <div key={node.path}>
        <div className="flex items-center gap-2 py-2" style={{ paddingLeft: `${indent}px` }}>
          {hasChildren ? (
            <button
              onClick={() => toggleFolder(node.path)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
          {hasChildren && isExpanded ? (
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FolderClosed className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1">{node.name}</span>
          {isMapped && <Badge variant="secondary">Mapped</Badge>}
        </div>
        {isExpanded &&
          hasChildren &&
          node.children.map((child) => {
            const childMapped = mappedAppleFolders.has(child.path) || mappedMarkdownFolders.has(child.path);
            return renderFolderNode(child, childMapped);
          })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* New folders notification */}
      {(newFolders.apple.length > 0 || newFolders.markdown.length > 0) && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-500 mt-0.5" />
          <div className="flex-1">
            {newFolders.apple.length > 0 && (
              <p className="text-sm text-blue-900 dark:text-blue-100 mb-1">
                <span className="font-medium">The following folders will be created in Apple Notes:</span>{' '}
                {newFolders.apple.join(', ')}
              </p>
            )}
            {newFolders.markdown.length > 0 && (
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-medium">The following folders will be created in your Markdown folder:</span>{' '}
                {newFolders.markdown.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Migration warning - show when manual mapping is enabled but no mappings saved yet */}
      {manualMappingEnabled && Object.keys(mappings).length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-900 dark:text-yellow-100">
              Switching to Manual Mapping Mode
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
              Once you save folder mappings, automatic 1:1 sync will be disabled. Only folders you explicitly map will be synced. Database entries for unmapped folders will be removed.
            </p>
          </div>
        </div>
      )}

      {/* Unmapped folders - two column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Apple Notes Folders Section */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Apple className="h-5 w-5" />
            Apple Notes Folders
          </h3>

          {/* Unmapped Apple folders */}
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Unmapped folders</p>
            {appleFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Apple Notes folders found
              </p>
            ) : unmappedAppleRoots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All folders are mapped
              </p>
            ) : (
              unmappedAppleRoots.map((node) => (
                <div key={node.path} className="space-y-2">
                  {renderFolderNode(node, false)}
                  <div className="ml-10">
                    <Autocomplete
                      placeholder="Map to markdown folder..."
                      searchPlaceholder="Search or type to create..."
                      value=""
                      options={unmappedMarkdownRoots.map((n) => ({
                        value: n.path,
                        label: n.path,
                      }))}
                      onValueChange={(value) => {
                        if (value) createMapping(node.path, value);
                      }}
                      allowCustom={true}
                      emptyText="Type to create a new folder"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Markdown/Nextcloud Folders Section */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Markdown/Nextcloud Folders
          </h3>

          {/* Unmapped Markdown folders */}
          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">Unmapped folders</p>
            {markdownFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Markdown folders found
              </p>
            ) : unmappedMarkdownRoots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All folders are mapped
              </p>
            ) : (
              unmappedMarkdownRoots.map((node) => (
                <div key={node.path} className="space-y-2">
                  {renderFolderNode(node, false)}
                  <div className="ml-10">
                    <Autocomplete
                      placeholder="Map to Apple Notes folder..."
                      searchPlaceholder="Search or type to create..."
                      value=""
                      options={unmappedAppleRoots.map((n) => ({
                        value: n.path,
                        label: n.path,
                      }))}
                      onValueChange={(value) => {
                        if (value) createMapping(value, node.path);
                      }}
                      allowCustom={true}
                      emptyText="Type to create a new folder"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sync Direction - full width mapped folders panel */}
      {Object.entries(editedMappings).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Sync Direction</h3>
          <div className="border rounded-lg p-4 space-y-3">
            {Object.entries(editedMappings).map(([appleFolder, mapping]) => {
              const appleNode = folderTree.get(appleFolder);
              const markdownNode = folderTree.get(mapping.markdown_folder);
              return (
                <div key={appleFolder} className="p-4 border rounded bg-muted/30">
                  <div className="flex items-center justify-between gap-4">
                    {/* Apple Notes folder */}
                    <div className="flex items-center gap-2 flex-1">
                      <Apple className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{appleNode?.name || appleFolder}</span>
                    </div>

                    {/* Sync direction selector */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapping.mode}
                        onValueChange={(value) =>
                          updateMappingMode(appleFolder, value as 'import' | 'export' | 'bidirectional')
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bidirectional">
                            <div className="flex items-center gap-2">
                              <ArrowLeftRight className="h-4 w-4" />
                              <span>Bidirectional</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="import">
                            <div className="flex items-center gap-2">
                              <ArrowLeft className="h-4 w-4" />
                              <span>Import only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="export">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4" />
                              <span>Export only</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Markdown folder */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium">{markdownNode?.name || mapping.markdown_folder}</span>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMapping(appleFolder)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {Object.keys(editedMappings).length} folder(s) mapped
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={!hasChanges || saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              'Save Mappings'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

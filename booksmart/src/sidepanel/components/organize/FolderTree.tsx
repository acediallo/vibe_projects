import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BookmarkMeta } from '@shared/types';

interface FolderNode {
  name: string;
  ownCount: number;
  children: Map<string, FolderNode>;
}

interface Props {
  metas: BookmarkMeta[];
}

function buildTree(metas: BookmarkMeta[]): FolderNode {
  const root: FolderNode = { name: '', ownCount: 0, children: new Map() };
  for (const m of metas) {
    const parts = m.folderPath.split('/').filter(Boolean);
    let node = root;
    for (const part of parts) {
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, ownCount: 0, children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
    node.ownCount++;
  }
  return root;
}

function totalCount(node: FolderNode): number {
  let total = node.ownCount;
  for (const child of node.children.values()) total += totalCount(child);
  return total;
}

interface NodeProps {
  node: FolderNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function TreeNode({ node, path, depth, expanded, onToggle }: NodeProps) {
  const hasChildren = node.children.size > 0;
  const isOpen = expanded.has(path);
  const total = totalCount(node);

  return (
    <div>
      <button
        onClick={() => hasChildren && onToggle(path)}
        className={`w-full flex items-center gap-1 px-2 py-1 text-sm hover:bg-slate-100 ${
          hasChildren ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown size={12} className="text-slate-500" />
          ) : (
            <ChevronRight size={12} className="text-slate-500" />
          )
        ) : (
          <span className="w-3" />
        )}
        <Folder size={12} className="text-slate-400" />
        <span className="flex-1 truncate text-left text-slate-700">
          {node.name}
        </span>
        <span className="text-[10px] text-slate-400">{total}</span>
      </button>
      {isOpen &&
        Array.from(node.children.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              path={`${path}/${child.name}`}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
    </div>
  );
}

export default function FolderTree({ metas }: Props) {
  const tree = useMemo(() => buildTree(metas), [metas]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const topFolders = Array.from(tree.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (topFolders.length === 0) {
    return (
      <p className="text-xs text-slate-500 px-3 py-4">
        No folders found yet. Run a scan to load your bookmarks.
      </p>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded">
      {topFolders.map((folder) => (
        <TreeNode
          key={folder.name}
          node={folder}
          path={`/${folder.name}`}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

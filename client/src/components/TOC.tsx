import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Input } from './ui/input';
import { useCustomerRoute } from '../contexts/CustomerRouteContext';

const DEFAULT_TOC_URL = '/data/toc_enhanced.xml';

interface NavNode {
  title: string | null;
  xmlHref: string | null;
  contentId: string | null;
  children: NavNode[];
}

interface TableOfContentsProps {
  /** Single TOC URL (backward compat). Ignored if tocUrls is provided. */
  tocUrl?: string | null;
  /** Multiple TOC URLs. When an article is open, the TOC that contains its contentId is shown. */
  tocUrls?: string[] | null;
  onContentClick?: (contentId: string) => void;
  currentContentId?: string | null;
  isVisible?: boolean;
  /** When true, TOC fits parent height (e.g. inside a modal) instead of 100vh */
  embedded?: boolean;
  /** Called with whether the TOC has any usable nav data, so parents can hide the panel when empty. */
  onDataLoaded?: (hasData: boolean) => void;
  /** When set, a collapse chevron is shown by the header; clicking it calls this (parent collapses the panel). */
  onCollapse?: () => void;
}


const TableOfContents = ({ tocUrl: tocUrlProp, tocUrls: tocUrlsProp, onContentClick, currentContentId, isVisible = true, embedded = false, onDataLoaded, onCollapse }: TableOfContentsProps) => {
  const { basePath } = useCustomerRoute();
  const [tree, setTree] = useState<NavNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;

  const urlList = useMemo(() => {
    if (Array.isArray(tocUrlsProp) && tocUrlsProp.length > 0) return tocUrlsProp;
    if (tocUrlProp) return [tocUrlProp];
    return [DEFAULT_TOC_URL];
  }, [tocUrlsProp, tocUrlProp]);

  // Collect all contentIds from a tree (for multi-TOC: find which TOC contains currentContentId)
  const collectContentIds = useMemo(() => {
    const collect = (node: NavNode): string[] => {
      const ids: string[] = [];
      if (node.contentId) ids.push(node.contentId);
      node.children.forEach((c) => ids.push(...collect(c)));
      return ids;
    };
    return collect;
  }, []);

  useEffect(() => {
    if (urlList.length === 1) {
      const loadXml = async () => {
        try {
          setError(null);
          const response = await fetch(urlList[0]);
          if (!response.ok) throw new Error(`Failed to load TOC data`);
          const text = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const root = xmlDoc.getElementsByTagName('nav')[0];
          if (root) setTree(parseNode(root));
          else setTree(null);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : String(err));
          setTree(null);
        }
      };
      loadXml();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const contentIdToUrl = new Map<string, string>();
        const treesByUrl = new Map<string, NavNode>();
        for (const url of urlList) {
          const response = await fetch(url);
          if (!response.ok) continue;
          const text = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const root = xmlDoc.getElementsByTagName('nav')[0];
          if (!root) continue;
          const nodeTree = parseNode(root);
          treesByUrl.set(url, nodeTree);
          collectContentIds(nodeTree).forEach((id) => {
            if (!contentIdToUrl.has(id)) contentIdToUrl.set(id, url);
          });
        }
        if (cancelled) return;
        const activeUrl = (currentContentId && contentIdToUrl.get(currentContentId)) || urlList[0];
        const activeTree = treesByUrl.get(activeUrl) ?? treesByUrl.get(urlList[0]) ?? null;
        setTree(activeTree);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setTree(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [urlList.join(','), currentContentId]);

  // Report whether the TOC has usable nav data (any node with a contentId) so parents can hide the panel.
  useEffect(() => {
    const hasData = !!tree && collectContentIds(tree).length > 0;
    onDataLoadedRef.current?.(hasData);
  }, [tree, collectContentIds]);

  // Content ID: Salesforce uses content__id; Proofpoint uses Content_ID__c or contentId (e.g. proofpoint-ws-toc)
  const getContentId = (el: Element): string | null =>
    el.getAttribute('content__id') ?? el.getAttribute('Content_ID__c') ?? el.getAttribute('contentId') ?? null;

  const parseNode = (node: Element): NavNode => ({
    title: node.getAttribute('title'),
    xmlHref: node.getAttribute('href'),
    contentId: getContentId(node),
    children: Array.from(node.children)
      .filter((child): child is Element => child.nodeName === 'nav')
      .map((child) => parseNode(child))
  });

  // Filter tree based on search query
  const filterTree = (node: NavNode, query: string): NavNode | null => {
    if (!query.trim()) return node;

    const lowerQuery = query.toLowerCase();
    const titleMatch = node.title?.toLowerCase().includes(lowerQuery) || false;
    
    // Filter children recursively
    const filteredChildren = node.children
      .map(child => filterTree(child, query))
      .filter((child): child is NavNode => child !== null);

    // Include node if title matches or if any child matches
    if (titleMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  };

  // Memoize filtered tree
  const filteredTree = useMemo(() => {
    if (!tree) return null;
    if (!searchQuery.trim()) return tree;
    return filterTree(tree, searchQuery);
  }, [tree, searchQuery]);

  const NavItem = ({ item, depth = 0 }: { item: NavNode; depth?: number }) => {
    // Local state to track if this specific branch is open
    const [isOpen, setIsOpen] = useState(depth === 0); // Root is open by default
    const hasChildren = item.children.length > 0;
    const hasContentId = !!item.contentId;
    const isCurrentPage = item.contentId === currentContentId;

    // Auto-expand if this is the current page, has the current page as a child, or if searching
    useEffect(() => {
      if (isCurrentPage || (hasChildren && item.children.some(child => 
        child.contentId === currentContentId || 
        child.children.some(grandchild => grandchild.contentId === currentContentId)
      ))) {
        setIsOpen(true);
      }
    }, [currentContentId, isCurrentPage, hasChildren, item.children]);

    // Auto-expand when searching
    useEffect(() => {
      if (searchQuery.trim() && hasChildren) {
        setIsOpen(true);
      }
    }, [searchQuery, hasChildren]);

    const handleRowClick = (e: React.MouseEvent) => {
      if (hasContentId && onContentClick) {
        e.preventDefault();
        e.stopPropagation();
        onContentClick(item.contentId!);
      } else if (hasChildren) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    const handleContentClick = (e: React.MouseEvent) => {
      if (hasContentId && item.contentId) {
        if (onContentClick) {
          e.preventDefault();
          e.stopPropagation();
          onContentClick(item.contentId);
        }
      }
    };

    const titleHref = hasContentId ? `${basePath}/article/${encodeURIComponent(item.contentId!)}` : undefined;
    const useCallback = !!onContentClick && hasContentId;

    return (
      <li style={{ listStyleType: 'none', margin: 0 }}>
        <div 
          onClick={handleRowClick}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: `10px 16px 10px ${16 + (depth * 16)}px`,
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: isCurrentPage ? '#e3f2fd' : '#f3f2f2',
            cursor: hasContentId ? 'pointer' : (hasChildren ? 'pointer' : 'not-allowed'),
            transition: 'background-color 0.2s',
            borderLeft: isCurrentPage ? '3px solid var(--theme-primary)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (hasContentId || hasChildren) {
              e.currentTarget.style.backgroundColor = isCurrentPage ? '#bbdefb' : '#e0e0e0';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isCurrentPage ? '#e3f2fd' : '#f3f2f2';
          }}
        >
          {/* Chevron Icon - toggles expand when item has children */}
          {hasChildren && (
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasChildren) setIsOpen(!isOpen); }}
              style={{ 
                marginRight: '8px', 
                fontSize: '10px', 
                color: '#706e6b',
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                display: 'inline-block',
                transition: 'transform 0.2s',
                cursor: 'pointer',
              }}
            >
              ▶
            </span>
          )}

          {titleHref && !useCallback ? (
            <Link
              to={titleHref}
              style={{ 
                textDecoration: 'none', 
                color: isCurrentPage ? 'var(--theme-primary)' : 'var(--theme-primary)', 
                fontSize: '13px',
                fontWeight: (hasChildren || isCurrentPage) ? 'bold' : 'normal',
                fontFamily: 'Salesforce Sans, Arial, sans-serif',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              {item.title}
              {isCurrentPage && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--theme-primary)', fontWeight: 'bold' }}>●</span>
              )}
            </Link>
          ) : useCallback ? (
            <button
              type="button"
              onClick={handleContentClick}
              style={{ 
                textDecoration: 'none', 
                color: isCurrentPage ? '#0176D3' : '#0070d2', 
                fontSize: '13px',
                fontWeight: (hasChildren || isCurrentPage) ? 'bold' : 'normal',
                fontFamily: 'Salesforce Sans, Arial, sans-serif',
                cursor: 'pointer',
                flex: 1,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              {item.title}
              {isCurrentPage && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: '#0176D3', fontWeight: 'bold' }}>●</span>
              )}
            </button>
          ) : (
            <span
              style={{ 
                textDecoration: 'none', 
                color: '#706e6b', 
                fontSize: '13px',
                fontWeight: hasChildren ? 'bold' : 'normal',
                fontFamily: 'Salesforce Sans, Arial, sans-serif',
                cursor: 'not-allowed',
                opacity: 0.6,
              }}
            >
              {item.title}
            </span>
          )}
        </div>

        {/* Render children only if isOpen is true */}
        {hasChildren && isOpen && (
          <ul style={{ padding: 0, margin: 0 }}>
            {item.children.map((child, index) => (
              <NavItem key={`${child.title}-${index}`} item={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  if (!isVisible) return null;
  
  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (!tree) return <div style={{ padding: '20px', backgroundColor: '#f3f2f2' }}>Loading...</div>;

  return (
    <div style={{ 
      backgroundColor: '#f3f2f2', 
      height: embedded ? '100%' : '100vh',
      maxHeight: embedded ? '100%' : '100vh',
      borderRight: '1px solid #d8dde6',
      width: '100%',
      maxWidth: embedded ? '260px' : '400px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '16px',
        borderBottom: '1px solid #d8dde6',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: '13px',
          margin: 0,
          color: '#3e3e3c',
          textTransform: 'uppercase',
          letterSpacing: '0.0625rem',
          fontWeight: 700,
        }}>
          Table of Contents
        </h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Hide contents"
            aria-label="Hide table of contents"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#706e6b',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e0e0e0'; e.currentTarget.style.color = '#3e3e3c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#706e6b'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #d8dde6',
        backgroundColor: '#ffffff',
        flexShrink: 0
      }}>
        <Input
          type="text"
          placeholder="Type to filter"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            fontSize: '13px',
            fontFamily: 'Salesforce Sans, Arial, sans-serif',
            padding: '8px 12px',
            border: '1px solid #d8dde6',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            color: '#3e3e3c'
          }}
        />
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {filteredTree ? (
          <ul style={{ padding: 0, margin: 0 }}>
            <NavItem item={filteredTree} />
          </ul>
        ) : searchQuery.trim() ? (
          <div style={{ 
            padding: '20px 16px', 
            color: '#706e6b',
            fontSize: '13px',
            fontFamily: 'Salesforce Sans, Arial, sans-serif',
            textAlign: 'center'
          }}>
            No results found
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TableOfContents;
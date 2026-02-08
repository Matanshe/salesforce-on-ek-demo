import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Input } from './ui/input';

const DEFAULT_TOC_URL = '/data/toc_enhanced.xml';

interface NavNode {
  title: string | null;
  xmlHref: string | null;
  contentId: string | null;
  children: NavNode[];
}

interface TableOfContentsProps {
  tocUrl?: string | null;
  onContentClick?: (contentId: string) => void;
  currentContentId?: string | null;
  isVisible?: boolean;
}

const TableOfContents = ({ tocUrl: tocUrlProp, onContentClick: _onContentClick, currentContentId, isVisible = true }: TableOfContentsProps) => {
  const [tree, setTree] = useState<NavNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const tocXmlUrl = tocUrlProp ?? DEFAULT_TOC_URL;

  useEffect(() => {
    const loadXml = async () => {
      try {
        setError(null);
        const response = await fetch(tocXmlUrl);
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
  }, [tocXmlUrl]);

  const parseNode = (node: Element): NavNode => ({
    title: node.getAttribute('title'),
    xmlHref: node.getAttribute('href'),
    contentId: node.getAttribute('content__id'),
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
      if (hasContentId && _onContentClick) {
        e.preventDefault();
        e.stopPropagation();
        _onContentClick(item.contentId!);
      } else if (hasChildren) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    const titleHref = hasContentId ? `/article/${encodeURIComponent(item.contentId!)}` : undefined;

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

          {titleHref ? (
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
      height: '100vh',
      maxHeight: '100vh',
      borderRight: '1px solid #d8dde6',
      width: '100%',
      maxWidth: '400px',
      display: 'flex',

      flexDirection: 'column',
      overflow: 'hidden'

    }}>
      <h2 style={{ 
        fontSize: '14px', 
        padding: '20px 16px', 
        margin: 0, 
        color: '#3e3e3c',
        textTransform: 'uppercase',
        letterSpacing: '0.0625rem',
        borderBottom: '1px solid #d8dde6',
        flexShrink: 0
      }}>
        Table of Contents
      </h2>
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
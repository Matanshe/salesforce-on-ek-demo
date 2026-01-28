import { useState, useEffect } from 'react';
// @ts-ignore: Vite's import.meta.glob ESM asset import workaround, import as URL string
const tocXmlUrl = '/data/toc_enhanced.xml';

interface NavNode {
  title: string | null;
  xmlHref: string | null;
  contentId: string | null;
  children: NavNode[];
}

const TableOfContents = () => {
  const [tree, setTree] = useState<NavNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = "https://eheart-241222-495-demo.lightning.force.com/lightning/cmp/runtime_cdp__dataHarmonizedModelObjRefRecordHome";
  const OBJECT_API_NAME = "SFDCHelp7_DMO_harmonized__dlm";

  useEffect(() => {
    const loadXml = async () => {
      try {
        const response = await fetch(tocXmlUrl);
        if (!response.ok) throw new Error(`Failed to load TOC data`);
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const root = xmlDoc.getElementsByTagName('nav')[0];
        if (root) setTree(parseNode(root));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    loadXml();
  }, []);

  const parseNode = (node: Element): NavNode => ({
    title: node.getAttribute('title'),
    xmlHref: node.getAttribute('href'),
    contentId: node.getAttribute('content__id'),
    children: Array.from(node.children)
      .filter((child): child is Element => child.nodeName === 'nav')
      .map((child) => parseNode(child))
  });

  const NavItem = ({ item, depth = 0 }: { item: NavNode; depth?: number }) => {
    // Local state to track if this specific branch is open
    const [isOpen, setIsOpen] = useState(depth === 0); // Root is open by default
    const hasChildren = item.children.length > 0;

    const finalUrl = item.contentId 
      ? `${BASE_URL}?c__contentId=${item.contentId}&c__objectApiName=${OBJECT_API_NAME}`
      : (item.xmlHref || "#");

    const toggle = (e: React.MouseEvent) => {
      if (hasChildren) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    return (
      <li style={{ listStyleType: 'none', margin: 0 }}>
        <div 
          onClick={toggle}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: `10px 16px 10px ${16 + (depth * 16)}px`,
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#f3f2f2',
            cursor: hasChildren ? 'pointer' : 'default',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0e0e0')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f3f2f2')}
        >
          {/* Chevron Icon */}
          {hasChildren && (
            <span style={{ 
              marginRight: '8px', 
              fontSize: '10px', 
              color: '#706e6b',
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
              transition: 'transform 0.2s'
            }}>
              ▶
            </span>
          )}

          <a 
            href={finalUrl}
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Prevent link click from triggering toggle
            style={{ 
              textDecoration: 'none', 
              color: '#0070d2', 
              fontSize: '13px',
              fontWeight: hasChildren ? 'bold' : 'normal',
              fontFamily: 'Salesforce Sans, Arial, sans-serif',
            }}
          >
            {item.title}
          </a>
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

  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (!tree) return <div style={{ padding: '20px', backgroundColor: '#f3f2f2' }}>Loading...</div>;

  return (
    <div style={{ 
      backgroundColor: '#f3f2f2', 
      minHeight: '100vh',
      borderRight: '1px solid #d8dde6',
      width: '100%',
      maxWidth: '400px'
    }}>
      <h2 style={{ 
        fontSize: '14px', 
        padding: '20px 16px', 
        margin: 0, 
        color: '#3e3e3c',
        textTransform: 'uppercase',
        letterSpacing: '0.0625rem',
        borderBottom: '1px solid #d8dde6'
      }}>
        Table of Contents
      </h2>
      <ul style={{ padding: 0, margin: 0 }}>
        <NavItem item={tree} />
      </ul>
    </div>
  );
};

export default TableOfContents;
/**
 * Base Node Palette Component
 * Unified design system for both Workflow and Architecture node palettes
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import './BaseNodePalette.css';

export interface NodePaletteItem {
  readonly type: string;
  readonly label: string;
  readonly icon: React.ComponentType<{
    size?: number | string;
    className?: string;
    [key: string]: unknown;
  }>;
  readonly category: string;
  readonly description?: string;
  readonly color?: string;
}

export interface BaseNodePaletteProps {
  readonly nodes: NodePaletteItem[];
  readonly onAddNode: (type: string, position?: { x: number; y: number }) => void;
  readonly categories?: string[];
  readonly enableSearch?: boolean;
  readonly enableCategoryFilter?: boolean;
  readonly className?: string;
}

export default function BaseNodePalette({
  nodes,
  onAddNode,
  categories = [],
  enableSearch = true,
  enableCategoryFilter = true,
  className = '',
}: BaseNodePaletteProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter nodes based on search and category
  const filteredNodes = useMemo(() => {
    let filtered = nodes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (node) =>
          node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        (node) => node.category === selectedCategory || node.category.startsWith(selectedCategory)
      );
    }

    return filtered;
  }, [nodes, searchTerm, selectedCategory]);

  // Group nodes by category
  const groupedNodes = useMemo(() => {
    const groups = new Map<string, NodePaletteItem[]>();

    filteredNodes.forEach((node) => {
      const category = node.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(node);
    });

    return groups;
  }, [filteredNodes]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  const handleDragStart = (e: React.DragEvent, type: string) => {
    // Primary custom MIME for modern browsers
    e.dataTransfer.setData('application/node-type', type);
    // Cross-browser fallbacks (Safari/WebKit requires a text type to enable drops)
    try {
      e.dataTransfer.setData('text/node-type', type);
      e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'node', type }));
    } catch {
      // Best-effort: ignore if browser disallows multiple types
    }
    e.dataTransfer.effectAllowed = 'copy';

    // Add visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '0.7';
    target.style.transform = 'scale(0.95)';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    target.style.transform = 'scale(1)';
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  return (
    <div className={`base-node-palette ${className}`}>
      {/* Search Bar with Category Dropdown */}
      {enableSearch && (
        <div className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
          {/* Search Input Row */}
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search nodes, components, or features..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="search-input"
            />
            {searchTerm && (
              <button onClick={clearSearch} className="clear-search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown Row */}
          {enableCategoryFilter && categories.length > 0 && (
            <div className="category-dropdown" ref={dropdownRef}>
              <button
                className="category-dropdown-trigger"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="Filter by category"
              >
                <div className="category-label">
                  <Filter size={14} />
                  <span>{selectedCategory === 'all' ? 'All Categories' : selectedCategory}</span>
                </div>
                <ChevronDown
                  size={12}
                  className={`dropdown-chevron ${isDropdownOpen ? 'open' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="category-dropdown-menu">
                  <button
                    className={`category-dropdown-item ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('all');
                      setIsDropdownOpen(false);
                    }}
                  >
                    All Categories <span className="count">({nodes.length})</span>
                  </button>

                  {categories.map((category) => {
                    const count = nodes.filter((node) => node.category === category).length;
                    if (count === 0) {
                      return null;
                    }

                    return (
                      <button
                        key={category}
                        className={`category-dropdown-item ${selectedCategory === category ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsDropdownOpen(false);
                        }}
                      >
                        {category} <span className="count">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results Info */}
      <div className="results-info">
        <span>{filteredNodes.length} nodes</span>
        {searchTerm && <span className="search-info">for &quot;{searchTerm}&quot;</span>}
        {selectedCategory !== 'all' && <span className="search-info"> in {selectedCategory}</span>}
      </div>

      {/* Node Groups */}
      <div className="node-groups">
        {groupedNodes.size === 0 ? (
          <div className="empty-state">
            <p>No nodes found</p>
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear filters
            </button>
          </div>
        ) : (
          Array.from(groupedNodes.entries()).map(([category, categoryNodes]) => (
            <div key={category} className="node-group">
              {groupedNodes.size > 1 && (
                <div className="group-header">
                  <h4 className="group-title">{category}</h4>
                  <span className="group-count">({categoryNodes.length})</span>
                </div>
              )}
              <div className="node-list">
                {categoryNodes.map((node) => {
                  const Icon = node.icon;
                  return (
                    <button
                      key={node.type}
                      className="node-item"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.type)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onAddNode(node.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAddNode(node.type);
                        }
                      }}
                      title={node.description || node.label}
                      style={
                        {
                          '--node-color': node.color || '#64748b',
                        } as React.CSSProperties
                      }
                    >
                      <div className="node-icon">
                        <Icon size={16} />
                      </div>
                      <div className="node-info">
                        <span className="node-label">{node.label}</span>
                        {node.description && (
                          <span className="node-description">{node.description}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

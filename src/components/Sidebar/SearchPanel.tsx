import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { SearchResult } from '../../../packages/core/types';
import LoadingIcon from '../icons/LoadingIcon';
import SearchIcon from '../icons/SearchIcon';
import { ElectronFileSystem } from '../../adapters/electronfileSystem';

const SearchPanel: React.FC = () => {
  const {
    searchQuery,
    searchResults,
    isSearching,
    isSearchIndexReady,
    setSearchQuery,
    performSearch,
    buildSearchIndex,
    setCurrentFile,
    addTab
  } = useAppStore();

  const fileSystem = new ElectronFileSystem();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    if (!isSearchIndexReady) {
      buildSearchIndex();
    }
  }, [isSearchIndexReady, buildSearchIndex]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localQuery.trim() !== searchQuery) {
        setSearchQuery(localQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localQuery, searchQuery, setSearchQuery]);

  useEffect(() => {
    if (searchQuery.trim() && isSearchIndexReady) {
      performSearch(searchQuery);
    } else if (!searchQuery.trim()) {
      useAppStore.getState().setSearchResults([]);
    }
  }, [searchQuery, isSearchIndexReady, performSearch]);

  const handleResultClick = async (result: SearchResult) => {
    try {
      const content = await fileSystem.readFile(result.file.path);
      const note = {
        path: result.file.path,
        name: result.file.name,
        content,
        lastModified: new Date(),
        created: new Date()
      };

      setCurrentFile(note);
      addTab(note);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search notes..."
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          className="search-input"
        />
        {isSearching && <div className="search-spinner"><LoadingIcon size={16} /></div>}
        {!isSearchIndexReady && <div className="search-spinner"><SearchIcon size={16} /> Building index...</div>}
      </div>

      <div className="search-results">
        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
          <div className="no-results">
            <p>No results found for "{searchQuery}"</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="results-list">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="search-result-item"
                onClick={() => handleResultClick(result)}
                style={{ cursor: 'pointer' }}
              >
                <div className="result-title">{result.file?.name}</div>
                <div
                  className="result-excerpt"
                  dangerouslySetInnerHTML={{ __html: result.excerpt }}
                />
                <div className="result-meta">
                  {result.matches} match{result.matches !== 1 ? 'es' : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {!searchQuery.trim() && (
          <div className="search-help">
            <p>Enter a search term to find notes</p>
            <div className="search-tips">
              <h4>Search Tips:</h4>
              <ul>
                <li>Use quotes for exact phrases</li>
                <li>Search supports #tags</li>
                <li>Use [[links]] to find linked notes</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;

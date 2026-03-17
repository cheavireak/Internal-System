import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Briefcase, FileText, X, Command } from 'lucide-react';

interface SearchResult {
  type: 'user' | 'customer' | 'log';
  id: string | number;
  title: string;
  subtitle: string;
  link: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    navigate(result.link);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={() => setIsOpen(false)}
      />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[60vh]">
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-lg"
            placeholder="Search users, customers, logs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-xs">ESC</span>
          </div>
        </div>

        <div className="overflow-y-auto p-2">
          {results.length === 0 && query.length >= 2 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found for "{query}"
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              Type at least 2 characters to search...
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-colors ${
                    index === selectedIndex 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className={`p-2 rounded-md mr-3 ${
                    result.type === 'user' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                    result.type === 'customer' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {result.type === 'user' && <User className="w-4 h-4" />}
                    {result.type === 'customer' && <Briefcase className="w-4 h-4" />}
                    {result.type === 'log' && <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</div>
                  </div>
                  {index === selectedIndex && (
                    <div className="hidden sm:block text-xs text-gray-400 ml-2">
                      Press Enter
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 flex justify-between">
          <div className="flex gap-4">
            <span><kbd className="font-sans bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">↑</kbd> <kbd className="font-sans bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">↓</kbd> to navigate</span>
            <span><kbd className="font-sans bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">↵</kbd> to select</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" /> + K
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { fetchUserDataMaps, type DataMapResult } from '../utils/prismApi';
import { FiMap, FiSearch, FiCalendar, FiCpu, FiLayers, FiArrowRight, FiEdit3, FiCheck } from 'react-icons/fi';

export interface DataMapsViewProps {
  apiBaseUrl: string;
  onOpenDataMap: (dataMap: DataMapResult) => void;
}

export const DataMapsView: React.FC<DataMapsViewProps> = ({ apiBaseUrl, onOpenDataMap }) => {
  const [dataMaps, setDataMaps] = useState<DataMapResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    fetchUserDataMaps(apiBaseUrl)
      .then((maps) => setDataMaps(maps))
      .catch((err) => console.error('Failed to load user Data Maps:', err))
      .finally(() => setLoading(false));
  }, [apiBaseUrl]);

  const filteredMaps = dataMaps.filter((map) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (map.title || '').toLowerCase().includes(q) ||
      map.taskType.toLowerCase().includes(q) ||
      (map.metadata?.taskIntent || '').toLowerCase().includes(q)
    );
  });

  const handleSaveTitle = async (mapId: string) => {
    if (!editingTitle.trim()) return;
    try {
      const token = localStorage.getItem('prism_access_token');
      const res = await fetch(`${apiBaseUrl}/api/data-map/${mapId}/title`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDataMaps((prev) => prev.map((m) => (m.id === mapId ? { ...m, title: updated.title } : m)));
      }
    } catch (err) {
      console.error('Failed to rename Data Map:', err);
    } finally {
      setEditingId(null);
    }
  };

  const getTaskTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'resume_screening':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'code_review':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'contract_analysis':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'invoice_extraction':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-in">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <FiMap className="text-indigo-400 text-xl" />
            <h2 className="text-xl font-black text-white tracking-tight">MY DATA MAPS</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Access, explore, and revisit persistent chat-scoped semantic relationship graphs
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            placeholder="Search Data Maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
      </div>

      {/* Grid of Saved Data Maps */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400 text-xs">
          <span className="loading loading-spinner loading-md text-indigo-400 mr-2" />
          <span>Loading persistent Data Maps...</span>
        </div>
      ) : filteredMaps.length === 0 ? (
        <div className="text-center py-16 text-slate-500 liquid-glass rounded-3xl p-8 border border-slate-800/60">
          <FiMap className="text-4xl text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-300">No Data Maps found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? 'No maps matched your search filter.' : 'Run a task prompt to generate your first chat-scoped Data Map.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaps.map((map) => {
            const isEditing = editingId === map.id;
            const formattedType = map.taskType.replace(/_/g, ' ').toUpperCase();
            const dateStr = map.updatedAt ? new Date(map.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent';

            return (
              <div
                key={map.id}
                className="liquid-glass rounded-2xl p-5 border border-indigo-500/20 hover:border-indigo-500/50 flex flex-col justify-between gap-4 shadow-xl transition-all duration-200 hover:-translate-y-0.5 group"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getTaskTypeBadgeColor(map.taskType)}`}>
                      {formattedType}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <FiCalendar className="text-[10px]" /> {dateStr}
                    </span>
                  </div>

                  {/* Title & Editable Name */}
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="bg-slate-900 border border-indigo-500/60 text-white text-xs font-bold px-2 py-1 rounded-lg w-full focus:outline-none"
                      />
                      <button
                        onClick={() => map.id && handleSaveTitle(map.id)}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/40"
                      >
                        <FiCheck className="text-xs" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/title">
                      <h3 className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors leading-snug line-clamp-1">
                        {map.title || formattedType}
                      </h3>
                      <button
                        onClick={() => {
                          setEditingId(map.id || null);
                          setEditingTitle(map.title || '');
                        }}
                        className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                        title="Rename Data Map"
                      >
                        <FiEdit3 className="text-xs" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-medium">
                    {map.metadata?.taskIntent || 'Semantic graph representation'}
                  </p>
                </div>

                {/* Node & Token Stats */}
                <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-white/10 text-center text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold block uppercase">Nodes</span>
                    <span className="font-extrabold text-slate-200">{map.metadata?.nodeCount || map.nodes?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block uppercase">Edges</span>
                    <span className="font-extrabold text-indigo-300">{map.metadata?.edgeCount || map.edges?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block uppercase">Tokens</span>
                    <span className="font-extrabold text-emerald-400">{(map.metadata?.estimatedContextTokens || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Open Button */}
                <button
                  type="button"
                  onClick={() => onOpenDataMap(map)}
                  className="w-full btn btn-sm bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 hover:text-white font-extrabold text-xs flex items-center justify-center gap-1.5 rounded-xl transition-all"
                >
                  <span>Open Data Map</span>
                  <FiArrowRight className="text-xs group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DataMapsView;

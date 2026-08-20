import React, { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { DataMapResult, DataMapNode, DataMapEdge } from '../utils/prismApi';
import {
  FiMap,
  FiX,
  FiMaximize2,
  FiMinimize2,
  FiSearch,
  FiFilter,
  FiInfo,
  FiCpu,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
  FiFileText,
  FiFolder,
  FiDatabase,
  FiCode,
  FiBriefcase,
  FiActivity,
  FiZap,
} from 'react-icons/fi';
import type { SemanticCacheData } from '../utils/prismApi';

export interface DataMapModalProps {
  dataMap: DataMapResult;
  /** Optional semantic cache metadata from the /generate response */
  semanticCache?: SemanticCacheData | null;
  onClose: () => void;
  onProceedToExecution?: () => void;
}

const nodeWidth = 230;
const nodeHeight = 90;

const getNodeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'root':
      return <FiZap className="text-amber-400 text-xs" />;
    case 'repository':
    case 'project':
    case 'website':
      return <FiLayers className="text-indigo-400 text-xs" />;
    case 'document':
    case 'contract':
    case 'invoice':
      return <FiFileText className="text-sky-400 text-xs" />;
    case 'folder':
    case 'directory':
      return <FiFolder className="text-purple-400 text-xs" />;
    case 'file':
    case 'function':
    case 'class':
      return <FiCode className="text-emerald-400 text-xs" />;
    case 'database':
      return <FiDatabase className="text-cyan-400 text-xs" />;
    case 'skill':
    case 'experience':
    case 'party':
    case 'vendor':
    case 'customer':
      return <FiBriefcase className="text-teal-400 text-xs" />;
    case 'requirement':
    case 'line_item':
      return <FiCheckCircle className="text-emerald-400 text-xs" />;
    case 'vulnerability':
    case 'issue':
    case 'risk':
    case 'constraint':
      return <FiAlertTriangle className="text-rose-400 text-xs" />;
    case 'clause':
    case 'page':
      return <FiFileText className="text-amber-400 text-xs" />;
    case 'finding':
    case 'analysis':
      return <FiActivity className="text-emerald-400 text-xs" />;
    case 'api':
      return <FiCpu className="text-violet-400 text-xs" />;
    default:
      return <FiActivity className="text-indigo-300 text-xs" />;
  }
};

/**
 * Custom React Flow Node Component rendering structured node content inside every node
 */
const CustomDataMapNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData: DataMapNode = data.nodeData;
  const isDimmed = data.isDimmed;

  let bgGradient = 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(2,6,23,0.98))';
  let borderColor = '#334155';
  let badgeBg = 'bg-slate-800/80 text-slate-300 border-slate-700';

  const tLower = (nodeData.type || '').toLowerCase();
  const cLower = (nodeData.category || '').toLowerCase();

  if (tLower === 'root') {
    bgGradient = 'linear-gradient(135deg, rgba(30,27,75,0.98), rgba(15,23,42,0.98))';
    borderColor = '#6366f1';
    badgeBg = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  } else if (cLower === 'candidate' || tLower === 'document' || tLower === 'repository' || tLower === 'website') {
    bgGradient = 'linear-gradient(135deg, rgba(12,74,110,0.95), rgba(2,6,23,0.98))';
    borderColor = '#38bdf8';
    badgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  } else if (tLower === 'requirement' || tLower === 'line_item' || tLower === 'analysis') {
    bgGradient = 'linear-gradient(135deg, rgba(6,78,59,0.95), rgba(2,6,23,0.98))';
    borderColor = '#10b981';
    badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (tLower === 'vulnerability' || tLower === 'issue' || tLower === 'risk' || tLower === 'constraint') {
    bgGradient = 'linear-gradient(135deg, rgba(136,19,55,0.95), rgba(2,6,23,0.98))';
    borderColor = '#f43f5e';
    badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (tLower === 'skill' || tLower === 'experience' || tLower === 'clause' || tLower === 'page') {
    bgGradient = 'linear-gradient(135deg, rgba(17,94,89,0.95), rgba(2,6,23,0.98))';
    borderColor = '#14b8a6';
    badgeBg = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  }

  return (
    <div
      className={`relative w-[230px] rounded-2xl p-3 border transition-all duration-200 shadow-xl ${
        isDimmed ? 'opacity-25' : 'opacity-100'
      }`}
      style={{
        background: bgGradient,
        borderColor: selected ? '#818cf8' : borderColor,
        borderWidth: selected ? '2px' : '1px',
        boxShadow: selected ? '0 0 25px rgba(99,102,241,0.5)' : '0 10px 25px rgba(0,0,0,0.6)',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-2.5 !h-2.5" />

      {/* Node Header: Type & Icon */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="p-1 rounded-md bg-slate-900 border border-slate-800">{getNodeIcon(nodeData.type)}</span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
            {nodeData.type}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 font-bold">
          {nodeData.tokenEstimate ? `${nodeData.tokenEstimate}t` : ''}
        </span>
      </div>

      {/* Entity Label */}
      <h4 className="text-xs font-black text-slate-100 line-clamp-2 leading-tight mb-2 min-h-[30px]" title={nodeData.label}>
        {nodeData.label}
      </h4>

      {/* Node Footer Metrics */}
      <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
        <div className="flex items-center gap-1 text-emerald-400 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Rel {Math.round(nodeData.relevanceScore * 100)}%</span>
        </div>
        <span className="text-slate-400 font-semibold">Imp {nodeData.importance || 5}/10</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-2.5 !h-2.5" />
    </div>
  );
};

const nodeTypes = {
  customDataMap: CustomDataMapNode,
};

/**
 * Automatic hierarchical layout computation using Dagre
 */
const getLayoutedElements = (nodes: DataMapNode[], edges: DataMapEdge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 90 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const flowNodes: Node[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      id: node.id,
      type: 'customDataMap',
      data: { nodeData: node },
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - nodeWidth / 2 : Math.random() * 500,
        y: nodeWithPosition ? nodeWithPosition.y - nodeHeight / 2 : Math.random() * 500,
      },
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => {
    const relUpper = (edge.relationship || '').toUpperCase();

    let strokeColor = '#6366f1';
    let strokeDasharray: string | undefined = undefined;
    let animated = false;

    if (relUpper.includes('MATCHED') || relUpper.includes('MATCHES')) {
      strokeColor = '#10b981';
      animated = true;
    } else if (relUpper.includes('MISSING') || relUpper.includes('REDUNDANT')) {
      strokeColor = '#f43f5e';
      strokeDasharray = '5,5';
    } else if (relUpper.includes('REQUIRES') || relUpper.includes('REQUIRED')) {
      strokeColor = '#38bdf8';
    } else if (relUpper.includes('HAS') || relUpper.includes('BUILT')) {
      strokeColor = '#a855f7';
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relationship.replace(/_/g, ' '),
      animated,
      style: {
        stroke: strokeColor,
        strokeWidth: 2,
        strokeDasharray,
      },
      labelStyle: {
        fill: '#cbd5e1',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: '#020617',
        fillOpacity: 0.85,
        rx: 4,
        ry: 4,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 18,
        height: 18,
      },
    };
  });

  return { flowNodes, flowEdges };
};

export const DataMapModal: React.FC<DataMapModalProps> = ({ dataMap, semanticCache, onClose, onProceedToExecution }) => {
  const { nodes = [], edges = [], metadata } = dataMap;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [relevanceFilter, setRelevanceFilter] = useState<'ALL' | 'RELEVANT' | 'IRRELEVANT' | 'HIGH' | 'LOW'>('ALL');
  const [selectedNode, setSelectedNode] = useState<DataMapNode | null>(nodes[0] || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCacheDetails, setShowCacheDetails] = useState(false);

  // Resolve cache status
  const cacheIsHit = semanticCache?.cacheHit || semanticCache?.cacheStatus === 'hit' || false;
  const cacheSimilarity = semanticCache?.similarity ?? 0;
  const cachedCtxTokens = semanticCache?.cachedContextTokens ?? 0;
  const cacheTokensAvoided = semanticCache?.cacheTokensSaved ?? 0;
  const cacheEntryId = semanticCache?.cacheEntryId || '';

  // Compute Dagre Graph Layout
  const { flowNodes: initialNodes, flowEdges: initialEdges } = useMemo(() => {
    return getLayoutedElements(nodes, edges, 'TB');
  }, [nodes, edges]);

  const [rfNodes, , onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(initialEdges);

  // Filtered React Flow Nodes & Edges
  const { displayNodes, displayEdges } = useMemo(() => {
    const filteredRawNodes = nodes.filter((n) => {
      if (relevanceFilter === 'RELEVANT' && n.relevanceScore < 0.6) return false;
      if (relevanceFilter === 'IRRELEVANT' && n.relevanceScore >= 0.6) return false;
      if (relevanceFilter === 'HIGH' && (n.importance || 0) < 8) return false;
      if (relevanceFilter === 'LOW' && (n.importance || 0) >= 8) return false;
      if (selectedCategory !== 'ALL' && n.type.toLowerCase() !== selectedCategory.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.label.toLowerCase().includes(q) ||
          (n.description || '').toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const validNodeIds = new Set(filteredRawNodes.map((n) => n.id));

    // Connected Node IDs when hovering/selecting
    const activeHighlightId = hoveredNodeId || selectedNode?.id;
    const connectedIds = new Set<string>();
    if (activeHighlightId) {
      connectedIds.add(activeHighlightId);
      edges.forEach((e) => {
        if (e.source === activeHighlightId) connectedIds.add(e.target);
        if (e.target === activeHighlightId) connectedIds.add(e.source);
      });
    }

    const styledNodes = rfNodes
      .filter((n) => validNodeIds.has(n.id))
      .map((n) => {
        const isHighlighted = activeHighlightId ? connectedIds.has(n.id) : true;
        return {
          ...n,
          data: {
            ...n.data,
            isDimmed: !isHighlighted,
          },
        };
      });

    const styledEdges = rfEdges
      .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .map((e) => {
        const isHighlighted = activeHighlightId
          ? e.source === activeHighlightId || e.target === activeHighlightId
          : true;

        return {
          ...e,
          style: {
            ...e.style,
            opacity: isHighlighted ? 1 : 0.15,
            strokeWidth: isHighlighted ? 3.5 : 1.5,
          },
        };
      });

    return { displayNodes: styledNodes, displayEdges: styledEdges };
  }, [rfNodes, rfEdges, nodes, edges, relevanceFilter, selectedCategory, searchQuery, hoveredNodeId, selectedNode]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data.nodeData);
  }, []);

  const onNodeMouseEnter = useCallback((_: any, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const availableCategories = useMemo(() => {
    const types = Array.from(new Set(nodes.map((n) => n.type)));
    return ['ALL', ...types];
  }, [nodes]);

  return (
    <div
      className={`fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 pt-20 animate-fade-in ${
        isFullscreen ? 'p-0 pt-0' : ''
      }`}
      style={{ background: 'rgba(2, 4, 18, 0.88)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className={`liquid-glass w-full flex flex-col overflow-hidden text-slate-100 font-sans shadow-2xl transition-all duration-300 ${
          isFullscreen ? 'h-full max-h-full rounded-none' : 'max-w-[88vw] xl:max-w-6xl h-[78vh] max-h-[78vh] rounded-3xl border border-indigo-500/25'
        }`}
      >
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/35 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
              <FiMap className="text-indigo-400 text-base" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-black text-white tracking-tight">PRISM DATA MAP</h2>
                <span className="text-[10px] font-extrabold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Interactive Semantic Graph
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {metadata?.taskIntent || 'Semantic relationship graph powered by Dagre auto-layout'}
              </p>
            </div>
          </div>

          {/* Metrics Bar + Cache Badge */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-4 px-4 py-1.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Nodes</span>
                <span className="font-extrabold text-white">{metadata?.nodeCount || nodes.length}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Edges</span>
                <span className="font-extrabold text-indigo-300">{metadata?.edgeCount || edges.length}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Relevance</span>
                <span className="font-extrabold text-emerald-400">{metadata?.relevancePercent || 100}%</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Context Tokens</span>
                <span className="font-extrabold text-slate-200">
                  {(metadata?.estimatedContextTokens || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Semantic Cache Status Badge */}
            {semanticCache !== undefined && (
              <button
                id="datamap-cache-badge"
                onClick={() => setShowCacheDetails((prev) => !prev)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                  cacheIsHit
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50'
                    : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-slate-800/40'
                }`}
                title="Click for Semantic Cache details"
              >
                <span>{cacheIsHit ? '✓' : '⚡'}</span>
                <span>SEMANTIC CACHE</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  cacheIsHit ? 'bg-emerald-500/25 text-emerald-200' : 'bg-slate-800 text-slate-500'
                }`}>
                  {cacheIsHit ? `${(cacheSimilarity * 100).toFixed(0)}% HIT` : 'MISS'}
                </span>
              </button>
            )}

            {/* Cache Details Popover */}
            {showCacheDetails && semanticCache && (
              <div className="absolute top-16 right-4 z-50 w-72 bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl text-xs flex flex-col gap-2 animate-fade-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">SEMANTIC CACHE DETAILS</span>
                  <button onClick={() => setShowCacheDetails(false)} className="text-slate-500 hover:text-white">
                    <FiX className="text-xs" />
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={`font-black uppercase ${cacheIsHit ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {cacheIsHit ? '✓ HIT' : '⚡ MISS'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Similarity</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {cacheSimilarity > 0 ? `${(cacheSimilarity * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cached Context</span>
                  <span className="font-mono text-sky-300">{cachedCtxTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tokens Avoided</span>
                  <span className={`font-mono font-bold ${cacheIsHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {cacheIsHit ? cacheTokensAvoided.toLocaleString() : '0'}
                  </span>
                </div>
                {cacheEntryId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entry ID</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {cacheEntryId.slice(0, 8)}…{cacheEntryId.slice(-5)}
                    </span>
                  </div>
                )}
                {!cacheIsHit && (
                  <p className="text-[10px] text-slate-500 italic border-t border-slate-800/40 pt-2">
                    New context stored — will be reused for future similar requests.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Close Data Map"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-3 border-b border-white/10 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
            <input
              type="text"
              placeholder="Search graph nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-slate-500 text-[10px] uppercase font-bold mr-1 flex items-center gap-1">
              <FiFilter className="text-xs" /> Filter:
            </span>
            {(['ALL', 'RELEVANT', 'IRRELEVANT', 'HIGH', 'LOW'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setRelevanceFilter(filterKey)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  relevanceFilter === filterKey
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
                }`}
              >
                {filterKey}
              </button>
            ))}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none"
          >
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Node Types' : cat.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Main React Flow Graph Canvas & Node Inspector Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden relative">
          <div className="lg:col-span-3 bg-slate-950 relative w-full h-full">
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#1e293b" gap={24} size={1} />
              <Controls className="bg-slate-900/90 border-slate-800 text-slate-200 fill-slate-200 rounded-xl p-1 shadow-2xl" />
              <MiniMap
                nodeColor={(n) => {
                  const data: DataMapNode = n.data?.nodeData;
                  if (data?.type === 'root') return '#6366f1';
                  if (data?.category === 'candidate') return '#38bdf8';
                  if (data?.type === 'requirement') return '#10b981';
                  return '#475569';
                }}
                className="bg-slate-950/90 border-slate-800 rounded-xl shadow-2xl"
              />
            </ReactFlow>
          </div>

          {/* Node Inspector Side Panel */}
          <div className="lg:col-span-1 border-l border-white/10 bg-slate-950/90 p-5 flex flex-col gap-4 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiInfo className="text-indigo-400 text-sm" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">NODE INSPECTOR</h3>
              </div>
              {selectedNode && (
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  {selectedNode.type}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="flex flex-col gap-4 text-xs leading-relaxed">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Entity Label</span>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">{getNodeIcon(selectedNode.type)}</span>
                    <h4 className="text-base font-extrabold text-white leading-snug">{selectedNode.label}</h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Relevance</span>
                    <span className="text-sm font-black text-emerald-400">{Math.round(selectedNode.relevanceScore * 100)}%</span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Token Estimate</span>
                    <span className="text-sm font-black text-indigo-300">{selectedNode.tokenEstimate || 0} t</span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Importance</span>
                    <span className="text-sm font-black text-amber-400">{selectedNode.importance || 5}/10</span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Context Status</span>
                    <span
                      className={`text-xs font-extrabold mt-0.5 ${
                        selectedNode.includedInContext ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {selectedNode.includedInContext ? 'Included' : 'Excluded'}
                    </span>
                  </div>
                </div>

                {selectedNode.description && (
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Description</span>
                    <p className="text-slate-300 font-medium text-xs leading-relaxed">{selectedNode.description}</p>
                  </div>
                )}

                {/* Clickable Connected Relationships */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Clickable Connected Relationships</span>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {edges
                      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge) => {
                        const isOutgoing = edge.source === selectedNode.id;
                        const targetId = isOutgoing ? edge.target : edge.source;
                        const targetNode = nodes.find((n) => n.id === targetId);

                        return (
                          <div
                            key={edge.id}
                            onClick={() => targetNode && setSelectedNode(targetNode)}
                            className="bg-slate-900/70 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 p-2 rounded-xl cursor-pointer flex items-center justify-between text-[11px] transition-colors"
                          >
                            <span className="font-semibold text-slate-200 truncate max-w-[130px]">
                              {isOutgoing ? '→ ' : '← '} {targetNode?.label || targetId}
                            </span>
                            <span className="text-[9px] font-mono text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/50">
                              {edge.relationship.replace(/_/g, ' ')}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <FiInfo className="text-3xl text-slate-700 mb-2" />
                <p className="text-xs font-semibold">Click any graph node to inspect relationships &amp; metrics.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/80 flex items-center justify-end shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline text-xs font-bold">
              Close Graph
            </button>
            {onProceedToExecution && (
              <button
                type="button"
                onClick={onProceedToExecution}
                className="btn btn-primary text-xs font-extrabold flex items-center justify-center gap-2"
              >
                <FiZap className="text-sm" />
                Proceed to Execution Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataMapModal;

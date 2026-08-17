import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  GraphNodeData,
  GraphLinkData,
  getNodeColor,
  getNodeRadius,
  createMemorySimulation,
  LEVEL_COLORS,
} from './memoryGraphLayout';
import { Simulation } from 'd3-force';
import { ZoomIn, ZoomOut, RotateCcw, Sparkles, Filter, Eye, Layers, Search } from 'lucide-react';

interface InteractiveMemoryGraphProps {
  nodes: GraphNodeData[];
  links: GraphLinkData[];
  onSelectNode?: (node: GraphNodeData | null) => void;
  selectedNodeId?: string | null;
  searchFilter?: string;
  scopeFilter?: string;
}

export const InteractiveMemoryGraph: React.FC<InteractiveMemoryGraphProps> = ({
  nodes,
  links,
  onSelectNode,
  selectedNodeId,
  searchFilter = '',
  scopeFilter = 'all',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<Simulation<GraphNodeData, GraphLinkData> | null>(null);

  const [hoveredNode, setHoveredNode] = useState<GraphNodeData | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [draggedNode, setDraggedNode] = useState<GraphNodeData | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [pulsePhase, setPulsePhase] = useState<number>(0);

  // Filter nodes based on search & scope
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (scopeFilter !== 'all' && n.scope && n.scope !== scopeFilter) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || (n.tags && n.tags.some(t => t.toLowerCase().includes(q)));
    });
  }, [nodes, searchFilter, scopeFilter]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => {
    return links.filter((l) => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });
  }, [links, filteredNodeIds]);

  // Initialize and run d3-force simulation
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Deep clone nodes & links to avoid mutation conflict across renders
    const simNodes: GraphNodeData[] = filteredNodes.map((n) => ({ ...n }));
    const simLinks: GraphLinkData[] = filteredLinks.map((l) => ({ ...l }));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = createMemorySimulation(simNodes, simLinks, width, height);
    simulationRef.current = sim;

    sim.alpha(0.8).restart();

    return () => {
      sim.stop();
    };
  }, [filteredNodes.length, filteredLinks.length]);

  // Main Render Loop (60FPS Canvas Animation)
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Apply Pan & Zoom Transform
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      const simNodes = simulationRef.current?.nodes() || filteredNodes;
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      // 1. Draw Links / Edges
      for (const link of filteredLinks) {
        const sourceNode = typeof link.source === 'object' ? link.source : nodeMap.get(link.source as string);
        const targetNode = typeof link.target === 'object' ? link.target : nodeMap.get(link.target as string);

        if (!sourceNode || !targetNode || sourceNode.x == null || sourceNode.y == null || targetNode.x == null || targetNode.y == null) {
          continue;
        }

        const isHighlighted =
          hoveredNode && (hoveredNode.id === sourceNode.id || hoveredNode.id === targetNode.id);

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.8)' : 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();

        // Draw animated energy pulse on highlighted or root links
        if (isHighlighted || sourceNode.kind === 'root') {
          const t = ((Date.now() / 1500) % 1);
          const px = sourceNode.x + (targetNode.x - sourceNode.x) * t;
          const py = sourceNode.y + (targetNode.y - sourceNode.y) * t;

          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#06B6D4';
          ctx.fill();
        }
      }

      // 2. Draw Nodes
      for (const node of simNodes) {
        if (node.x == null || node.y == null) continue;

        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNodeId === node.id;
        const color = getNodeColor(node);
        const radius = getNodeRadius(node);

        // Glowing Halo Effect
        if (isHovered || isSelected || node.kind === 'root') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (isHovered ? 8 : 4), 0, 2 * Math.PI);
          ctx.fillStyle = isSelected
            ? 'rgba(6, 182, 212, 0.4)'
            : isHovered
            ? 'rgba(245, 158, 11, 0.35)'
            : 'rgba(139, 92, 246, 0.25)';
          ctx.fill();
        }

        // Inner Disc
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // Node Title Labels
        if (showLabels || isHovered || isSelected || node.kind === 'root' || node.kind === 'source') {
          ctx.font = isHovered || isSelected ? 'bold 11px system-ui, sans-serif' : '10px system-ui, sans-serif';
          ctx.fillStyle = isHovered || isSelected ? '#F8FAFC' : 'rgba(203, 213, 225, 0.75)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const labelText = node.title.length > 20 ? `${node.title.slice(0, 18)}..` : node.title;
          ctx.fillText(labelText, node.x, node.y + radius + 4);
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [filteredNodes, filteredLinks, hoveredNode, selectedNodeId, zoom, pan, showLabels]);

  // Window Resize Listener
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hit-Testing: Convert mouse coordinate to world simulation coordinate
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const wx = (sx - (canvas.width / 2 + pan.x)) / zoom + canvas.width / 2;
      const wy = (sy - (canvas.height / 2 + pan.y)) / zoom + canvas.height / 2;
      return { x: wx, y: wy };
    },
    [zoom, pan]
  );

  const findNodeAtPosition = useCallback(
    (worldX: number, worldY: number): GraphNodeData | null => {
      const simNodes = simulationRef.current?.nodes() || filteredNodes;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (n.x == null || n.y == null) continue;
        const r = getNodeRadius(n) + 4;
        const dx = worldX - n.x;
        const dy = worldY - n.y;
        if (dx * dx + dy * dy <= r * r) {
          return n;
        }
      }
      return null;
    },
    [filteredNodes]
  );

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAtPosition(worldPos.x, worldPos.y);

    if (node) {
      setDraggedNode(node);
      node.fx = node.x;
      node.fy = node.y;
      simulationRef.current?.alphaTarget(0.3).restart();
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (draggedNode) {
      draggedNode.fx = worldPos.x;
      draggedNode.fy = worldPos.y;
    } else if (isDraggingCanvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else {
      const node = findNodeAtPosition(worldPos.x, worldPos.y);
      setHoveredNode(node);
    }
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      draggedNode.fx = null;
      draggedNode.fy = null;
      setDraggedNode(null);
      simulationRef.current?.alphaTarget(0);
    }
    setIsDraggingCanvas(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAtPosition(worldPos.x, worldPos.y);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.1, Math.min(4.0, prev * zoomFactor)));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    simulationRef.current?.alpha(0.5).restart();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[480px] bg-slate-950/80 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl backdrop-blur-xl">
      {/* Floating Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Control HUD Bar */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/90 border border-slate-700/60 rounded-xl p-1.5 shadow-lg backdrop-blur-md z-10">
        <button
          onClick={() => setZoom((z) => Math.min(4.0, z * 1.2))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 rounded-lg transition-colors"
          title="Recenter View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-700/80 my-auto" />
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            showLabels ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Labels
        </button>
      </div>

      {/* Graph Metrics Overlay */}
      <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-md text-xs text-slate-300 flex items-center gap-4 z-10">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Nodes: <strong className="text-white font-mono">{filteredNodes.length}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span>Edges: <strong className="text-white font-mono">{filteredLinks.length}</strong></span>
        </div>
        <div className="text-slate-400 font-mono">{(zoom * 100).toFixed(0)}% zoom</div>
      </div>

      {/* Tooltip on Hover */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-slate-900/95 border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs z-20 transition-all duration-75"
          style={{
            left: Math.min(window.innerWidth - 300, (hoveredNode.x ?? 0) * zoom + pan.x + 20),
            top: Math.max(20, (hoveredNode.y ?? 0) * zoom + pan.y - 20),
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${getNodeColor(hoveredNode)}30`, color: getNodeColor(hoveredNode) }}
            >
              {hoveredNode.kind}
            </span>
            {hoveredNode.importance && (
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                ⭐ {(hoveredNode.importance * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white truncate">{hoveredNode.title}</h4>
          <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-relaxed">{hoveredNode.content}</p>
          {hoveredNode.tags && hoveredNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hoveredNode.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

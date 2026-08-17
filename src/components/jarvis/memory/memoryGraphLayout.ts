import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

export interface GraphNodeData extends SimulationNodeDatum {
  id: string;
  title: string;
  content: string;
  kind: 'root' | 'source' | 'summary' | 'fact' | 'decision' | 'preference' | 'pattern' | 'system' | 'chunk' | 'contact';
  tier?: 'ephemeral' | 'working' | 'persistent';
  level?: number;
  scope?: string;
  importance?: number;
  tags?: string[];
  links?: string[];
  color?: string;
  radius?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLinkData extends SimulationLinkDatum<GraphNodeData> {
  source: string | GraphNodeData;
  target: string | GraphNodeData;
  kind?: string;
  strength?: number;
}

/**
 * OpenHuman Level Palette — each tree level lights up with its own vibrant hue
 */
export const LEVEL_COLORS = [
  '#8B5CF6', // L0: Master Hub / Violet Purple
  '#3B82F6', // L1: Executive Blue
  '#06B6D4', // L2: Cyan Knowledge Core
  '#10B981', // L3: Emerald Fact
  '#F59E0B', // L4: Amber Decision
  '#EF4444', // L5: Rose Security
  '#EC4899', // L6: Pink Pattern
];

export const ROOT_COLOR = '#8B5CF6'; // Purple
export const SOURCE_COLOR = '#F97316'; // Vibrant Orange
export const LEAF_COLOR = '#94A3B8'; // Slate
export const CONTACT_COLOR = '#A78BFA'; // Lavender

export function getNodeColor(node: GraphNodeData): string {
  if (node.color) return node.color;
  if (node.kind === 'root') return ROOT_COLOR;
  if (node.kind === 'source') return SOURCE_COLOR;
  if (node.kind === 'decision') return '#F59E0B'; // Amber
  if (node.kind === 'preference') return '#EC4899'; // Pink
  if (node.kind === 'pattern') return '#10B981'; // Emerald
  if (node.kind === 'system') return '#EF4444'; // Red
  if (node.kind === 'summary' || node.level !== undefined) {
    const lvl = node.level ?? 1;
    return LEVEL_COLORS[Math.max(0, lvl) % LEVEL_COLORS.length];
  }
  return '#06B6D4'; // Cyan default for facts
}

export function getNodeRadius(node: GraphNodeData): number {
  if (node.radius) return node.radius;
  if (node.kind === 'root') return 22;
  if (node.kind === 'source') return 16;
  if (node.kind === 'summary') {
    const lvl = node.level ?? 1;
    return Math.min(6 + lvl * 2.5, 15);
  }
  const importance = node.importance ?? 0.7;
  return Math.max(6, Math.min(14, 6 + importance * 8));
}

export function createMemorySimulation(
  nodes: GraphNodeData[],
  links: GraphLinkData[],
  width: number = 800,
  height: number = 600
): Simulation<GraphNodeData, GraphLinkData> {
  const sim = forceSimulation<GraphNodeData, GraphLinkData>(nodes)
    .force(
      'link',
      forceLink<GraphNodeData, GraphLinkData>(links)
        .id((d) => d.id)
        .distance((l) => (l.strength ? 40 / l.strength : 60))
        .strength((l) => l.strength ?? 0.5)
    )
    .force('charge', forceManyBody<GraphNodeData>().strength(-120).distanceMax(500))
    .force('collide', forceCollide<GraphNodeData>().radius((d) => getNodeRadius(d) + 4).iterations(2))
    .force('center', forceCenter<GraphNodeData>(width / 2, height / 2));

  return sim;
}

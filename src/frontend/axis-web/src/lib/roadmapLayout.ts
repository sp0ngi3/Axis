import type { RoadmapItem, RoadmapLayoutDirection } from '../types';

export type RoadmapGraphNode = {
  item: RoadmapItem;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
};

export type RoadmapGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
};

export type RoadmapGraphLayout = {
  width: number;
  height: number;
  nodes: RoadmapGraphNode[];
  edges: RoadmapGraphEdge[];
};

const nodeWidth = 220;
const nodeHeight = 112;
const laneGap = 44;
const levelGap = 132;
const padding = 64;

export function layoutRoadmap(items: RoadmapItem[], direction: RoadmapLayoutDirection): RoadmapGraphLayout {
  if (items.length === 0) {
    return { width: 560, height: 360, nodes: [], edges: [] };
  }

  const ordered = [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
  const itemIds = new Set(ordered.map((item) => item.id));
  const dependencies = new Map(ordered.map((item) => [
    item.id,
    (item.dependencyIds ?? []).filter((id) => itemIds.has(id) && id !== item.id)
  ]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(ordered.map((item) => [item.id, dependencies.get(item.id)?.length ?? 0]));

  for (const item of ordered) {
    for (const dependencyId of dependencies.get(item.id) ?? []) {
      outgoing.set(dependencyId, [...(outgoing.get(dependencyId) ?? []), item.id]);
    }
  }

  const levels = new Map<string, number>();
  const queue = ordered.filter((item) => indegree.get(item.id) === 0);
  for (const item of queue) levels.set(item.id, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const targetId of outgoing.get(current.id) ?? []) {
      levels.set(targetId, Math.max(levels.get(targetId) ?? 0, (levels.get(current.id) ?? 0) + 1));
      const nextIndegree = (indegree.get(targetId) ?? 1) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        const target = ordered.find((item) => item.id === targetId);
        if (target) queue.push(target);
      }
    }
  }

  let fallbackLevel = Math.max(0, ...levels.values()) + 1;
  for (const item of ordered) {
    if (!levels.has(item.id)) {
      levels.set(item.id, fallbackLevel);
      fallbackLevel += 1;
    }
  }

  const groups = new Map<number, RoadmapItem[]>();
  for (const item of ordered) {
    const level = levels.get(item.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), item]);
  }

  const maxLevel = Math.max(...groups.keys());
  const maxLaneCount = Math.max(...[...groups.values()].map((group) => group.length));
  const crossNodeSize = direction === 'Vertical' ? nodeWidth : nodeHeight;
  const primaryNodeSize = direction === 'Vertical' ? nodeHeight : nodeWidth;
  const crossAxisSize = maxLaneCount * crossNodeSize + Math.max(0, maxLaneCount - 1) * laneGap;
  const nodes: RoadmapGraphNode[] = [];

  for (const [level, group] of [...groups.entries()].sort(([left], [right]) => left - right)) {
    const groupSize = group.length * crossNodeSize + Math.max(0, group.length - 1) * laneGap;
    const crossOffset = padding + (crossAxisSize - groupSize) / 2;
    group.forEach((item, lane) => {
      const levelPosition = padding + level * (primaryNodeSize + levelGap);
      const lanePosition = crossOffset + lane * (crossNodeSize + laneGap);
      nodes.push({
        item,
        x: direction === 'Vertical' ? lanePosition : levelPosition,
        y: direction === 'Vertical' ? levelPosition : lanePosition,
        width: nodeWidth,
        height: nodeHeight,
        level
      });
    });
  }

  const byId = new Map(nodes.map((node) => [node.item.id, node]));
  const edges: RoadmapGraphEdge[] = [];
  for (const target of nodes) {
    for (const sourceId of dependencies.get(target.item.id) ?? []) {
      const source = byId.get(sourceId);
      if (!source) continue;
      edges.push({
        id: `${sourceId}-${target.item.id}`,
        sourceId,
        targetId: target.item.id,
        path: connectorPath(source, target, direction)
      });
    }
  }

  const primarySize = (maxLevel + 1) * primaryNodeSize + maxLevel * levelGap;
  return {
    width: direction === 'Vertical' ? crossAxisSize + padding * 2 : primarySize + padding * 2,
    height: direction === 'Vertical' ? primarySize + padding * 2 : crossAxisSize + padding * 2,
    nodes,
    edges
  };
}

function connectorPath(source: RoadmapGraphNode, target: RoadmapGraphNode, direction: RoadmapLayoutDirection) {
  if (direction === 'Vertical') {
    const startX = source.x + source.width / 2;
    const startY = source.y + source.height;
    const endX = target.x + target.width / 2;
    const endY = target.y;
    const bendY = startY + (endY - startY) / 2;
    return `M ${startX} ${startY} C ${startX} ${bendY}, ${endX} ${bendY}, ${endX} ${endY}`;
  }

  const startX = source.x + source.width;
  const startY = source.y + source.height / 2;
  const endX = target.x;
  const endY = target.y + target.height / 2;
  const bendX = startX + (endX - startX) / 2;
  return `M ${startX} ${startY} C ${bendX} ${startY}, ${bendX} ${endY}, ${endX} ${endY}`;
}

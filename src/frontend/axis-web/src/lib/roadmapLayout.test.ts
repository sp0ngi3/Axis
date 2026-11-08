import { describe, expect, it } from 'vitest';
import { layoutRoadmap } from './roadmapLayout';
import type { RoadmapItem } from '../types';

function item(id: string, dependencyIds: string[], sortOrder: number): RoadmapItem {
  return {
    id,
    roadmapId: 'roadmap',
    title: id,
    description: '',
    status: 'Planned',
    sortOrder,
    dependencyIds,
    createdAt: `2026-01-0${sortOrder + 1}T00:00:00Z`,
    updatedAt: `2026-01-0${sortOrder + 1}T00:00:00Z`
  };
}

describe('layoutRoadmap', () => {
  const graph = [
    item('root', [], 0),
    item('left', ['root'], 1),
    item('right', ['root'], 2),
    item('merge', ['left', 'right'], 3)
  ];

  it('lays branches and merges from top to bottom', () => {
    const layout = layoutRoadmap(graph, 'Vertical');
    const nodes = new Map(layout.nodes.map((node) => [node.item.id, node]));

    expect(nodes.get('root')?.level).toBe(0);
    expect(nodes.get('left')?.level).toBe(1);
    expect(nodes.get('right')?.level).toBe(1);
    expect(nodes.get('merge')?.level).toBe(2);
    expect(nodes.get('root')!.y).toBeLessThan(nodes.get('left')!.y);
    expect(nodes.get('left')!.y - (nodes.get('root')!.y + nodes.get('root')!.height)).toBeGreaterThan(100);
    expect(nodes.get('left')!.x).not.toBe(nodes.get('right')!.x);
    expect(layout.edges).toHaveLength(4);
  });

  it('rotates the same graph from left to right', () => {
    const layout = layoutRoadmap(graph, 'Horizontal');
    const nodes = new Map(layout.nodes.map((node) => [node.item.id, node]));

    expect(nodes.get('root')!.x).toBeLessThan(nodes.get('left')!.x);
    expect(nodes.get('left')!.x - (nodes.get('root')!.x + nodes.get('root')!.width)).toBeGreaterThan(100);
    expect(nodes.get('left')!.y).not.toBe(nodes.get('right')!.y);
    expect(nodes.get('merge')!.x).toBeGreaterThan(nodes.get('right')!.x);
  });
});

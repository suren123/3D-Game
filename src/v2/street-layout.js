// Babylon's glTF AUTO conversion composes a Y half-turn with scaleZ=-1:
// source X is reflected, while source Z stays unchanged. Actual loaded meshes
// therefore open: end -X, rounded bend +X/+Z, T +X/-X/+Z.
// Directions are clockwise in world X/Z: east, south, west, north.
// Original asphalt spans 80% of a tile. 3.75 preserves the existing 3m lane
// width, including the conservative longest-vehicle footprint through turns.
export const STREET_WIDTH = 3.75;
// Source asphalt Y=.01, curb Y=.02. Asphalt reaches the unchanged car Y=.2.
export const STREET_Y = .2 - STREET_WIDTH * .01;
const templates = [
  {id: 'street-road-end', directions: [2]},
  {id: 'street-road-straight', directions: [0, 2]},
  {id: 'street-road-corner', directions: [0, 1]},
  {id: 'street-road-t', directions: [0, 1, 2]},
  {id: 'street-road-cross', directions: [0, 1, 2, 3]},
];
const mask = directions => directions.reduce((value, direction) => value | (1 << direction), 0);
const direction = (a, b) => b.x > a.x ? 0 : b.z > a.z ? 1 : b.x < a.x ? 2 : 3;

/** Create non-overlapping, edge-aligned original Kenney road placements.
 * Each node reserves a width×width tile. Edge pieces fill only the gap between
 * those reserved squares; authored 10.5/11m block spacings close exactly.
 * An absent map edge never creates a road opening or a connecting edge piece.
 */
export function planStreets(map, {width = STREET_WIDTH, y = STREET_Y} = {}) {
  const nodes = new Map(map.nodes.map(node => [node.id, node]));
  const links = new Map(map.nodes.map(node => [node.id, new Set()]));
  const edges = [], seen = new Set();
  for (const [aId, bId] of map.edges) {
    const a = nodes.get(aId), b = nodes.get(bId);
    if (!a || !b || a === b) continue;
    const key = [aId, bId].sort().join(':');
    if (seen.has(key)) continue;
    if ((a.x === b.x) === (a.z === b.z)) throw new Error('Street edges must be orthogonal and nonzero');
    if (Math.hypot(b.x-a.x, b.z-a.z) < width) throw new Error('Street nodes are closer than the road width');
    seen.add(key); edges.push([a, b]);
    links.get(aId).add(direction(a, b)); links.get(bId).add(direction(b, a));
  }
  const pieces = [];
  for (const node of map.nodes) {
    const directions = [...links.get(node.id)], target = mask(directions);
    if (!target) continue;
    let placement;
    for (const template of templates) {
      for (let quarter = 0; quarter < 4; quarter++) {
        if (mask(template.directions.map(value => (value + quarter) % 4)) === target) {
          placement = {id: template.id, rotation: -quarter * Math.PI / 2}; break;
        }
      }
      if (placement) break;
    }
    pieces.push({...placement, kind: 'node', nodeId: node.id, directions,
      position: [node.x, y, node.z], scale: [width, width, width]});
  }
  for (const [a, b] of edges) {
    const length = Math.hypot(b.x-a.x, b.z-a.z), gap = length-width;
    const count = Math.ceil(gap/width), pieceLength = count ? gap/count : 0;
    const dx = (b.x-a.x)/length, dz = (b.z-a.z)/length;
    for (let index = 0; index < count; index++) {
      const distance = width/2 + pieceLength*(index+.5);
      pieces.push({id: 'street-road-straight', kind: 'edge', edge: [a.id, b.id],
        position: [a.x+dx*distance, y, a.z+dz*distance],
        scale: [pieceLength, width, width], rotation: -Math.atan2(dz, dx)});
    }
  }
  return pieces;
}

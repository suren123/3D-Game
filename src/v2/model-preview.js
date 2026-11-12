import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MODEL_CATALOG } from './model-catalog.js';

// Shares the actual preloaded containers and materials. The world owns camera,
// lighting, map visibility, pause state and rendering; this owns one clone only.
export function createModelPreview(scene, { assets } = {}) {
  const lookup = id => assets instanceof Map ? assets.get(id) : assets?.[id];
  let current = null;
  let disposed = false;
  const point = vector => ({ x: vector.x, y: vector.y, z: vector.z });

  function measure(wrapper) {
    wrapper.computeWorldMatrix(true);
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let meshCount = 0;
    for (const mesh of wrapper.getChildMeshes()) {
      if (!mesh.getTotalVertices()) continue;
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, box.minimumWorld);
      max = Vector3.Maximize(max, box.maximumWorld);
      meshCount++;
    }
    if (!meshCount) throw new Error('Preview model contains no geometry');
    const size = max.subtract(min), center = min.add(max).scale(.5);
    const largestDimension = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(largestDimension) || largestDimension <= 0) throw new Error('Preview model has invalid bounds');
    return { min: point(min), max: point(max), size: point(size), center: point(center),
      width: size.x, height: size.y, depth: size.z, largestDimension, meshCount };
  }

  function hide() {
    if (!current) return;
    const old = current;
    current = null;
    // InstantiatedEntries disposes its clone nodes/skeletons/animation groups;
    // shared source materials and textures stay owned by the preload registry.
    old.instance.dispose();
    old.wrapper.dispose(false, false);
  }

  function getState() {
    return { id: current?.id ?? null, active: !!current, info: current?.info ?? null,
      meshCount: current?.bounds.meshCount ?? 0 };
  }

  function show(id) {
    if (disposed) throw new Error('Model preview has been disposed');
    if (current?.id === id) return getState();
    const info = MODEL_CATALOG.find(item => item.id === id);
    const container = lookup(id);
    if (!info || !container) throw new Error(`Missing preloaded preview model: ${id}`);
    const instance = container.instantiateModelsToScene(name => `model-preview:${id}:${name}`, false, { doNotInstantiate: true });
    const wrapper = new TransformNode(`model-preview:${id}`, scene);
    try {
      wrapper.metadata = { modelPreview: true, modelId: id };
      for (const root of instance.rootNodes) root.parent = wrapper;
      for (const group of instance.animationGroups) group.stop();
      for (const mesh of wrapper.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { ...mesh.metadata, modelPreview: true, modelId: id };
      }
      const original = measure(wrapper), scale = 6 / original.largestDimension;
      wrapper.scaling.setAll(scale);
      wrapper.position.set(-original.center.x * scale, -original.min.y * scale, -original.center.z * scale);
      const bounds = measure(wrapper);
      hide();
      current = { id, info, instance, wrapper, bounds };
      return getState();
    } catch (error) {
      instance.dispose();
      wrapper.dispose(false, false);
      throw error;
    }
  }

  return {
    show, hide, getState,
    getBounds() {
      if (!current) return null;
      const { min, max, size, center, ...rest } = current.bounds;
      return { ...rest, min: { ...min }, max: { ...max }, size: { ...size }, center: { ...center } };
    },
    dispose() { hide(); disposed = true; },
  };
}

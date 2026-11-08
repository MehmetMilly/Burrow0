import * as THREE from 'three';
export const colors = { sand: 0xdba875, light: 0xffe5b4, rust: 0xa84e34, ink: 0x243e47, blue: 0x41636a, ivory: 0xf6dfb3, dark: 0x17282e, coral: 0xed7749, olive: 0x687363 };
const materials = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, roughness = .82, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key)!;
}
export const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  ico: new THREE.IcosahedronGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 8),
};
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, position: [number, number, number], scale: [number, number, number], rotation?: [number, number, number]) {
  const o = new THREE.Mesh(geometry, mat(color)); o.position.set(...position); o.scale.set(...scale);
  if (rotation) o.rotation.set(...rotation);
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}

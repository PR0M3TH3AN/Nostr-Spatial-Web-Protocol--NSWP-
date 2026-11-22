// A tiny VRM, built here in code so no file has to be fetched or licensed: a box one metre tall, skinned to two
// joints (hips and head, named as VRM's humanoid names them), with two morph targets, saying it requires VRMC_vrm.
// `springBones` adds VRM's spring bones to what it requires, which a look may never.

const f32 = (xs: number[]) => new Uint8Array(new Float32Array(xs).buffer);
const u16 = (xs: number[]) => new Uint8Array(new Uint16Array(xs).buffer);
const u8 = (xs: number[]) => new Uint8Array(xs);

export function tinyVrm(o: { springBones?: boolean; height?: number; vrm0?: boolean } = {}): Uint8Array {
  const h = o.height ?? 1;
  const positions = [-0.25, 0, -0.15, 0.25, 0, -0.15, 0.25, h, -0.15, -0.25, h, -0.15, -0.25, 0, 0.15, 0.25, 0, 0.15, 0.25, h, 0.15, -0.25, h, 0.15];
  const indices = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 4, 0, 1, 5, 3, 6, 2, 3, 7, 6, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  // The bottom four vertices follow the hips, the top four the head.
  const joints = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const weights = Array.from({ length: 8 }, () => [1, 0, 0, 0]).flat();
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inverseBind = [...identity, ...[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.8 * h, 0, 1]];
  const smile = Array.from({ length: 8 }, (_, i) => (i === 2 || i === 3 ? [0, 0.02, 0] : [0, 0, 0])).flat();
  const blink = Array.from({ length: 8 }, (_, i) => (i === 6 || i === 7 ? [0, -0.02, 0] : [0, 0, 0])).flat();
  const parts = [f32(positions), u16(indices), u8(joints), f32(weights), f32(inverseBind), f32(smile), f32(blink)];
  const views: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  let at = 0;
  for (const p of parts) {
    views.push({ buffer: 0, byteOffset: at, byteLength: p.length });
    at += p.length + ((4 - (p.length % 4)) % 4);
  }
  const bin = new Uint8Array(at);
  parts.forEach((p, i) => bin.set(p, views[i]!.byteOffset));
  const required = ["VRMC_vrm", ...(o.springBones ? ["VRMC_springBone"] : [])];
  const json = {
    asset: { version: "2.0", generator: "nswp test: tiny-vrm" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "root", children: [1, 2] }, { name: "body", mesh: 0, skin: 0 }, { name: "hips", translation: [0, 0, 0], children: [3] }, { name: "head", translation: [0, 0.8 * h, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 2, WEIGHTS_0: 3 }, indices: 1, material: 0, targets: [{ POSITION: 5 }, { POSITION: 6 }] }], extras: { targetNames: ["happy", "blink"] } }],
    materials: [{ name: "skin", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.5, 0.4, 1] } }],
    skins: [{ joints: [2, 3], inverseBindMatrices: 4 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-0.25, 0, -0.15], max: [0.25, h, 0.15] },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
      { bufferView: 2, componentType: 5121, count: 8, type: "VEC4" },
      { bufferView: 3, componentType: 5126, count: 8, type: "VEC4" },
      { bufferView: 4, componentType: 5126, count: 2, type: "MAT4" },
      { bufferView: 5, componentType: 5126, count: 8, type: "VEC3", min: [0, 0, 0], max: [0, 0.02, 0] },
      { bufferView: 6, componentType: 5126, count: 8, type: "VEC3", min: [0, -0.02, 0], max: [0, 0, 0] },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
    extensionsUsed: o.vrm0 ? ["VRM"] : required,
    ...(o.vrm0 ? {} : { extensionsRequired: required }),
    extensions: o.vrm0
      ? { VRM: { specVersion: "0.0", humanoid: { humanBones: [{ bone: "hips", node: 2 }, { bone: "head", node: 3 }] } } }
      : { VRMC_vrm: { specVersion: "1.0", meta: { name: "Tiny", authors: ["nswp tests"], licenseUrl: "https://vrm.dev/licenses/1.0/" }, humanoid: { humanBones: { hips: { node: 2 }, head: { node: 3 } } }, expressions: { preset: { happy: { morphTargetBinds: [{ node: 1, index: 0, weight: 1 }] }, blink: { morphTargetBinds: [{ node: 1, index: 1, weight: 1 }] } } } } },
  };
  const text = new TextEncoder().encode(JSON.stringify(json));
  const head = new Uint8Array(text.length + ((4 - (text.length % 4)) % 4)).fill(0x20);
  head.set(text);
  const out = new Uint8Array(12 + 8 + head.length + 8 + bin.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, head.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(head, 20);
  v.setUint32(20 + head.length, bin.length, true);
  v.setUint32(24 + head.length, 0x004e4942, true);
  out.set(bin, 28 + head.length);
  return out;
}

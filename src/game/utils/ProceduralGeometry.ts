import * as THREE from 'three';

function canvasTex(draw: (c: CanvasRenderingContext2D, s: number) => void, repeat: [number, number], size = 256): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(c: CanvasRenderingContext2D, s: number, n: number, dark = 0.12, light = 0.08) {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    c.fillStyle = v > 0.5 ? `rgba(255,255,255,${Math.random() * light})` : `rgba(0,0,0,${Math.random() * dark})`;
    c.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

const drawDeck = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#8a6a49'; c.fillRect(0, 0, s, s);
  const plank = s / 6;
  for (let i = 0; i < 6; i++) {
    c.fillStyle = `hsl(${28 + Math.random() * 8}, ${34 + Math.random() * 10}%, ${36 + Math.random() * 10}%)`;
    c.fillRect(0, i * plank, s, plank - 2);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(0, i * plank + plank - 2, s, 2);
    for (let g = 0; g < 5; g++) {
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(Math.random() * s, i * plank + Math.random() * plank, 20 + Math.random() * 40, 1);
    }
  }
  speckle(c, s, 300);
};

const drawMetal = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#8d97a1'; c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3;
  c.strokeRect(2, 2, s / 2 - 4, s / 2 - 4); c.strokeRect(s / 2 + 2, 2, s / 2 - 4, s / 2 - 4);
  c.strokeRect(2, s / 2 + 2, s / 2 - 4, s / 2 - 4); c.strokeRect(s / 2 + 2, s / 2 + 2, s / 2 - 4, s / 2 - 4);
  c.fillStyle = 'rgba(30,35,40,0.8)';
  for (const [x, y] of [[14, 14], [s / 2 - 14, 14], [14, s / 2 - 14], [s / 2 - 14, s / 2 - 14],
    [s / 2 + 14, 14], [s - 14, 14], [s / 2 + 14, s / 2 - 14], [s - 14, s / 2 - 14],
    [14, s / 2 + 14], [s / 2 - 14, s / 2 + 14], [14, s - 14], [s / 2 - 14, s - 14],
    [s / 2 + 14, s / 2 + 14], [s - 14, s / 2 + 14], [s / 2 + 14, s - 14], [s - 14, s - 14]]) {
    c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
  }
  speckle(c, s, 200);
};

const drawWall = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#ddd4c4'; c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(90,80,60,0.4)'; c.lineWidth = 4;
  c.strokeRect(4, 4, s - 8, s - 8);
  c.fillStyle = 'rgba(0,0,0,0.06)';
  c.fillRect(s / 2 - 3, 0, 6, s);
  speckle(c, s, 150, 0.06, 0.05);
};

const drawPool = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#7fd0e4'; c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 4;
  const t = s / 4;
  for (let i = 0; i <= 4; i++) {
    c.beginPath(); c.moveTo(i * t, 0); c.lineTo(i * t, s); c.stroke();
    c.beginPath(); c.moveTo(0, i * t); c.lineTo(s, i * t); c.stroke();
  }
  speckle(c, s, 120, 0.05, 0.1);
};

const drawWater = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#2f9bc8'; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) {
    c.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`;
    c.beginPath();
    c.ellipse(Math.random() * s, Math.random() * s, 8 + Math.random() * 30, 3 + Math.random() * 8, Math.random(), 0, Math.PI * 2);
    c.fill();
  }
};

const drawOcean = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#22639c'; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.08})`;
    c.fillRect(Math.random() * s, Math.random() * s, 10 + Math.random() * 50, 2);
  }
};

const drawHeli = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#3a3f45'; c.fillRect(0, 0, s, s);
  speckle(c, s, 700, 0.2, 0.1);
  c.strokeStyle = '#e8b23a'; c.lineWidth = s * 0.045;
  c.beginPath(); c.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); c.stroke();
  c.lineWidth = s * 0.07;
  c.beginPath();
  c.moveTo(s * 0.36, s * 0.28); c.lineTo(s * 0.36, s * 0.72);
  c.moveTo(s * 0.64, s * 0.28); c.lineTo(s * 0.64, s * 0.72);
  c.moveTo(s * 0.36, s * 0.5); c.lineTo(s * 0.64, s * 0.5);
  c.stroke();
};

const drawHull = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#e8ecef'; c.fillRect(0, 0, s, s);
  speckle(c, s, 120, 0.04, 0.06);
  c.fillStyle = 'rgba(120,140,160,0.15)';
  for (let i = 0; i < 5; i++) c.fillRect(0, Math.random() * s, s, 3);
};

const drawCarpet = (c: CanvasRenderingContext2D, s: number) => {
  c.fillStyle = '#7e2f33'; c.fillRect(0, 0, s, s);
  speckle(c, s, 500, 0.2, 0.1);
  c.strokeStyle = 'rgba(230,190,110,0.5)'; c.lineWidth = 6;
  c.strokeRect(8, 8, s - 16, s - 16);
};

let texCache: Record<string, THREE.CanvasTexture> | null = null;
function tex(key: string): THREE.CanvasTexture {
  if (!texCache) {
    texCache = {
      deck: canvasTex(drawDeck, [5, 5]),
      metal: canvasTex(drawMetal, [4, 4]),
      wall: canvasTex(drawWall, [3, 2]),
      pool: canvasTex(drawPool, [4, 2]),
      water: canvasTex(drawWater, [3, 2]),
      ocean: canvasTex(drawOcean, [50, 50]),
      heli: canvasTex(drawHeli, [1, 1], 512),
      hull: canvasTex(drawHull, [8, 2]),
      red: canvasTex(drawCarpet, [2, 2]),
    };
  }
  return texCache[key];
}

/** Direct texture access (animated planes etc.). */
export function getTex(key: string): THREE.CanvasTexture {
  return tex(key);
}

const mats = new Map<string, THREE.Material>();
export function getMat(key: string): THREE.Material {
  const hit = mats.get(key);
  if (hit) return hit;
  let m: THREE.Material;
  switch (key) {
    case 'deck': m = new THREE.MeshStandardMaterial({ map: tex('deck'), roughness: 0.85 }); break;
    case 'metal': m = new THREE.MeshStandardMaterial({ map: tex('metal'), roughness: 0.5, metalness: 0.35 }); break;
    case 'wall': m = new THREE.MeshStandardMaterial({ map: tex('wall'), roughness: 0.9 }); break;
    case 'pool': m = new THREE.MeshStandardMaterial({ map: tex('pool'), roughness: 0.35 }); break;
    case 'heli': m = new THREE.MeshStandardMaterial({ map: tex('heli'), roughness: 0.9 }); break;
    case 'hull': m = new THREE.MeshStandardMaterial({ map: tex('hull'), roughness: 0.45, metalness: 0.3 }); break;
    case 'red': m = new THREE.MeshStandardMaterial({ map: tex('red'), roughness: 0.95 }); break;
    case 'trim': m = new THREE.MeshStandardMaterial({ color: '#b98a3c', roughness: 0.35, metalness: 0.7 }); break;
    case 'dark': m = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.7 }); break;
    case 'blue': m = new THREE.MeshStandardMaterial({ color: '#1f4e7a', roughness: 0.5 }); break;
    case 'lamp': m = new THREE.MeshStandardMaterial({ color: '#221a08', emissive: '#ffca7a', emissiveIntensity: 2.2 }); break;
    default: m = new THREE.MeshStandardMaterial({ color: '#cccccc' });
  }
  mats.set(key, m);
  return m;
}

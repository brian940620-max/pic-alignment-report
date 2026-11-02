// Presentation geometry only. The pose, beam radius and endpoint come from Schem3D.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const keep = material => { material.userData.keep = true; return material; };

export class SchematicFinish {
  constructor(scene, renderer, glass) {
    this.geometryCache = new Map();
    const envMap = glass.envMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    this.metal = keep(new THREE.MeshStandardMaterial({ color: 0x8c9eae, metalness: .8, roughness: .26, envMap }));
    this.ceramic = keep(new THREE.MeshPhysicalMaterial({ color: 0xe0e7ed, roughness: .22, metalness: .05, clearcoat: .7, envMap }));
    this.silicon = keep(new THREE.MeshPhysicalMaterial({ color: 0x243d56, metalness: .45, roughness: .23, clearcoat: 1, envMap, envMapIntensity: .85 }));
    this.gold = keep(new THREE.MeshStandardMaterial({ color: 0xc39a4e, metalness: .78, roughness: .3, envMap }));
    this.guide = keep(new THREE.MeshStandardMaterial({ color: 0x62c8ef, emissive: 0x1c9ed1, emissiveIntensity: .65, roughness: .25, metalness: .2 }));
    this.core = keep(new THREE.MeshBasicMaterial({ color: 0xffce8d }));
    const rim = new THREE.DirectionalLight(0x9acbed, 2); rim.position.set(8, 6, -12); scene.add(rim);
    const warm = new THREE.DirectionalLight(0xffdeb0, 1.3); warm.position.set(-8, 4, 10); scene.add(warm);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x0c1828, roughness: .8, metalness: .1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -5; scene.add(floor);
    const grid = new THREE.GridHelper(70, 35, 0x28445b, 0x1b3045); grid.position.y = -4.98;
    grid.material.transparent = true; grid.material.opacity = .35; scene.add(grid);
    const glow = document.createElement('canvas'); glow.width = glow.height = 128;
    const ctx = glow.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#fffce8'); gradient.addColorStop(.18, '#ffe2a8'); gradient.addColorStop(.42, '#ffac5080'); gradient.addColorStop(1, '#ff8b2200');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    this.glow = keep(new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glow), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.time = { value: 0 };
    this.beam = keep(new THREE.ShaderMaterial({
      uniforms: { time: this.time }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float time; varying vec2 vUv;
        void main(){float pulse=pow(.5+.5*cos(6.2831853*(vUv.x*3.-time*.55)),12.);
        float fade=smoothstep(0.,.06,vUv.x)*(1.-smoothstep(.92,1.,vUv.x));
        gl_FragColor=vec4(vec3(1.,.57,.22)+pulse*vec3(0.,.18,.3),(.055+.12*pulse)*fade);}`,
    }));
  }

  box(group, size, position, material, radius = .08) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, radius), material);
    mesh.position.set(...position); group.add(mesh); return mesh;
  }

  pic(group) {
    this.box(group, [8.3, .55, 13.2], [4, -1.7, 3], this.metal, .16);
    this.box(group, [7, 1.2, 12], [3.5, -.72, 3], this.silicon, .1);
    const oxide = keep(new THREE.MeshPhysicalMaterial({ color: 0x7791a6, metalness: .25, roughness: .32, transparent: true, opacity: .3, depthWrite: false, envMap: this.silicon.envMap }));
    this.box(group, [6.96, .08, 11.96], [3.5, -.08, 3], oxide, .02);
    // Taper into the straight guide; decorative contacts are not a fabrication layout.
    const shape = new THREE.Shape(); shape.moveTo(0, -.45); shape.lineTo(2.8, -.12); shape.lineTo(7, -.12);
    shape.lineTo(7, .12); shape.lineTo(2.8, .12); shape.lineTo(0, .45); shape.closePath();
    const taper = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.guide); taper.rotation.x = -Math.PI / 2; taper.position.y = .015; group.add(taper);
    for (const z of [-1.8, 2, 5.8, 8]) {
      this.box(group, [1.3, .07, .85], [5.7, .015, z], this.gold, .03);
      this.box(group, [2.1, .025, .045], [3.9, -.005, z], this.gold, .01);
    }
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7, 1.2, 12)), new THREE.LineBasicMaterial({ color: 0x8ebdd7, transparent: true, opacity: .22 }));
    border.position.set(3.5, -.72, 3); group.add(border);
  }

  collar(group, center, direction, radius) {
    const mesh = new THREE.Mesh(this.geometry(`collar:${radius}`, () => new THREE.CylinderGeometry(radius, radius, 2, 48)), this.ceramic);
    mesh.position.copy(center); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); group.add(mesh);
    for (const t of [-.85, .85]) {
      const ring = new THREE.Mesh(this.geometry(`ring:${radius}`, () => new THREE.TorusGeometry(radius * 1.015, .055, 8, 48)), this.metal);
      ring.position.copy(center).addScaledVector(direction, t); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction); group.add(ring);
    }
  }

  geometry(key, build) {
    if (!this.geometryCache.has(key)) {
      const geometry = build(); geometry.userData.keep = true;
      this.geometryCache.set(key, geometry);
    }
    return this.geometryCache.get(key);
  }

  fiber(group, tip, back, dir, glass, lensed) {
    // Fixed structural diameter: changing optical spacing must not inflate the fiber.
    // A continuous tapered profile replaces the oversized cylinder + hemisphere.
    const radius = .62, length = back.distanceTo(tip), profile = [new THREE.Vector2(0, -length), new THREE.Vector2(radius, -length)];
    if (lensed) {
      profile.push(new THREE.Vector2(radius, -2));
      for (let i = 1; i <= 32; i++) {
        const t = i / 32, smooth = t * t * (3 - 2 * t);
        profile.push(new THREE.Vector2(radius + (.09 - radius) * smooth, -2 + 2 * t));
      }
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; profile.push(new THREE.Vector2(.09 * Math.cos(a), .09 * Math.sin(a))); }
    } else profile.push(new THREE.Vector2(radius, 0), new THREE.Vector2(0, 0));
    // Length is the existing back.distanceTo(tip), including its exact rounding.
    const clad = new THREE.Mesh(this.geometry(`fiber:${lensed}:${length}`, () => new THREE.LatheGeometry(profile, 64)), glass);
    clad.position.copy(tip); clad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); clad.renderOrder = 2; group.add(clad);
    const core = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(back, tip), 1, .045, 12), this.core); group.add(core);
    this.collar(group, back.clone().addScaledVector(dir, .25), dir, .78);
  }

  light(group, tip, hit, dir, wAt, k, st, th, phi) {
    const length = tip.distanceTo(hit), across = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(across, dir).normalize();
    // The structural scene is not to scale. Keep its beam slender at the aperture;
    // only this decorative envelope is scaled; the endpoint and receiver rings are unchanged.
    const envelopeScale = Math.min(1, .28 / Math.max(1e-6, wAt(0) * k));
    for (const scale of [1, .62, .28]) {
      const nx = 48, nr = 24;
      const geo = this.geometry(`beam:${scale}`, () => {
        const uvs = [], indices = [];
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= nr; j++) {
          uvs.push(i / nx, j / nr);
          if (i < nx && j < nr) { const n = i * (nr + 1) + j; indices.push(n, n + 1, n + nr + 1, n + 1, n + nr + 2, n + nr + 1); }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((nx + 1) * (nr + 1) * 3), 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
        return geometry;
      });
      const positions = geo.attributes.position.array;
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, center = tip.clone().addScaledVector(dir, length * u), radius = wAt(length * u / k) * k * scale * envelopeScale;
        for (let j = 0; j <= nr; j++) {
          const a = j / nr * Math.PI * 2, p = center.clone().addScaledVector(across, radius * Math.cos(a)).addScaledVector(up, radius * Math.sin(a));
          const offset = (i * (nr + 1) + j) * 3;
          positions[offset] = p.x; positions[offset + 1] = p.y; positions[offset + 2] = p.z;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, this.beam));
    }
    const radius = wAt(st.z / Math.cos(th)) * k;
    const spot = new THREE.Mesh(this.geometry('spot', () => new THREE.PlaneGeometry(2, 2)), this.glow);
    spot.position.copy(hit).setX(-.065);
    spot.rotation.set(0, Math.PI / 2, 0); spot.rotateZ(-phi);
    spot.scale.set(radius / Math.cos(th), radius, 1); group.add(spot);
  }
}

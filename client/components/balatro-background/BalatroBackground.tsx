// Modified from https://reactbits.dev/backgrounds/balatro

import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import styles from './BalatroBackground.module.css';
import {
  flipAnimationDuration,
  seedAtom,
  seedStore,
  useStartFlipListener,
} from '../../state/coinAtoms';
import { animate } from 'motion/react';
import { hexToVec4, rgbVecToOklab, oklabToRgbVec } from './colorUtil';

interface BalatroProps {
  spinRotation?: number;
  spinSpeed?: number;
  offset?: [number, number];
  contrast?: number;
  lighting?: number;
  spinAmount?: number;
  pixelFilter?: number;
  spinEase?: number;
  isRotate?: boolean;
  mouseInteraction?: boolean;
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

#define PI 3.14159265359

uniform float iTime;
uniform vec3 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2 uOffset;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform bool uIsRotate;
uniform vec2 uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    float pixel_size = length(screenSize.xy) / uPixelFilter;
    vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
    float uv_len = length(uv);
    
    float speed = (uSpinRotation * uSpinEase * 0.2);
    if(uIsRotate){
       speed = iTime * speed;
    }
    speed += 302.2;
    
    float mouseInfluence = (uMouse.x * 2.0 - 1.0);
    speed += mouseInfluence * 0.1;
    
    float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
    vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
    uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
    
    uv *= 30.0;
    float baseSpeed = iTime * uSpinSpeed;
    speed = baseSpeed + mouseInfluence * 2.0;
    
    vec2 uv2 = vec2(uv.x + uv.y);
    
    for(int i = 0; i < 5; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv += 0.5 * vec2(
            cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
            sin(uv2.x - 0.113 * speed)
        );
        uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
    }
    
    float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
    float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
    float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
    float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);
    float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);
    
    return (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
}

void main() {
    vec2 uv = vUv * iResolution.xy;
    gl_FragColor = effect(iResolution.xy, uv);
}
`;

const baseMouseInfluence: Array<number> = [0.5, 0.5];
// usually light to dark is good for color palettes here
const palettes: Array<[string, string, string]> = [
  ['#476952', '#404040', '#142021'],
  ['#DE443B', '#006BB4', '#162325'],
  ['#A9B3DD', '#546E82', '#263D3E'],
  ['#FF6B6B', '#4ECDC4', '#1A535C'],
  ['#FFABF9', '#6937A1', '#1F1C6A'],
  ['#F2D388', '#C98474', '#874C62'],
  ['#FFDCD8', '#713D97', '#191D5E'],
  ['#CDFFFF', '#76AA5A', '#5D5D23'],
  ['#E6F7FF', '#4DB8FF', '#032B43'],
  ['#C8FFD4', '#66C17D', '#083D1A'],
  ['#FFD6E0', '#FF7AA2', '#4A1030'],
  ['#FBE8C6', '#8C5E58', '#2E1E1F'],
];

// Component is structured a little oddly here. We use Jotai atoms to control when the spin activates, but
// the actual animation of the spin is triggered by an event listener within the component itself. This is to avoid
// re-rendering the entire component when the spin is triggered, which would reset the animation and break the continuity of the shader.
export default function BalatroBackground({
  spinRotation = -2.0,
  spinSpeed = 7.0,
  offset = [0.0, 0.0],
  contrast = 3.5,
  lighting = 0.4,
  spinAmount = 0.25,
  pixelFilter = 745.0,
  spinEase = 1.0,
  isRotate = false,
  mouseInteraction = true,
}: BalatroProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // When the startFlip atom changes, dispatch the 'spinActivation' event for the existing handler
  useStartFlipListener((_, __, newVal) => {
    if (newVal && containerRef.current) {
      // seed is used to derive palette selection
      let seedVal = seedStore.get(seedAtom);
      containerRef.current.dispatchEvent(new CustomEvent('spinActivation', { detail: seedVal }));
    }
  });

  // If we want to change any of the shader props dynamically, we can do so here
  // Changing props will automatically trigger a rerender of this component, which resets the whole shader.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const renderer = new Renderer();
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    let program: Program;

    function resize() {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      if (program) {
        program.uniforms.iResolution.value = [
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ];
      }
    }
    window.addEventListener('resize', resize);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height],
        },
        uSpinRotation: { value: spinRotation },
        uSpinSpeed: { value: spinSpeed },
        uOffset: { value: offset },
        uColor1: { value: hexToVec4(palettes[0][0]) },
        uColor2: { value: hexToVec4(palettes[0][1]) },
        uColor3: { value: hexToVec4(palettes[0][2]) },
        uContrast: { value: contrast },
        uLighting: { value: lighting },
        uSpinAmount: { value: spinAmount },
        uPixelFilter: { value: pixelFilter },
        uSpinEase: { value: spinEase },
        uIsRotate: { value: isRotate },
        uMouse: { value: baseMouseInfluence },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    let animationFrameId: number;
    // curated palettes (each palette is [color1, color2, color3])
    const paletteIndex = { current: 0 } as { current: number };

    function update(time: number) {
      animationFrameId = requestAnimationFrame(update);
      program.uniforms.iTime.value = time * 0.001;
      renderer.render({ scene: mesh });
    }
    animationFrameId = requestAnimationFrame(update);
    container.appendChild(gl.canvas);

    function handleMouseMove(e: MouseEvent) {
      if (!mouseInteraction) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      program.uniforms.uMouse.value = [x, y];
    }
    container.addEventListener('mousemove', handleMouseMove);

    function animateColor(
      fromVec: [number, number, number, number],
      toHex: string,
      colorNum: string
    ) {
      // Convert endpoints to vec4. `fromVec` is the current uniform value (already a vec4),
      // `toHex` is a palette hex string which we convert to vec4 for the animation target.
      const v1 = fromVec;
      const v2 = hexToVec4(toHex);
      // Convert RGB -> OKLab
      const lab1 = rgbVecToOklab([v1[0], v1[1], v1[2]]);
      const lab2 = rgbVecToOklab([v2[0], v2[1], v2[2]]);

      // We'll animate L, a, b, and alpha as numbers (Motion will provide numeric updates)
      const state = { L: lab1[0], a: lab1[1], b: lab1[2], A: v1[3] };
      animate(
        state,
        { L: lab2[0], a: lab2[1], b: lab2[2], A: v2[3] },
        {
          type: 'tween',
          duration: flipAnimationDuration,
          onUpdate: () => {
            const rgb = oklabToRgbVec([state.L, state.a, state.b]).map((c) =>
              Math.max(0, Math.min(1, c))
            );
            program.uniforms['uColor' + colorNum].value = [rgb[0], rgb[1], rgb[2], state.A];
          },
        }
      );
    }

    function handleSpinActivation(e: CustomEvent) {
      const seedVal: number = e.detail;
      // animate the spin
      animate(program.uniforms.uMouse.value[0], program.uniforms.uMouse.value[0] + 15, {
        type: 'tween',
        duration: flipAnimationDuration,
        onUpdate: (value: number) => {
          program.uniforms.uMouse.value = [value, program.uniforms.uMouse.value[1]];
        },
      });
      // pick a random palette index different from the current one (handles small palette sizes)
      let nextIndex = paletteIndex.current;
      if (palettes.length > 1) {
        // choose a random index from 0..palettes.length-1 excluding current efficiently
        const r = Math.floor(Math.abs(seedVal) % (palettes.length - 1));
        nextIndex = r == paletteIndex.current ? (r + 1) % palettes.length : r;
      }
      const nextPalette = palettes[nextIndex];
      animateColor(
        program.uniforms.uColor1.value as [number, number, number, number],
        nextPalette[0],
        '1'
      );
      animateColor(
        program.uniforms.uColor2.value as [number, number, number, number],
        nextPalette[1],
        '2'
      );
      animateColor(
        program.uniforms.uColor3.value as [number, number, number, number],
        nextPalette[2],
        '3'
      );
      paletteIndex.current = nextIndex;
    }
    container.addEventListener('spinActivation', handleSpinActivation);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('spinActivation', handleSpinActivation);
      container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    spinRotation,
    spinSpeed,
    offset,
    contrast,
    lighting,
    spinAmount,
    pixelFilter,
    spinEase,
    isRotate,
    mouseInteraction,
  ]);

  return <div ref={containerRef} className={styles.balatroContainer} />;
}

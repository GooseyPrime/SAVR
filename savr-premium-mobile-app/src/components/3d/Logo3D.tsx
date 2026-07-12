/**
 * SAVR 3D Logo - Extruded text with gentle motion
 * Uses THREE.Shape + ExtrudeGeometry for proper letter forms
 * S and A in lime (#BAFF5C), V and R in white
 * Oscillates gently - never flips to unreadable backside
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'motion/react';

// Brand colors
const COLORS = {
  lime: 0xBAFF5C,
  white: 0xFFFFFF,
  accent: 0x5CFFBA
};

interface Logo3DProps {
  className?: string;
}

// Helper to create letter S shape
function createLetterS(): THREE.Shape {
  const shape = new THREE.Shape();

  // Start at top right of S
  shape.moveTo(0.7, 1.0);
  // Top curve
  shape.bezierCurveTo(0.7, 1.0, 0.75, 1.15, 0.5, 1.2);
  shape.bezierCurveTo(0.2, 1.25, -0.1, 1.2, -0.1, 0.95);
  shape.bezierCurveTo(-0.1, 0.75, 0.1, 0.65, 0.3, 0.55);
  // Middle curve going right
  shape.bezierCurveTo(0.5, 0.45, 0.7, 0.35, 0.7, 0.15);
  // Bottom curve
  shape.bezierCurveTo(0.7, -0.1, 0.4, -0.2, 0.1, -0.2);
  shape.bezierCurveTo(-0.2, -0.2, -0.3, -0.05, -0.3, 0.0);
  // Inner stroke (going back up)
  shape.lineTo(-0.05, 0.0);
  shape.bezierCurveTo(-0.05, 0.05, 0.05, 0.0, 0.15, 0.0);
  shape.bezierCurveTo(0.35, 0.0, 0.45, 0.08, 0.45, 0.2);
  shape.bezierCurveTo(0.45, 0.32, 0.3, 0.42, 0.1, 0.52);
  shape.bezierCurveTo(-0.15, 0.65, -0.35, 0.78, -0.35, 1.0);
  shape.bezierCurveTo(-0.35, 1.3, -0.05, 1.45, 0.35, 1.45);
  shape.bezierCurveTo(0.65, 1.45, 0.9, 1.3, 0.95, 1.05);
  shape.lineTo(0.7, 1.0);

  return shape;
}

// Helper to create letter A shape
function createLetterA(): THREE.Shape {
  const shape = new THREE.Shape();

  // Outer triangle
  shape.moveTo(0, 1.45); // Top point
  shape.lineTo(0.75, -0.2); // Bottom right
  shape.lineTo(0.5, -0.2); // Inner bottom right
  shape.lineTo(0.35, 0.25); // Right side of crossbar
  shape.lineTo(-0.35, 0.25); // Left side of crossbar
  shape.lineTo(-0.5, -0.2); // Inner bottom left
  shape.lineTo(-0.75, -0.2); // Bottom left
  shape.lineTo(0, 1.45); // Back to top

  // Crossbar hole
  const hole = new THREE.Path();
  hole.moveTo(-0.22, 0.45);
  hole.lineTo(0.22, 0.45);
  hole.lineTo(0, 0.95);
  hole.lineTo(-0.22, 0.45);
  shape.holes.push(hole);

  return shape;
}

// Helper to create letter V shape
function createLetterV(): THREE.Shape {
  const shape = new THREE.Shape();

  shape.moveTo(-0.7, 1.45); // Top left
  shape.lineTo(-0.45, 1.45); // Inner top left
  shape.lineTo(0, 0.1); // Bottom point inner
  shape.lineTo(0.45, 1.45); // Inner top right
  shape.lineTo(0.7, 1.45); // Top right
  shape.lineTo(0, -0.2); // Bottom point
  shape.lineTo(-0.7, 1.45); // Back to top left

  return shape;
}

// Helper to create letter R shape
function createLetterR(): THREE.Shape {
  const shape = new THREE.Shape();

  // Main body
  shape.moveTo(-0.5, -0.2); // Bottom left
  shape.lineTo(-0.5, 1.45); // Top left
  shape.lineTo(0.3, 1.45); // Top right area
  shape.bezierCurveTo(0.65, 1.45, 0.75, 1.2, 0.75, 0.95);
  shape.bezierCurveTo(0.75, 0.7, 0.6, 0.5, 0.3, 0.45);
  // Diagonal leg
  shape.lineTo(0.7, -0.2); // Bottom right of leg
  shape.lineTo(0.4, -0.2); // Inner leg
  shape.lineTo(0.05, 0.4); // Where leg meets body
  shape.lineTo(-0.25, 0.4); // Inner left at crossbar
  shape.lineTo(-0.25, -0.2); // Down to bottom
  shape.lineTo(-0.5, -0.2); // Back to start

  // Bowl hole
  const hole = new THREE.Path();
  hole.moveTo(-0.25, 0.65);
  hole.lineTo(-0.25, 1.2);
  hole.lineTo(0.2, 1.2);
  hole.bezierCurveTo(0.45, 1.2, 0.5, 1.05, 0.5, 0.92);
  hole.bezierCurveTo(0.5, 0.78, 0.4, 0.65, 0.2, 0.65);
  hole.lineTo(-0.25, 0.65);
  shape.holes.push(hole);

  return shape;
}

export function Logo3D({ className = '' }: Logo3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);

  const prefersReducedMotion = typeof window !== 'undefined' ?
  window.matchMedia('(prefers-reduced-motion: reduce)').matches :
  false;

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(3, 3, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(COLORS.lime, 0.3);
    fillLight.position.set(-3, 1, 3);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(COLORS.accent, 0.2);
    backLight.position.set(0, 0, -5);
    scene.add(backLight);

    // Materials
    const limeMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.lime,
      metalness: 0.15,
      roughness: 0.35,
      emissive: COLORS.lime,
      emissiveIntensity: 0.08
    });

    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.white,
      metalness: 0.1,
      roughness: 0.4
    });

    // Extrusion settings
    const extrudeSettings = {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3
    };

    // Logo group
    const logoGroup = new THREE.Group();
    scene.add(logoGroup);

    // Letter spacing
    const spacing = 1.7;
    const startX = -spacing * 1.5;

    // Create S
    const sShape = createLetterS();
    const sGeo = new THREE.ExtrudeGeometry(sShape, extrudeSettings);
    const sMesh = new THREE.Mesh(sGeo, limeMaterial);
    sMesh.position.x = startX;
    sMesh.position.y = -0.6;
    logoGroup.add(sMesh);

    // Create A
    const aShape = createLetterA();
    const aGeo = new THREE.ExtrudeGeometry(aShape, extrudeSettings);
    const aMesh = new THREE.Mesh(aGeo, limeMaterial);
    aMesh.position.x = startX + spacing;
    aMesh.position.y = -0.6;
    logoGroup.add(aMesh);

    // Create V
    const vShape = createLetterV();
    const vGeo = new THREE.ExtrudeGeometry(vShape, extrudeSettings);
    const vMesh = new THREE.Mesh(vGeo, whiteMaterial);
    vMesh.position.x = startX + spacing * 2;
    vMesh.position.y = -0.6;
    logoGroup.add(vMesh);

    // Create R
    const rShape = createLetterR();
    const rGeo = new THREE.ExtrudeGeometry(rShape, extrudeSettings);
    const rMesh = new THREE.Mesh(rGeo, whiteMaterial);
    rMesh.position.x = startX + spacing * 3;
    rMesh.position.y = -0.6;
    logoGroup.add(rMesh);

    // Center the depth
    logoGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.center();
      }
    });

    // Particles
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 2;

      const c = new THREE.Color(Math.random() > 0.5 ? COLORS.lime : COLORS.accent);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.4
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    setIsReady(true);

    // Animation
    const clock = new THREE.Clock();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Gentle Y oscillation: +/- 25 degrees (stays readable)
        logoGroup.rotation.y = Math.sin(t * 0.4) * 0.45;

        // Subtle X tilt
        logoGroup.rotation.x = Math.sin(t * 0.3) * 0.08;

        // Gentle float
        logoGroup.position.y = Math.sin(t * 0.5) * 0.08;

        // Slow particle drift
        particles.rotation.y = t * 0.02;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameRef.current);

      sGeo.dispose();
      aGeo.dispose();
      vGeo.dispose();
      rGeo.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      limeMaterial.dispose();
      whiteMaterial.dispose();
      renderer.dispose();
    };
  }, [prefersReducedMotion]);

  return (
    <div data-ev-id="ev_7c5aba3eb9" ref={containerRef} className={`relative ${className}`}>
      <canvas data-ev-id="ev_68d92eb816" ref={canvasRef} className="w-full h-full" />

      {!isReady &&
      <div data-ev-id="ev_2c9600c987" className="absolute inset-0 flex items-center justify-center">
          <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-primary font-display text-2xl tracking-widest">

            SAVR
          </motion.div>
        </div>
      }

      {/* Corner accents */}
      <div data-ev-id="ev_34d015ab04" className="absolute top-0 left-0 w-8 h-px bg-primary/30" />
      <div data-ev-id="ev_13d0883caf" className="absolute top-0 left-0 w-px h-8 bg-primary/30" />
      <div data-ev-id="ev_168f975c20" className="absolute top-0 right-0 w-8 h-px bg-primary/30" />
      <div data-ev-id="ev_30fc8a6a4d" className="absolute top-0 right-0 w-px h-8 bg-primary/30" />
      <div data-ev-id="ev_9ae1787262" className="absolute bottom-0 left-0 w-8 h-px bg-primary/30" />
      <div data-ev-id="ev_b3ebb4163a" className="absolute bottom-0 left-0 w-px h-8 bg-primary/30" />
      <div data-ev-id="ev_1b8fe5e036" className="absolute bottom-0 right-0 w-8 h-px bg-primary/30" />
      <div data-ev-id="ev_7376e13688" className="absolute bottom-0 right-0 w-px h-8 bg-primary/30" />
    </div>);

}
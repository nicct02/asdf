import * as THREE from 'three';

// Batch size for highlighting per frame to avoid lag
const HIGHLIGHT_BATCH_SIZE = 5;

export class EagleVision {  // Added 'export' here
  constructor(scene, galleryScene, renderer, modelLoader, portfolioAnalytics) {
    this.scene = scene;
    this.galleryScene = galleryScene;
    this.renderer = renderer;
    this.modelLoader = modelLoader;
    this.portfolioAnalytics = portfolioAnalytics;
    
    // State
    this.isActive = false;
    this.startTime = 0;
    this.duration = 3000; // 3 seconds
    
    // Visual effects
    this.overlay = null;
    this.window = null;  // New window element
    this.originalMaterials = new Map();
    this.highlightedObjects = [];
    this._highlightQueue = [];
    this._isHighlighting = false;
    this.currentScene = null;
    this.glowMaterial = null;

    // Window settings
    this.windowSize = 400; // Size in pixels
    
    this.init();
  }
  
  init() {
    this.createOverlay();
    this.createWindow();
    console.log('Eagle Vision system initialized');
  }
  
  createOverlay() {
    // Create a full-screen overlay that stays normal (non-eagle vision)
    this.overlay = document.createElement('div');
    this.overlay.id = 'eagle-vision-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2000;
      display: none;
    `;
    document.body.appendChild(this.overlay);
  }

  createWindow() {
    // Create the eagle vision window
    this.window = document.createElement('div');
    this.window.id = 'eagle-vision-window';
    this.window.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${this.windowSize}px;
      height: ${this.windowSize}px;
      background: rgba(0, 0, 0, 0);
      pointer-events: none;
      z-index: 2001;
      opacity: 0;
      transition: opacity 0.3s ease;
      mix-blend-mode: overlay;
      display: none;
      clip-path: circle(50%);
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5),
                  inset 0 0 20px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(this.window);
  }
  
  activate(currentScene) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startTime = performance.now();
    this.currentScene = currentScene;
    
    // Start visual effects
    this.startVisualEffects();
    this.highlightInteractiveObjects();
    
    // Track analytics
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'activate', {
        scene: currentScene
      });
    }
    
    console.log('Eagle Vision activated');
  }
  
  startVisualEffects() {
    // Show window with eagle vision effect
    this.window.style.display = 'block';
    setTimeout(() => {
      this.window.style.opacity = '1';
      
      // Apply the eagle vision effect only to the window area
      this.window.style.backdropFilter = 'grayscale(100%) contrast(1.2) brightness(0.8)';
      
      // Optional: Add a transition effect for the window appearance
      this.window.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
  }
  
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Hide window
    this.window.style.opacity = '0';
    setTimeout(() => {
      this.window.style.display = 'none';
    }, 300);
    
    // Reset any highlighted objects
    this.highlightedObjects.forEach(obj => {
      if (this.originalMaterials.has(obj)) {
        obj.material = this.originalMaterials.get(obj);
        this.originalMaterials.delete(obj);
      }
    });
    
    this.highlightedObjects = [];
    this._highlightQueue = [];
    this._isHighlighting = false;
  }
  
  highlightInteractiveObjects() {
    const objectsToHighlight = [];
    
    if (this.currentScene === 'main') {
      // Main scene objects
      if (this.modelLoader.models.paper) objectsToHighlight.push(this.modelLoader.models.paper);
      if (this.modelLoader.models.grave) objectsToHighlight.push(this.modelLoader.models.grave);
      if (this.modelLoader.models.book2) objectsToHighlight.push(this.modelLoader.models.book2);
      if (this.modelLoader.models.scroll) objectsToHighlight.push(this.modelLoader.models.scroll);
      if (this.modelLoader.models.key) objectsToHighlight.push(this.modelLoader.models.key);
      if (this.modelLoader.models.door) objectsToHighlight.push(this.modelLoader.models.door);
      
      // Portal models
      const portalModels = this.modelLoader.getPortalModels();
      objectsToHighlight.push(...portalModels);
    }
    
    // Queue objects for highlighting
    this._highlightQueue = objectsToHighlight;
    if (!this._isHighlighting) {
      this._processHighlightQueue();
    }
  }
  
  _processHighlightQueue() {
    this._isHighlighting = true;
    
    const batch = this._highlightQueue.splice(0, HIGHLIGHT_BATCH_SIZE);
    
    batch.forEach(obj => {
      if (obj && obj.material && !this.highlightedObjects.includes(obj)) {
        this.originalMaterials.set(obj, obj.material);
        
        // Create highlight material
        const highlightMaterial = obj.material.clone();
        highlightMaterial.emissive = new THREE.Color(0xffff00);
        highlightMaterial.emissiveIntensity = 0.5;
        
        obj.material = highlightMaterial;
        this.highlightedObjects.push(obj);
      }
    });
    
    if (this._highlightQueue.length > 0) {
      requestAnimationFrame(() => this._processHighlightQueue());
    } else {
      this._isHighlighting = false;
    }
  }
}

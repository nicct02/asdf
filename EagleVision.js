import * as THREE from 'three';

// Batch size for highlighting per frame to avoid lag
const HIGHLIGHT_BATCH_SIZE = 5;
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
        this.originalMaterials = new Map();
        this.highlightedObjects = [];
        this._highlightQueue = [];
        this._isHighlighting = false;
        this.currentScene = null;
        this.glowMaterial = null;

        this.init();
    }

    
  init() {
    this.createOverlay();
    console.log('Eagle Vision system initialized');
  }
  
  createOverlay() {
    // Create a full-screen overlay for the desaturation effect
    this.overlay = document.createElement('div');
    this.overlay.id = 'eagle-vision-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0);
      pointer-events: none;
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
      mix-blend-mode: overlay;
      display: none;
    `;
    document.body.appendChild(this.overlay);
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
    // Apply CSS filter to renderer canvas for desaturation
    const canvas = this.renderer.domElement;
    canvas.style.filter = 'grayscale(100%) contrast(1.2) brightness(0.8)';
    canvas.style.transition = 'filter 0.3s ease';
    
    // Show overlay
    this.overlay.style.display = 'block';
    setTimeout(() => {
      this.overlay.style.opacity = '0.3';
    }, 10);
  }
  
  // Batch highlighting to avoid lag
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
      
    } else if (this.currentScene === 'gallery') {
      // Gallery scene objects
      const returnPortal = this.galleryScene.children.find(child => 
        child.userData && child.userData.type === 'return-portal'
      );
      if (returnPortal) objectsToHighlight.push(returnPortal);
      
      // Gallery frames (interactive areas)
      this.galleryScene.children.forEach(child => {
        if (child.userData && child.userData.type === 'gallery-frame') {
          objectsToHighlight.push(child);
        }
      });
    }

    // Clear old highlights before adding new ones
    this.removeHighlights();

    // Prepare queue for batch processing
    this._highlightQueue = objectsToHighlight.slice();
    this._isHighlighting = true;
    this._processHighlightBatch();
  }

  // Process a few highlight objects per frame
  _processHighlightBatch() {
    let count = 0;
    while (this._highlightQueue.length && count < HIGHLIGHT_BATCH_SIZE) {
      const obj = this._highlightQueue.shift();
      if (obj) this.addGreenGlow(obj);
      count++;
    }
    if (this._highlightQueue.length) {
      requestAnimationFrame(() => this._processHighlightBatch());
    } else {
      this._isHighlighting = false;
    }
  }

  addGreenGlow(object) {
  let foundMesh = false;
  object.traverse((child) => {
    if (child.isMesh && !foundMesh) {
      foundMesh = true;
      // Store original material
      if (!this.originalMaterials.has(child)) {
        this.originalMaterials.set(child, {
          material: child.material.clone(),
          renderOrder: child.renderOrder,
          depthTest: child.material.depthTest,
          depthWrite: child.material.depthWrite
        });
      }
      // Set white glow
      const glowMaterial = child.material.clone();
      glowMaterial.emissive = new THREE.Color(0xffffff); // white, not green
      glowMaterial.emissiveIntensity = 0.5;
      glowMaterial.depthTest = false;
      glowMaterial.depthWrite = false;
      glowMaterial.transparent = true;
      glowMaterial.opacity = 0.8;
      child.renderOrder = 9999;

      // White wireframe
      const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff, // white
        linewidth: 2,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframe.name = 'eagle-vision-wireframe';
      wireframe.renderOrder = 10000;

      child.material = glowMaterial;
      child.add(wireframe);
      this.highlightedObjects.push(child);
    }
  });
}
  
  update() {
    if (!this.isActive) return;
    
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    
    // Check if duration has passed
    if (elapsed >= this.duration) {
      this.deactivate();
      return;
    }
    
    // Animate intensity based on time
    const progress = elapsed / this.duration;
    let intensity;
    
    if (progress < 0.1) {
      // Fade in
      intensity = progress / 0.1;
    } else if (progress > 0.9) {
      // Fade out
      intensity = (1 - progress) / 0.1;
    } else {
      // Full intensity
      intensity = 1;
    }
    
    // Update glow intensity
    this.highlightedObjects.forEach(child => {
      if (child.material && child.material.emissive) {
        child.material.emissiveIntensity = 0.5 * intensity;
      }
      
      // Update wireframe opacity
      const wireframe = child.getObjectByName('eagle-vision-wireframe');
      if (wireframe && wireframe.material) {
        wireframe.material.opacity = 0.8 * intensity;
      }
    });
  }
  
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this._highlightQueue = [];
    this._isHighlighting = false;

    // Remove visual effects
    this.stopVisualEffects();
    this.removeHighlights();
    
    // Track analytics
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'deactivate', {
        duration: performance.now() - this.startTime
      });
    }
    
    console.log('Eagle Vision deactivated');
  }

  forceDeactivate() {
    // Forcibly deactivate (used when switching scenes)
    if (this.isActive) {
      this.deactivate();
    }
  }
  
  stopVisualEffects() {
    // Remove CSS filter
    const canvas = this.renderer.domElement;
    canvas.style.filter = '';
    canvas.style.transition = '';
    
    // Hide overlay
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 300);
  }
  
  removeHighlights() {
    this.highlightedObjects.forEach(child => {
      // Restore original material and properties
      if (this.originalMaterials.has(child)) {
        const original = this.originalMaterials.get(child);
        child.material = original.material;
        child.renderOrder = original.renderOrder;
        child.material.depthTest = original.depthTest;
        child.material.depthWrite = original.depthWrite;
      }
      
      // Remove wireframe
      const wireframe = child.getObjectByName('eagle-vision-wireframe');
      if (wireframe) {
        child.remove(wireframe);
      }
    });
    
    this.highlightedObjects = [];
    this.originalMaterials.clear();
  }
}

export { EagleVision };

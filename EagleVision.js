import * as THREE from 'three';

// Batch size for highlighting per frame to avoid lag
const HIGHLIGHT_BATCH_SIZE = 5;

class EagleVision {
  constructor(scene, galleryScene, renderer, modelLoader, portfolioAnalytics, camera) {
    this.scene = scene;
    this.galleryScene = galleryScene;
    this.renderer = renderer;
    this.modelLoader = modelLoader;
    this.portfolioAnalytics = portfolioAnalytics;
    this.camera = camera; // Store camera reference
    
    // State
    this.isActive = false;
    this.startTime = 0;
    this.duration = 3000; // 3 seconds for tablet/goggle effect
    
    // Vision window config
    this.windowSize = { width: 300, height: 300 }; // Larger than 50x50 for visibility
    
    // Visual effects
    this.visionWindow = null;
    this.windowFrame = null;
    this.originalMaterials = new Map();
    this.highlightedObjects = [];
    this.glowObjects = []; // Separate glow objects that we add to scene
    this._highlightQueue = [];
    this._isHighlighting = false;
    this.currentScene = null;
    this.glowMaterial = null;
    
    // Dynamic highlighting
    this.updateInterval = null;
    this.lastUpdateTime = 0;
    this.updateFrequency = 100; // Update every 100ms

    this.init();
  }
  
  init() {
    this.createVisionWindow();
    console.log('Eagle Vision system initialized');
  }
  
  createVisionWindow() {
    // Create the vision window frame (like a tablet or goggle frame)
    this.windowFrame = document.createElement('div');
    this.windowFrame.id = 'eagle-vision-frame';
    this.windowFrame.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: ${this.windowSize.width}px;
      height: ${this.windowSize.height}px;
      transform: translate(-50%, -50%);
      border: 4px solid #00ffff;
      border-radius: 15px;
      background: transparent;
      pointer-events: none;
      z-index: 3000;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: none;
      box-shadow: 
        0 0 20px rgba(0, 255, 255, 0.5),
        inset 0 0 20px rgba(0, 255, 255, 0.2);
    `;
    
    // Add corner indicators to make it look more tech-like
    this.windowFrame.innerHTML = `
      <div style="
        position: absolute;
        top: -2px;
        left: -2px;
        width: 20px;
        height: 20px;
        border-top: 2px solid #00ffff;
        border-left: 2px solid #00ffff;
      "></div>
      <div style="
        position: absolute;
        top: -2px;
        right: -2px;
        width: 20px;
        height: 20px;
        border-top: 2px solid #00ffff;
        border-right: 2px solid #00ffff;
      "></div>
      <div style="
        position: absolute;
        bottom: -2px;
        left: -2px;
        width: 20px;
        height: 20px;
        border-bottom: 2px solid #00ffff;
        border-left: 2px solid #00ffff;
      "></div>
      <div style="
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 20px;
        height: 20px;
        border-bottom: 2px solid #00ffff;
        border-right: 2px solid #00ffff;
      "></div>
      <div style="
        position: absolute;
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
        color: #00ffff;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        text-shadow: 0 0 5px #00ffff;
      ">EAGLE VISION</div>
    `;
    
    document.body.appendChild(this.windowFrame);

    // Create the vision effect overlay inside the window
    this.visionWindow = document.createElement('div');
    this.visionWindow.id = 'eagle-vision-window';
    this.visionWindow.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: ${this.windowSize.width - 8}px;
      height: ${this.windowSize.height - 8}px;
      transform: translate(-50%, -50%);
      background: linear-gradient(45deg, 
        rgba(0, 50, 100, 0.3) 0%,
        rgba(0, 100, 150, 0.2) 50%,
        rgba(0, 50, 100, 0.3) 100%
      );
      pointer-events: none;
      z-index: 2999;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: none;
      border-radius: 12px;
      mix-blend-mode: screen;
      backdrop-filter: contrast(1.5) brightness(0.7) saturate(0.3);
    `;
    
    document.body.appendChild(this.visionWindow);
  }
  
  activate(currentScene) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startTime = performance.now();
    this.currentScene = currentScene;
    this.lastUpdateTime = 0;
    
    // Start visual effects
    this.startVisualEffects();
    this.highlightInteractiveObjects();
    
    // Start continuous highlighting updates
    this.startDynamicHighlighting();
    
    // Track analytics
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'activate', {
        scene: currentScene,
        mode: 'window'
      });
    }
    
    console.log('Eagle Vision window activated');
  }
  
  startDynamicHighlighting() {
    // Update highlighting periodically while active
    this.updateInterval = setInterval(() => {
      if (this.isActive) {
        this.updateHighlighting();
      }
    }, this.updateFrequency);
  }
  
  stopDynamicHighlighting() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  updateHighlighting() {
    // Get all potential objects to highlight
    const allInteractiveObjects = this.getAllInteractiveObjects();
    
    // Check which objects are currently visible in the window
    const visibleObjects = allInteractiveObjects.filter(obj => 
      this.isObjectPartiallyInVisionWindow(obj, this.camera)
    );
    
    // Get currently highlighted objects
    const currentlyHighlighted = new Set(this.highlightedObjects);
    
    // Objects that should be highlighted but aren't
    const toHighlight = visibleObjects.filter(obj => !currentlyHighlighted.has(obj));
    
    // Objects that are highlighted but shouldn't be
    const toUnhighlight = Array.from(currentlyHighlighted).filter(obj => 
      !visibleObjects.includes(obj)
    );
    
    // Remove highlighting from objects that left the window
    toUnhighlight.forEach(obj => {
      this.removeHighlightFromObject(obj);
    });
    
    // Add highlighting to new objects in the window
    toHighlight.forEach(obj => {
      this.addOverlayGlow(obj);
    });
    
    if (toHighlight.length > 0 || toUnhighlight.length > 0) {
      console.log(`Updated highlighting: +${toHighlight.length}, -${toUnhighlight.length}`);
    }
  }
  
  getAllInteractiveObjects() {
    const objects = [];
    
    if (this.currentScene === 'main') {
      // Main scene objects
      if (this.modelLoader.models.paper) objects.push(this.modelLoader.models.paper);
      if (this.modelLoader.models.grave) objects.push(this.modelLoader.models.grave);
      if (this.modelLoader.models.book2) objects.push(this.modelLoader.models.book2);
      if (this.modelLoader.models.scroll) objects.push(this.modelLoader.models.scroll);
      if (this.modelLoader.models.key) objects.push(this.modelLoader.models.key);
      if (this.modelLoader.models.door) objects.push(this.modelLoader.models.door);
      
      // Portal models
      const portalModels = this.modelLoader.getPortalModels();
      objects.push(...portalModels);
      
    } else if (this.currentScene === 'gallery') {
      // Gallery scene objects
      const returnPortal = this.galleryScene.children.find(child => 
        child.userData && child.userData.type === 'return-portal'
      );
      if (returnPortal) objects.push(returnPortal);
      
      // Gallery frames (interactive areas)
      this.galleryScene.children.forEach(child => {
        if (child.userData && child.userData.type === 'gallery-frame') {
          objects.push(child);
        }
      });
    }
    
    return objects;
  }
  
  removeHighlightFromObject(object) {
    // Remove from highlighted objects list
    this.highlightedObjects = this.highlightedObjects.filter(obj => obj !== object);
    
    // Find and remove glow objects for this object
    const glowsToRemove = this.glowObjects.filter(glowData => glowData.originalObject === object);
    
    glowsToRemove.forEach(glowData => {
      // Remove glow mesh from scene
      if (glowData.glowMesh && glowData.glowMesh.parent) {
        glowData.glowMesh.parent.remove(glowData.glowMesh);
      }
      
      // Remove wireframe from scene  
      if (glowData.wireframe && glowData.wireframe.parent) {
        glowData.wireframe.parent.remove(glowData.wireframe);
      }
      
      // Remove from glow objects list
      this.glowObjects = this.glowObjects.filter(g => g !== glowData);
    });
  }
  
  startVisualEffects() {
    // Show the vision window and frame
    this.windowFrame.style.display = 'block';
    this.visionWindow.style.display = 'block';
    
    // Animate appearance
    setTimeout(() => {
      this.windowFrame.style.opacity = '1';
      this.visionWindow.style.opacity = '1';
    }, 10);
    
    // Add scanning effect
    this.addScanningEffect();
  }
  
  addScanningEffect() {
    // Create a scanning line that moves across the vision window
    const scanLine = document.createElement('div');
    scanLine.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, 
        transparent 0%, 
        #00ffff 50%, 
        transparent 100%
      );
      animation: scan 2s ease-in-out infinite;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scan {
        0% { transform: translateY(0); opacity: 1; }
        50% { opacity: 0.5; }
        100% { transform: translateY(${this.windowSize.height - 8}px); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    this.visionWindow.appendChild(scanLine);
    
    // Remove scanning effect when vision deactivates
    setTimeout(() => {
      if (scanLine.parentNode) {
        scanLine.parentNode.removeChild(scanLine);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, this.duration);
  }
  
  // Improved detection: Check if ANY part of the object is visible in the vision window
  isObjectPartiallyInVisionWindow(object, camera) {
    // Calculate object's bounding box in world space
    const box = new THREE.Box3().setFromObject(object);
    
    // Get the 8 corners of the bounding box
    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z)
    ];
    
    // Window bounds in screen coordinates
    const windowCenterX = window.innerWidth / 2;
    const windowCenterY = window.innerHeight / 2;
    const halfWidth = this.windowSize.width / 2;
    const halfHeight = this.windowSize.height / 2;
    const windowMinX = windowCenterX - halfWidth;
    const windowMaxX = windowCenterX + halfWidth;
    const windowMinY = windowCenterY - halfHeight;
    const windowMaxY = windowCenterY + halfHeight;
    
    // Check if any corner is visible in the window
    let hasVisibleCorner = false;
    let allBehind = true;
    
    for (const corner of corners) {
      // Project corner to screen coordinates
      const screenPosition = corner.clone().project(camera);
      
      // Check if in front of camera
      if (screenPosition.z < 1) {
        allBehind = false;
        
        // Convert to pixel coordinates
        const x = (screenPosition.x + 1) / 2 * window.innerWidth;
        const y = (-screenPosition.y + 1) / 2 * window.innerHeight;
        
        // Check if this corner is within window bounds
        if (x >= windowMinX && x <= windowMaxX && y >= windowMinY && y <= windowMaxY) {
          hasVisibleCorner = true;
          break;
        }
      }
    }
    
    // If all corners are behind camera, object is not visible
    if (allBehind) {
      return false;
    }
    
    // If we found a visible corner, object is partially visible
    if (hasVisibleCorner) {
      return true;
    }
    
    // Additional check: even if no corners are in window, 
    // the object might still intersect if it's large enough to span across the window
    // Check if the object's bounding box intersects with the window area
    
    // Project all corners and find screen space bounding box
    let screenMinX = Infinity, screenMaxX = -Infinity;
    let screenMinY = Infinity, screenMaxY = -Infinity;
    let hasValidProjection = false;
    
    for (const corner of corners) {
      const screenPosition = corner.clone().project(camera);
      
      if (screenPosition.z < 1) { // In front of camera
        hasValidProjection = true;
        const x = (screenPosition.x + 1) / 2 * window.innerWidth;
        const y = (-screenPosition.y + 1) / 2 * window.innerHeight;
        
        screenMinX = Math.min(screenMinX, x);
        screenMaxX = Math.max(screenMaxX, x);
        screenMinY = Math.min(screenMinY, y);
        screenMaxY = Math.max(screenMaxY, y);
      }
    }
    
    if (!hasValidProjection) {
      return false;
    }
    
    // Check if screen space bounding box intersects with window
    const intersects = !(screenMaxX < windowMinX || screenMinX > windowMaxX || 
                        screenMaxY < windowMinY || screenMinY > windowMaxY);
    
    return intersects;
  }
  
  // Create a shader material that clips glow effects to the window bounds
  createClippedGlowMaterial() {
    const vertexShader = `
      varying vec4 vScreenPosition;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vScreenPosition = projectionMatrix * viewMatrix * worldPosition;
        gl_Position = vScreenPosition;
      }
    `;
    
    const fragmentShader = `
      uniform vec3 emissive;
      uniform float emissiveIntensity;
      uniform vec2 windowCenter;
      uniform vec2 windowSize;
      uniform vec2 screenSize;
      varying vec4 vScreenPosition;
      
      void main() {
        // Convert to screen coordinates
        vec2 screenCoord = (vScreenPosition.xy / vScreenPosition.w) * 0.5 + 0.5;
        screenCoord.y = 1.0 - screenCoord.y; // Flip Y
        vec2 pixelCoord = screenCoord * screenSize;
        
        // Check if within window bounds
        vec2 windowMin = windowCenter - windowSize * 0.5;
        vec2 windowMax = windowCenter + windowSize * 0.5;
        
        if (pixelCoord.x < windowMin.x || pixelCoord.x > windowMax.x || 
            pixelCoord.y < windowMin.y || pixelCoord.y > windowMax.y) {
          discard; // Don't render outside window
        }
        
        gl_FragColor = vec4(emissive * emissiveIntensity, 0.8);
      }
    `;
    
    return new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        emissive: { value: new THREE.Color(0x00ffff) },
        emissiveIntensity: { value: 0.7 },
        windowCenter: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
        windowSize: { value: new THREE.Vector2(this.windowSize.width, this.windowSize.height) },
        screenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }
  
  // Batch highlighting to avoid lag
  highlightInteractiveObjects() {
    const objectsToHighlight = this.getAllInteractiveObjects();

    // Clear old highlights before adding new ones
    this.removeHighlights();

    // Filter objects to only those visible in the vision window
    const visibleObjects = objectsToHighlight.filter(obj => 
      this.isObjectPartiallyInVisionWindow(obj, this.camera)
    );

    // Prepare queue for batch processing (only visible objects)
    this._highlightQueue = visibleObjects.slice();
    this._isHighlighting = true;
    this._processHighlightBatch();
    
    console.log(`Initial highlighting: ${visibleObjects.length} objects visible in vision window`);
  }

  // Process a few highlight objects per frame
  _processHighlightBatch() {
    let count = 0;
    while (this._highlightQueue.length && count < HIGHLIGHT_BATCH_SIZE) {
      const obj = this._highlightQueue.shift();
      if (obj) this.addOverlayGlow(obj);
      count++;
    }
    if (this._highlightQueue.length) {
      requestAnimationFrame(() => this._processHighlightBatch());
    } else {
      this._isHighlighting = false;
    }
  }

  addOverlayGlow(object) {
    // Add to highlighted objects list
    this.highlightedObjects.push(object);
    
    // Get the appropriate scene to add glow objects to
    const targetScene = this.currentScene === 'gallery' ? this.galleryScene : this.scene;
    
    object.traverse((child) => {
      if (child.isMesh) {
        // Create a duplicate mesh for the glow effect
        const glowGeometry = child.geometry.clone();
        const glowMaterial = this.createClippedGlowMaterial();
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        
        // FIXED: Copy the complete transformation matrix and update every frame
        child.updateMatrixWorld(true); // Force matrix update
        glowMesh.matrix.copy(child.matrixWorld);
        glowMesh.matrixAutoUpdate = false; // Use manually set matrix
        
        // Set render order to render on top
        glowMesh.renderOrder = 9999;
        
        // Add to scene
        targetScene.add(glowMesh);
        
        // Create wireframe overlay
        const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
        const wireframeMaterial = new THREE.ShaderMaterial({
          vertexShader: `
            varying vec4 vScreenPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vScreenPosition = projectionMatrix * viewMatrix * worldPosition;
              gl_Position = vScreenPosition;
            }
          `,
          fragmentShader: `
            uniform vec2 windowCenter;
            uniform vec2 windowSize;
            uniform vec2 screenSize;
            varying vec4 vScreenPosition;
            
            void main() {
              vec2 screenCoord = (vScreenPosition.xy / vScreenPosition.w) * 0.5 + 0.5;
              screenCoord.y = 1.0 - screenCoord.y;
              vec2 pixelCoord = screenCoord * screenSize;
              
              vec2 windowMin = windowCenter - windowSize * 0.5;
              vec2 windowMax = windowCenter + windowSize * 0.5;
              
              if (pixelCoord.x < windowMin.x || pixelCoord.x > windowMax.x || 
                  pixelCoord.y < windowMin.y || pixelCoord.y > windowMax.y) {
                discard;
              }
              
              gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
            }
          `,
          uniforms: {
            windowCenter: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
            windowSize: { value: new THREE.Vector2(this.windowSize.width, this.windowSize.height) },
            screenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
          },
          transparent: true,
          depthTest: false,
          depthWrite: false
        });
        
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        
        // FIXED: Copy matrix for wireframe too
        wireframe.matrix.copy(child.matrixWorld);
        wireframe.matrixAutoUpdate = false;
        wireframe.renderOrder = 10000;
        
        // Add to scene
        targetScene.add(wireframe);
        
        // Store references for cleanup and continuous updates
        this.glowObjects.push({
          originalObject: object,
          originalMesh: child,
          glowMesh: glowMesh,
          wireframe: wireframe
        });
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
    } else if (progress > 0.85) {
      // Fade out
      intensity = (1 - progress) / 0.15;
    } else {
      // Full intensity
      intensity = 1;
    }
    
    // Update transformations and shader uniforms for all glow objects
    this.glowObjects.forEach(glowData => {
      // FIXED: Continuously update matrices to follow original objects
      if (glowData.originalMesh && glowData.glowMesh) {
        glowData.originalMesh.updateMatrixWorld(true);
        glowData.glowMesh.matrix.copy(glowData.originalMesh.matrixWorld);
      }
      if (glowData.originalMesh && glowData.wireframe) {
        glowData.wireframe.matrix.copy(glowData.originalMesh.matrixWorld);
      }
      
      // Update glow mesh material
      if (glowData.glowMesh && glowData.glowMesh.material && glowData.glowMesh.material.uniforms) {
        if (glowData.glowMesh.material.uniforms.emissiveIntensity) {
          glowData.glowMesh.material.uniforms.emissiveIntensity.value = 0.7 * intensity;
        }
        // Update window bounds in case of screen resize
        if (glowData.glowMesh.material.uniforms.windowCenter) {
          glowData.glowMesh.material.uniforms.windowCenter.value.set(window.innerWidth / 2, window.innerHeight / 2);
        }
        if (glowData.glowMesh.material.uniforms.screenSize) {
          glowData.glowMesh.material.uniforms.screenSize.value.set(window.innerWidth, window.innerHeight);
        }
      }
      
      // Update wireframe material
      if (glowData.wireframe && glowData.wireframe.material && glowData.wireframe.material.uniforms) {
        if (glowData.wireframe.material.uniforms.windowCenter) {
          glowData.wireframe.material.uniforms.windowCenter.value.set(window.innerWidth / 2, window.innerHeight / 2);
        }
        if (glowData.wireframe.material.uniforms.screenSize) {
          glowData.wireframe.material.uniforms.screenSize.value.set(window.innerWidth, window.innerHeight);
        }
      }
    });
    
    // Pulse the window frame
    if (this.windowFrame) {
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 0.005);
      this.windowFrame.style.boxShadow = `
        0 0 ${20 * pulse}px rgba(0, 255, 255, ${0.5 * intensity}),
        inset 0 0 ${20 * pulse}px rgba(0, 255, 255, ${0.2 * intensity})
      `;
    }
  }
  
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this._highlightQueue = [];
    this._isHighlighting = false;

    // Stop dynamic highlighting
    this.stopDynamicHighlighting();

    // Remove visual effects
    this.stopVisualEffects();
    this.removeHighlights();
    
    // Track analytics
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'deactivate', {
        duration: performance.now() - this.startTime,
        mode: 'window'
      });
    }
    
    console.log('Eagle Vision window deactivated');
  }

  forceDeactivate() {
    // Forcibly deactivate (used when switching scenes)
    if (this.isActive) {
      this.deactivate();
    }
  }
  
  stopVisualEffects() {
    // Hide the vision window and frame
    if (this.windowFrame) {
      this.windowFrame.style.opacity = '0';
    }
    if (this.visionWindow) {
      this.visionWindow.style.opacity = '0';
    }
    
    setTimeout(() => {
      if (this.windowFrame) {
        this.windowFrame.style.display = 'none';
      }
      if (this.visionWindow) {
        this.visionWindow.style.display = 'none';
      }
    }, 300);
  }
  
  removeHighlights() {
    // Remove all glow objects from scene
    this.glowObjects.forEach(glowData => {
      if (glowData.glowMesh && glowData.glowMesh.parent) {
        glowData.glowMesh.parent.remove(glowData.glowMesh);
      }
      if (glowData.wireframe && glowData.wireframe.parent) {
        glowData.wireframe.parent.remove(glowData.wireframe);
      }
    });
    
    // Clear arrays
    this.highlightedObjects = [];
    this.glowObjects = [];
    this.originalMaterials.clear();
  }
}

export { EagleVision };

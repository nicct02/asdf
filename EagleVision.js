import * as THREE from 'three';

const HIGHLIGHT_BATCH_SIZE = 5;

class EagleVision {
  constructor(scene, galleryScene, renderer, modelLoader, portfolioAnalytics, camera) {
    this.scene = scene;
    this.galleryScene = galleryScene;
    this.renderer = renderer;
    this.modelLoader = modelLoader;
    this.portfolioAnalytics = portfolioAnalytics;
    this.camera = camera; //cam ref
    
    this.isActive = false;
    this.startTime = 0;
    this.duration = 3000; // 3 sec
    
    this.windowSize = { width: 300, height: 300 };
    
    this.visionWindow = null;
    this.windowFrame = null;
    this.originalMaterials = new Map();
    this.highlightedObjects = [];
    this.glowObjects = []; // Separate glow objects
    this._highlightQueue = [];
    this._isHighlighting = false;
    this.currentScene = null;
    this.glowMaterial = null;
    
    this.updateInterval = null;
    this.lastUpdateTime = 0;
    this.updateFrequency = 100; //pdate every 100ms

    this.init();
  }
  
  init() {
    this.createVisionWindow();
    console.log('Eagle Vision system initialized');
  }
  
  createVisionWindow() {
    //window frame
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
    
    //corner indicators
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
      "> </div>
    `;
    
    document.body.appendChild(this.windowFrame);

    //overlay inside
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
    
    this.startVisualEffects();
    this.highlightInteractiveObjects();
    
    this.startDynamicHighlighting();
    
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'activate', {
        scene: currentScene,
        mode: 'window'
      });
    }
    
    console.log('Eagle Vision window activated');
  }
  
  startDynamicHighlighting() {
  this.updateInterval = setInterval(() => {
    if (this.isActive) {
      this.updateHighlighting();
    }
  }, 200); //changed 100ms to 200ms
}
  
  stopDynamicHighlighting() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  updateHighlighting() {
    const allInteractiveObjects = this.getAllInteractiveObjects();
    const visibleObjects = allInteractiveObjects.filter(obj => 
      this.isObjectPartiallyInVisionWindow(obj, this.camera)
    );
    const currentlyHighlighted = new Set(this.highlightedObjects);
    const toHighlight = visibleObjects.filter(obj => !currentlyHighlighted.has(obj));
    const toUnhighlight = Array.from(currentlyHighlighted).filter(obj => 
      !visibleObjects.includes(obj)
    );
    toUnhighlight.forEach(obj => {
      this.removeHighlightFromObject(obj);
    });
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
      if (this.modelLoader.models.paper) objects.push(this.modelLoader.models.paper);
      if (this.modelLoader.models.grave) objects.push(this.modelLoader.models.grave);
      if (this.modelLoader.models.book2) objects.push(this.modelLoader.models.book2);
      if (this.modelLoader.models.scroll) objects.push(this.modelLoader.models.scroll);
      if (this.modelLoader.models.key) objects.push(this.modelLoader.models.key);
      if (this.modelLoader.models.door) objects.push(this.modelLoader.models.door);
      
      //Portal
      const portalModels = this.modelLoader.getPortalModels();
      objects.push(...portalModels);
      
    } else if (this.currentScene === 'gallery') {
      ///Gallery scene objects
      const returnPortal = this.galleryScene.children.find(child => 
        child.userData && child.userData.type === 'return-portal'
      );
      if (returnPortal) objects.push(returnPortal);
      
      //frames
      this.galleryScene.children.forEach(child => {
        if (child.userData && child.userData.type === 'gallery-frame') {
          objects.push(child);
        }
      });
    }
    return objects;
  }

  removeHighlightFromObject(object) {
    this.highlightedObjects = this.highlightedObjects.filter(obj => obj !== object);    
    const glowsToRemove = this.glowObjects.filter(glowData => glowData.originalObject === object);
    
    glowsToRemove.forEach(glowData => {
      if (glowData.glowMesh && glowData.glowMesh.parent) {
        glowData.glowMesh.parent.remove(glowData.glowMesh);
      }
      if (glowData.wireframe && glowData.wireframe.parent) {
        glowData.wireframe.parent.remove(glowData.wireframe);
      }
      this.glowObjects = this.glowObjects.filter(g => g !== glowData);
    });
  }
  
  startVisualEffects() {
  this.windowFrame.style.display = 'block';
  this.visionWindow.style.display = 'block';
  setTimeout(() => {
    this.windowFrame.style.opacity = '1';
    this.visionWindow.style.opacity = '1';
  }, 10);
}
  
  addScanningEffect() {
  console.log('Vision window activated without scanning effect');
}
  
isObjectPartiallyInVisionWindow(object, camera) {
  if (!camera.frustum) {
    camera.frustum = new THREE.Frustum();
    camera.projectionScreenMatrix = new THREE.Matrix4();
  }
  
  camera.projectionScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  camera.frustum.setFromProjectionMatrix(camera.projectionScreenMatrix);
  const boundingBox = new THREE.Box3().setFromObject(object);
  if (!camera.frustum.intersectsBox(boundingBox)) {
    return false;
  }
  const center = boundingBox.getCenter(new THREE.Vector3());
  const radius = boundingBox.getSize(new THREE.Vector3()).length() * 0.5;
  
  const screenPosition = center.clone().project(camera);
  
  if (screenPosition.z >= 1) return false;
  
  const x = (screenPosition.x + 1) / 2 * window.innerWidth;
  const y = (-screenPosition.y + 1) / 2 * window.innerHeight;
  
  const windowCenterX = window.innerWidth / 2;
  const windowCenterY = window.innerHeight / 2;
  const halfWidth = this.windowSize.width / 2 + radius * 50; //buffer
  const halfHeight = this.windowSize.height / 2 + radius * 50;
  
  return (x >= windowCenterX - halfWidth && x <= windowCenterX + halfWidth && 
          y >= windowCenterY - halfHeight && y <= windowCenterY + halfHeight);
}
  
  createClippedGlowMaterial() {
  const vertexShader = `
    varying vec4 vScreenPosition;
    varying vec3 vWorldPosition;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
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
    uniform float groundLevel;
    varying vec4 vScreenPosition;
    varying vec3 vWorldPosition;
    
    void main() {
      // Clip anything below ground level
      if (vWorldPosition.y < groundLevel) {
        discard;
      }
      
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
      screenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      groundLevel: { value: 0.0 } // Ground level at Y = 0
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}
  
  highlightInteractiveObjects() {
    const objectsToHighlight = this.getAllInteractiveObjects();
    this.removeHighlights();
    const visibleObjects = objectsToHighlight.filter(obj => 
      this.isObjectPartiallyInVisionWindow(obj, this.camera)
    );
    this._highlightQueue = visibleObjects.slice();
    this._isHighlighting = true;
    this._processHighlightBatch();
    
    console.log(`Initial highlighting: ${visibleObjects.length} objects visible in vision window`);
  }

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
  this.highlightedObjects.push(object);
  const targetScene = this.currentScene === 'gallery' ? this.galleryScene : this.scene;
  
  object.traverse((child) => {
    if (child.isMesh) {
      const glowGeometry = child.geometry.clone();
      const glowMaterial = this.createClippedGlowMaterial();
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      child.updateMatrixWorld(true); // Force matrix update
      glowMesh.matrix.copy(child.matrixWorld);
      glowMesh.matrixAutoUpdate = false; //manually set matrix
      glowMesh.renderOrder = 9999;
      targetScene.add(glowMesh);
      
      //wireframe overlay with ground clipping
      const wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
      const wireframeMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec4 vScreenPosition;
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vScreenPosition = projectionMatrix * viewMatrix * worldPosition;
            gl_Position = vScreenPosition;
          }
        `,
        fragmentShader: `
          uniform vec2 windowCenter;
          uniform vec2 windowSize;
          uniform vec2 screenSize;
          uniform float groundLevel;
          varying vec4 vScreenPosition;
          varying vec3 vWorldPosition;
          
          void main() {
            // Clip anything below ground level
            if (vWorldPosition.y < groundLevel) {
              discard;
            }
            
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
          screenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          groundLevel: { value: 0.0 } // Ground level at Y = 0
        },
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframe.matrix.copy(child.matrixWorld);
      wireframe.matrixAutoUpdate = false;
      wireframe.renderOrder = 10000;
      targetScene.add(wireframe);
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
  
  if (elapsed >= this.duration) {
    this.deactivate();
    return;
  }
  
  if (currentTime - this.lastUpdateTime < 33) { // ~30fps for matrix updates
    return;
  }
  this.lastUpdateTime = currentTime;
  
  // Anim intensity based on time
  const progress = elapsed / this.duration;
  let intensity;
  
  if (progress < 0.1) {
    intensity = progress / 0.1;
  } else if (progress > 0.85) {
    intensity = (1 - progress) / 0.15;
  } else {
    intensity = 1;
  }
  const windowCenter = [window.innerWidth / 2, window.innerHeight / 2];
  const screenSize = [window.innerWidth, window.innerHeight];
  const groundLevel = 0.0; // Floor Y = 0
  
  this.glowObjects.forEach(glowData => {
    if (glowData.originalMesh && glowData.glowMesh) {
      if (!glowData.lastMatrixUpdate || currentTime - glowData.lastMatrixUpdate > 100) {
        glowData.originalMesh.updateMatrixWorld(true);
        glowData.glowMesh.matrix.copy(glowData.originalMesh.matrixWorld);
        if (glowData.wireframe) {
          glowData.wireframe.matrix.copy(glowData.originalMesh.matrixWorld);
        }
        glowData.lastMatrixUpdate = currentTime;
      }
    }
    
    if (glowData.glowMesh?.material?.uniforms) {
      const uniforms = glowData.glowMesh.material.uniforms;
      if (uniforms.emissiveIntensity) uniforms.emissiveIntensity.value = 0.7 * intensity;
      if (uniforms.windowCenter) uniforms.windowCenter.value.set(windowCenter[0], windowCenter[1]);
      if (uniforms.screenSize) uniforms.screenSize.value.set(screenSize[0], screenSize[1]);
      if (uniforms.groundLevel) uniforms.groundLevel.value = groundLevel; // Add ground clipping
    }
    
    if (glowData.wireframe?.material?.uniforms) {
      const uniforms = glowData.wireframe.material.uniforms;
      if (uniforms.windowCenter) uniforms.windowCenter.value.set(windowCenter[0], windowCenter[1]);
      if (uniforms.screenSize) uniforms.screenSize.value.set(screenSize[0], screenSize[1]);
      if (uniforms.groundLevel) uniforms.groundLevel.value = groundLevel; // Add ground clipping
    }
  });
  
  if (this.windowFrame && currentTime % 100 < 16) { //10fps for UI effects
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
    this.stopDynamicHighlighting();
    this.stopVisualEffects();
    this.removeHighlights();
  
    if (this.portfolioAnalytics) {
      this.portfolioAnalytics.trackInteraction('eagle_vision', 'deactivate', {
        duration: performance.now() - this.startTime,
        mode: 'window'
      });
    }
    
    console.log('Eagle Vision window deactivated');
  }

  forceDeactivate() {
    // Forcibly deactivate when switching scenes
    if (this.isActive) {
      this.deactivate();
    }
  }
  
  stopVisualEffects() {
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
    this.glowObjects.forEach(glowData => {
      if (glowData.glowMesh && glowData.glowMesh.parent) {
        glowData.glowMesh.parent.remove(glowData.glowMesh);
      }
      if (glowData.wireframe && glowData.wireframe.parent) {
        glowData.wireframe.parent.remove(glowData.wireframe);
      }
    });
    
    this.highlightedObjects = [];
    this.glowObjects = [];
    this.originalMaterials.clear();
  }
}
export { EagleVision };
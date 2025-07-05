import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class WorldBuilder {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    this.isBuilderMode = false;
    this.availableModels = new Map();
    this.placedObjects = [];
    this.selectedModel = null;
    this.selectedObject = null;
    this.currentMode = 'select'; //select, place, rotate, scale, move
    
    //COLISION BOX TRACKING
    this.placedCollisionBoxes = []; //Trackseparately
    
    //Contrls
    this.keys = {};
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Loader
    this.loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(dracoLoader);
    
    // UI
    this.rotationPanel = null;
    this.queuedWorldData = null;
    
    //COLLISION SHAPES
    this.addBuiltInCollisionShapes();
    
    this.init();
  }
  
  // COLLISION LIBRARY
  addBuiltInCollisionShapes() {
    //collision cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x0066ff,
      transparent: true, 
      opacity: 0.4,
      wireframe: true 
    });
    const cubeScene = new THREE.Group();
    const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cubeScene.add(cubeMesh);
    
    this.availableModels.set('collision_cube', {
      scene: cubeScene,
      isCollisionShape: true,
      shapeType: 'box',
      animations: []
    });
    
    //cylinder
    const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 2, 12);
    const cylinderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff00ff,
      transparent: true, 
      opacity: 0.4,
      wireframe: true 
    });
    const cylinderScene = new THREE.Group();
    const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinderScene.add(cylinderMesh);
    
    this.availableModels.set('collision_cylinder', {
      scene: cylinderScene,
      isCollisionShape: true,
      shapeType: 'cylinder',
      animations: []
    });
    
    console.log(' Added built-in collision shapes: cube, cylinder');
  }
  
  init() {
    this.createUI();
    this.setupEventListeners();
    this.loadWorldConfig();
    this.setupAutoSave();
    
    // Try  auto-load world
    this.autoLoadWorld();
    
    console.log('World Builder initialized');
    console.log('Press Ctrl+B to toggle builder mode');
    console.log('Controls: T=Place, Z=Select, V=Move, R=Rotate, S=Scale');
    console.log('Built-in collision shapes: collision_cube, collision_cylinder');
  }
  
  async autoLoadWorld() {
    // Try load from localStorage first
    const stored = localStorage.getItem('world-builder-save');
    if (stored) {
      try {
        const worldData = JSON.parse(stored);
        console.log('Found saved world with', worldData.objects.length, 'objects');
        this.queuedWorldData = worldData;
        const requiredModels = [...new Set(worldData.objects
          .map(obj => obj.modelName)
          .filter(name => !name.startsWith('collision_'))
        )];
        console.log('World requires models:', requiredModels);
        
        return requiredModels;
      } catch (error) {
        console.error('Failed to parse world data:', error);
      }
    }
    
    console.log('No saved world found, starting with empty scene');
    return [];
  }



  async loadWorldWhenReady(retryCount = 0) {
  if (!this.queuedWorldData) return 0;
  console.log('Attempting to load world (attempt', retryCount + 1, ')...');
  const worldData = this.queuedWorldData;
  const requiredModels = [...new Set(worldData.objects
    .map(obj => obj.modelName)
    .filter(name => !name.startsWith('collision_'))
  )];
  const availableModels = Array.from(this.availableModels.keys());
  const missingModels = requiredModels.filter(model => !this.availableModels.has(model));
  
  if (missingModels.length > 0) {
    console.log('Missing models:', missingModels, '- Available:', availableModels);
    if (retryCount < 10) {
      setTimeout(() => {
        this.loadWorldWhenReady(retryCount + 1);
      }, 1000 + (retryCount * 500));
      return 0;
    } else {
      console.error('Timeout waiting for models:', missingModels);
      return 0;
    }
  }
  
  this.placedObjects.forEach(obj => this.scene.remove(obj));
  this.placedObjects = [];
  this.placedCollisionBoxes.forEach(box => this.scene.remove(box));
  this.placedCollisionBoxes = [];
  
  let loadedCount = 0;
  for (const objData of worldData.objects) {
    if (this.availableModels.has(objData.modelName)) {
      const modelData = this.availableModels.get(objData.modelName);
      const obj = modelData.scene.clone();
      
      obj.position.set(objData.position.x, objData.position.y, objData.position.z);
      obj.rotation.set(objData.rotation.x, objData.rotation.y, objData.rotation.z);
      obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
      obj.userData = objData.userData;
      
      this.scene.add(obj);
      
      if (modelData.isCollisionShape) {
        this.placedCollisionBoxes.push(obj);
        console.log(`Loaded collision ${objData.modelName} at`, obj.position);
      } else {
        this.placedObjects.push(obj);
        console.log(`Loaded object: ${objData.modelName} at`, obj.position);
      }
      
      loadedCount++;
    } else {
      console.error(`Model "${objData.modelName}" not found in library`);
    }
  }
  
  this.updateObjectList();
  console.log(`Auto-loaded ${loadedCount}/${worldData.objects.length} objects from saved world`);
  console.log(`Collision boxes: ${this.placedCollisionBoxes.length}, Regular objects: ${this.placedObjects.length}`);
  
  this.queuedWorldData = null;
  return loadedCount;
}
    

  //registermodel as loaded
  registerModel(modelName, modelData) {
    this.availableModels.set(modelName, modelData);
    console.log(`Registered model: ${modelName} (${this.availableModels.size} total)`);
    
    //Try load world if queued data
    if (this.queuedWorldData) {
      setTimeout(() => this.loadWorldWhenReady(), 100);
    }
  }





exportForProduction() {
  const allObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
  const worldData = {
    version: '1.0',
    created: new Date().toISOString(),
    isProduction: true,
    objects: allObjects.map((obj, index) => ({
      modelName: obj.userData.modelName,
      instanceId: obj.userData.instanceId || (Date.now() + index),
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      userData: obj.userData
    }))
  };
  
  localStorage.setItem('world-builder-save', JSON.stringify(worldData));
  const blob = new Blob([JSON.stringify(worldData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `default-world.json`;
  a.click();
  URL.revokeObjectURL(url);
  this.showStatus(`World saved! Put 'default-world.json' in /worlds/ folder (${allObjects.length} objects)`, 4000);
  console.log('Exported world for GitHub Pages deployment:', allObjects.length, 'objects');
}

async autoLoadWorld() {
  // 1. try load from /worlds
  try {
    console.log('Trying to load from /worlds/default-world.json...');
    const response = await fetch('./worlds/default-world.json');
    
    if (response.ok) {
      const worldData = await response.json();
      console.log('Found GitHub Pages world with', worldData.objects.length, 'objects');
      
      // Store
      this.queuedWorldData = worldData;
      
      //list models
      const requiredModels = [...new Set(worldData.objects
        .map(obj => obj.modelName)
        .filter(name => !name.startsWith('collision_'))
      )];
      console.log('GitHub Pages world requires models:', requiredModels);
      
      return requiredModels;
    }
  } catch (error) {
    console.log('No GitHub Pages world found, trying localStorage...');
  }
  
  //Fallback to localStorage if GitHub Pages world doesn't exist
  const stored = localStorage.getItem('world-builder-save');
  if (stored) {
    try {
      const worldData = JSON.parse(stored);
      console.log('Found localStorage world with', worldData.objects.length, 'objects');
      this.queuedWorldData = worldData;
      const requiredModels = [...new Set(worldData.objects
        .map(obj => obj.modelName)
        .filter(name => !name.startsWith('collision_'))
      )];
      console.log('localStorage world requires models:', requiredModels);
      
      return requiredModels;
    } catch (error) {
      console.error('Failed to parse localStorage world data:', error);
    }
  }
  console.log('No saved world found, starting with empty scene');
  return [];
}




  resetToDefault() {
    localStorage.removeItem('world-builder-save');
    this.placedObjects.forEach(obj => this.scene.remove(obj));
    this.placedCollisionBoxes.forEach(box => this.scene.remove(box));
    this.placedObjects = [];
    this.placedCollisionBoxes = [];
    this.clearSelection();
    this.updateObjectList();
    this.showStatus(' Reset to empty world', 2000);
  }

  //debug
  debugWorldState() {
    console.log('World Builder Debug:');
    console.log('- Available models:', Array.from(this.availableModels.keys()));
    console.log('- Placed objects:', this.placedObjects.length);
    console.log('- Collision boxes:', this.placedCollisionBoxes.length);
    console.log('- Queued world data:', this.queuedWorldData ? 'Yes' : 'No');
    
    const stored = localStorage.getItem('world-builder-save');
    if (stored) {
      try {
        const worldData = JSON.parse(stored);
        console.log('- Saved world objects:', worldData.objects.length);
        console.log('- Required models:', [...new Set(worldData.objects.map(obj => obj.modelName))]);
      } catch (e) {
        console.log('- Saved world: Invalid JSON');
      }
    } else {
      console.log('- Saved world: None');
    }
  }
  
  createUI() {
    //builder panel
    this.builderPanel = document.createElement('div');
    this.builderPanel.id = 'world-builder-panel';
    this.builderPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 350px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid rgb(194, 194, 194);
      border-radius: 10px;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 15px;
      display: none;
      z-index: 5000;
      overflow-y: auto;
    `;
    
    this.builderPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid  rgb(194, 194, 194); padding-bottom: 10px;">
        <h3 style="margin: 0; color: rgb(194, 194, 194);"> BUILDER</h3>
        <button onclick="worldBuilder.toggleBuilder()" style="
          background: #ff4444; color: white; border: none; padding: 5px 10px; 
          border-radius: 3px; cursor: pointer; font-size: 11px;">✕</button>
      </div>
      
      <!-- Current Mode Display -->
      <div id="wb-mode-display" style="
        background:  rgb(194, 194, 194); padding: 10px; margin-bottom: 15px; 
        border-radius: 5px; text-align: center; font-weight: bold;
      ">
        MODE: SELECT
      </div>

      <!-- Production Controls -->
      <div style="margin-bottom: 15px; border-top: 1px solid #666; padding-top: 15px;">
        <h4 style="color: rgb(194, 194, 194); margin: 0 0 8px 0;">Controls</h4>
        <div style="display: grid; grid-template-columns: 1fr; gap: 5px;">
          <button onclick="worldBuilder.exportForProduction()" style="
            padding: 6px; background: rgb(194, 194, 194); color: white; border: 1px solid rgb(194, 194, 194); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">Set as Default</button>
          <button onclick="worldBuilder.resetToDefault()" style="
            padding: 6px; background: rgb(194, 194, 194); color: white; border: 1px solid  rgb(194, 194, 194); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">Reset to Default</button>
          <button onclick="worldBuilder.debugWorldState()" style="
            padding: 6px; background:  rgb(194, 194, 194); color: white; border: 1px solid  rgb(194, 194, 194); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">ddebug State</button>
        </div>
        <div style="font-size: 9px; color: #888; margin-top: 5px; text-align: center;">
        </div>
      </div>
      
      <!-- Drop Zone -->
      <div id="wb-drop-zone" style="
        border: 2px dashed rgb(194, 194, 194); padding: 15px; text-align: center; 
        margin-bottom: 15px; border-radius: 5px; cursor: pointer;
      ">
        .glb upload
      </div>
      <input type="file" id="wb-file-input" multiple accept=".glb,.gltf" style="display: none;">
      
      <!-- Model Library -->
      <div style="margin-bottom: 15px;">
        <h4 style="color:  rgb(194, 194, 194); margin: 0 0 8px 0;"> aktuelle Library</h4>
        <div id="wb-model-list" style="
          max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.05); 
          padding: 8px; border-radius: 5px;
        ">
          <div style="color: #888; text-align: center; padding: 20px;">
            No models loaded.
          </div>
        </div>
      </div>
      
      <!-- Controls Reference -->
      <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 5px; font-size: 11px; margin-bottom: 15px;">
        <strong style="color: rgb(194, 194, 194);"> Controls:</strong><br>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;"></strong> x top right to exit</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;"></strong> ESC fo move mouse free and scroll HERE</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">T & RMB</strong> - Place</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">Z & RMB</strong> - Select</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">V</strong> - Move</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">R</strong> - Rotate</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">S</strong> - Scale</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">Mouse Wheel</strong> - Scale Up/Down</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">Arrow Keys</strong> - Fine Move</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">Delete</strong> - Remove Selected</div>
        <div style="margin: 5px 0;"><strong style="color: #ffff00;">1-9</strong> - Quick Select Model</div>
      </div>
      
      <!-- Quick Actions -->
      <div style="margin-bottom: 15px;">
        <h4 style="color: #ffff00; margin: 0 0 8px 0;">Quick Actions</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
          <button onclick="worldBuilder.deleteSelected()" style="
            padding: 6px; background:rgb(44, 44, 44); color: white; border: 1px solidrgb(44, 44, 44); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">Delete</button>
          <button onclick="worldBuilder.duplicateSelected()" style="
            padding: 6px; background: rgb(44, 44, 44); color: white; border: 1px solidrgb(44, 44, 44); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">ccopy</button>
          <button onclick="worldBuilder.saveWorld()" style="
            padding: 6px; background:rgb(44, 44, 44); color: white; border: 1px solidrgb(44, 44, 44); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
          <button onclick="worldBuilder.loadWorld()" style="
            padding: 6px; background: rgb(44, 44, 44); color: white; border: 1px solidrgb(44, 44, 44); 
            border-radius: 3px; cursor: pointer; font-size: 11px;">Load</button>
        </div>
      </div>
      
      <!-- Placed Objects -->
      <div style="margin-top: 15px;">
        <h4 style="color: #ffff00; margin: 0 0 8px 0;">All Objects (<span id="wb-object-count">0</span>)</h4>
        <div id="wb-object-list" style="
          max-height: 100px; overflow-y: auto; background: rgba(255,255,255,0.05); 
          padding: 8px; border-radius: 5px; font-size: 10px;
        ">
        </div>
      </div>
    `;
    
    document.body.appendChild(this.builderPanel);
    this.createRotationPanel();
    window.worldBuilder = this;
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8);
      color: rgb(194, 194, 194); padding: 8px 15px; border-radius: 20px; font-family: 'Courier New', monospace;
      font-size: 12px; display: none; z-index: 5000;
    `;
    document.body.appendChild(this.statusIndicator);
  }
  
  createRotationPanel() {
    this.rotationPanel = document.createElement('div');
    this.rotationPanel.id = 'wb-rotation-panel';
    this.rotationPanel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #ffaa00;
      border-radius: 10px;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 20px;
      display: none;
      z-index: 6000;
    `;
    
    this.rotationPanel.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #ffaa00;">ROTATION </h3>
        <div style="color: #888; font-size: 10px; margin-top: 5px;">Use sliders or input precise values</div>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: #ffaa00;">X Rotation:</label>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="range" id="wb-rot-x" min="-180" max="180" value="0" step="1" style="flex: 1;">
          <input type="number" id="wb-rot-x-num" min="-180" max="180" value="0" step="1" style="width: 60px; background: #333; color: white; border: 1px solid #666; padding: 2px;">
          <span style="color: #888;">°</span>
        </div>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: #ffaa00;">Y Rotation:</label>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="range" id="wb-rot-y" min="-180" max="180" value="0" step="1" style="flex: 1;">
          <input type="number" id="wb-rot-y-num" min="-180" max="180" value="0" step="1" style="width: 60px; background: #333; color: white; border: 1px solid #666; padding: 2px;">
          <span style="color: #888;">°</span>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 5px; color: #ffaa00;">Z Rotation:</label>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="range" id="wb-rot-z" min="-180" max="180" value="0" step="1" style="flex: 1;">
          <input type="number" id="wb-rot-z-num" min="-180" max="180" value="0" step="1" style="width: 60px; background: #333; color: white; border: 1px solid #666; padding: 2px;">
          <span style="color: #888;">°</span>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button onclick="worldBuilder.resetRotation()" style="
          padding: 8px 15px; background: #444; color: white; border: 1px solid #666; 
          border-radius: 3px; cursor: pointer;">Reset</button>
        <button onclick="worldBuilder.closeRotationPanel()" style="
          padding: 8px 15px; background: rgb(194, 194, 194); color: white; border: 1px solid rgb(194, 194, 194); 
          border-radius: 3px; cursor: pointer;">Done</button>
      </div>
    `;
    
    document.body.appendChild(this.rotationPanel);
    this.setupRotationPanelListeners();
  }
  
  setupRotationPanelListeners() {
    const xSlider = document.getElementById('wb-rot-x');
    const ySlider = document.getElementById('wb-rot-y');
    const zSlider = document.getElementById('wb-rot-z');
    const xNum = document.getElementById('wb-rot-x-num');
    const yNum = document.getElementById('wb-rot-y-num');
    const zNum = document.getElementById('wb-rot-z-num');
    
    // Sync sliders inputs
    xSlider.addEventListener('input', () => {
      xNum.value = xSlider.value;
      this.updateObjectRotation();
    });
    
    ySlider.addEventListener('input', () => {
      yNum.value = ySlider.value;
      this.updateObjectRotation();
    });
    
    zSlider.addEventListener('input', () => {
      zNum.value = zSlider.value;
      this.updateObjectRotation();
    });
    
    // Sync number with sliders
    xNum.addEventListener('input', () => {
      xSlider.value = xNum.value;
      this.updateObjectRotation();
    });
    
    yNum.addEventListener('input', () => {
      ySlider.value = yNum.value;
      this.updateObjectRotation();
    });
    
    zNum.addEventListener('input', () => {
      zSlider.value = zNum.value;
      this.updateObjectRotation();
    });
  }
  
  updateObjectRotation() {
    if (!this.selectedObject) return;
    
    const x = parseFloat(document.getElementById('wb-rot-x').value) * Math.PI / 180;
    const y = parseFloat(document.getElementById('wb-rot-y').value) * Math.PI / 180;
    const z = parseFloat(document.getElementById('wb-rot-z').value) * Math.PI / 180;
    
    this.selectedObject.rotation.set(x, y, z);
  }
  
  resetRotation() {
    document.getElementById('wb-rot-x').value = 0;
    document.getElementById('wb-rot-y').value = 0;
    document.getElementById('wb-rot-z').value = 0;
    document.getElementById('wb-rot-x-num').value = 0;
    document.getElementById('wb-rot-y-num').value = 0;
    document.getElementById('wb-rot-z-num').value = 0;
    this.updateObjectRotation();
  }
  
  closeRotationPanel() {
    this.rotationPanel.style.display = 'none';
    this.setMode('select');
  }
  
  setupEventListeners() {
    //File input
    const dropZone = document.getElementById('wb-drop-zone');
    const fileInput = document.getElementById('wb-file-input');
    
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#00ff00';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#00ffff';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#00ffff';
        this.handleFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
      });
    }
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (!this.isBuilderMode) {
  
        if (e.ctrlKey && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          this.toggleBuilder();
        }
        return;
      }
      
      // Builder mode
      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          this.setMode('place');
          break;
        case 'z':
          e.preventDefault();
          this.setMode('select');
          break;
        case 'r':
          e.preventDefault();
          if (this.selectedObject) {
            this.setMode('rotate');
            this.openRotationPanel();
          } else {
            this.showStatus('Select an object first to rotate', 2000);
          }
          break;
        case 's':
          e.preventDefault();
          if (this.selectedObject) {
            this.setMode('scale');
          } else {
            this.showStatus('Select an object first to scale', 2000);
          }
          break;
        case 'v':
          e.preventDefault();
          if (this.selectedObject) {
            this.setMode('move');
          } else {
            this.showStatus(' Select an object first to move', 2000);
          }
          break;
      }
      // Arrow key movement
      if (this.selectedObject && this.currentMode === 'move' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.fineMoveObject(e.key);
      }
      
      // Other
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelected();
      }
      
      // Model selection (1-9)
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        this.selectModelByIndex(num - 1);
      }
      
      // Save/duplicate
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveWorld();
      }
      
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateSelected();
      }
    });
    
    // Mouse
    document.addEventListener('click', (e) => {
      if (!this.isBuilderMode) return;
      if (e.target.closest('#world-builder-panel')) return;
      if (e.target.closest('#wb-rotation-panel')) return;
      
      this.handleWorldClick(e);
    });
    
    //wheelscaling
    document.addEventListener('wheel', (e) => {
      if (!this.isBuilderMode || this.currentMode !== 'scale' || !this.selectedObject) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const currentScale = this.selectedObject.scale.x;
      const newScale = Math.max(0.1, Math.min(5, currentScale + delta));
      
      this.selectedObject.scale.setScalar(newScale);
      this.showStatus(`🔍 Scale: ${newScale.toFixed(2)}`, 500);
    });
  }
  
  setMode(mode) {
    this.currentMode = mode;
    
    const modeDisplay = document.getElementById('wb-mode-display');
    if (modeDisplay) {
      const modeText = {
        select: 'SELECT',
        place: 'PLACE',
        rotate: 'ROTATE',
        scale: 'SCALE',
        move: 'MOVE'
      };
      
      const modeColors = {
        select: 'rgb(194, 194, 194)',
        place: 'rgb(194, 194, 194)',
        rotate: 'rgb(194, 194, 194)',
        scale: 'rgb(194, 194, 194)',
        move: 'rgb(194, 194, 194)'
      };
      
      modeDisplay.textContent = `MODE: ${modeText[mode]}`;
      modeDisplay.style.background = modeColors[mode];
    }
    
    this.showStatus(`Mode: ${mode.toUpperCase()}`, 1000);
  }
  
  toggleBuilder() {
    this.isBuilderMode = !this.isBuilderMode;
    this.builderPanel.style.display = this.isBuilderMode ? 'block' : 'none';
    this.statusIndicator.style.display = this.isBuilderMode ? 'block' : 'none';
    
    if (this.isBuilderMode) {
      this.statusIndicator.textContent = 'WORLD BUILDER ACTIVE';
      this.setMode('select');
      this.updateModelList(); 
      console.log('World Builder activated');
    } else {
      this.statusIndicator.textContent = '';
      this.clearSelection();
      this.rotationPanel.style.display = 'none';
      console.log('World Builder deactivated');
    }
  }
  
  async handleFiles(files) {
    for (let file of files) {
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        await this.loadModel(file);
      }
    }
    this.updateModelList();
  }
  
  async loadModel(file) {
    const url = URL.createObjectURL(file);
    const modelName = file.name.replace(/\.(glb|gltf)$/, '');
    
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });
      
      gltf.scene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      
      this.availableModels.set(modelName, {
        scene: gltf.scene,
        originalFile: file,
        animations: gltf.animations || [],
        isCollisionShape: false
      });
      
      console.log(`Loaded model: ${modelName}`);
      this.showStatus(`Loaded: ${modelName}`, 2000);
      
    } catch (error) {
      console.error(`Failed to load ${modelName}:`, error);
      this.showStatus(`Failed: ${modelName}`, 3000);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  
  updateModelList() {
    const container = document.getElementById('wb-model-list');
    if (!container) return;
    
    if (this.availableModels.size === 0) {
      container.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No models loaded</div>';
      return;
    }
    
    let html = '';
    Array.from(this.availableModels.entries()).forEach(([name, data], index) => {
      const isSelected = this.selectedModel === name;
      
      const isCollision = data.isCollisionShape;
      const bgColor = isSelected ? 
        (isCollision ? 'rgba(255,0,255,0.3)' : 'rgba(0,255,255,0.2)') : 
        (isCollision ? 'rgba(255,0,255,0.1)' : 'rgba(255,255,255,0.1)');
      const borderColor = isSelected ? 
        (isCollision ? '#ff00ff' : '#00ffff') : 
        'transparent';
      const icon = isCollision ? 'tag' : 'ld';
      
      html += `
        <div onclick="worldBuilder.selectModel('${name}')" style="
          padding: 8px; margin: 2px 0; background: ${bgColor};
          border-radius: 3px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;
          border: 1px solid ${borderColor};
        ">
          <span>${icon} <strong>${index + 1}.</strong> ${name}</span>
          <button onclick="event.stopPropagation(); worldBuilder.removeModel('${name}')" style="
            background: #ff4444; color: white; border: none; padding: 2px 6px; 
            border-radius: 2px; cursor: pointer; font-size: 10px;">✕</button>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
  
  selectModel(modelName) {
    this.selectedModel = modelName;
    this.updateModelList();
    
    const modelData = this.availableModels.get(modelName);
    const type = modelData.isCollisionShape ? 'collision shape' : 'model';
    this.showStatus(`${modelData.isCollisionShape ? 'tg' : 'ld'} Selected: ${modelName} (${type})`, 1500);
  }
  
  selectModelByIndex(index) {
    const models = Array.from(this.availableModels.keys());
    if (index < models.length) {
      this.selectModel(models[index]);
    }
  }

  handleMoveClick() {
    if (!this.selectedObject) {
      this.showStatus('No object selected to move', 2000);
      return;
    }
    
    //ground surfaces for movement
    const groundObjects = [];
    this.scene.children.forEach(child => {
      if (child.geometry && child.geometry.type === 'PlaneGeometry') {
        groundObjects.push(child);
      }
      if (child.userData && child.userData.type === 'collision') {
        groundObjects.push(child);
      }
    });
    
    const groundIntersects = this.raycaster.intersectObjects(groundObjects);
    if (groundIntersects.length > 0) {
      const newPosition = groundIntersects[0].point;
      //Y position relative tt ground
      this.selectedObject.position.copy(newPosition);
      this.selectedObject.position.y = Math.max(newPosition.y, 0);
      
      this.showStatus(`Moved to: ${newPosition.x.toFixed(1)}, ${newPosition.z.toFixed(1)}`, 1500);
      this.updateObjectList();
    } else {
      this.showStatus('Click on the ground to move object', 2000);
    }
  }

  fineMoveObject(direction) {
    if (!this.selectedObject) return;
    
    const step = 0.1;
    
    switch (direction) {
      case 'ArrowUp':
        this.selectedObject.position.z -= step;
        break;
      case 'ArrowDown':
        this.selectedObject.position.z += step;
        break;
      case 'ArrowLeft':
        this.selectedObject.position.x -= step;
        break;
      case 'ArrowRight':
        this.selectedObject.position.x += step;
        break;
    }
    
    this.showStatus(`Fine move: ${this.selectedObject.position.x.toFixed(1)}, ${this.selectedObject.position.z.toFixed(1)}`, 500);
    this.updateObjectList();
  }
  
  removeModel(modelName) {
    if (modelName.startsWith('collision_')) {
      this.showStatus('Cannot remove built-in collision shapes', 2000);
      return;
    }
    
    this.availableModels.delete(modelName);
    if (this.selectedModel === modelName) {
      this.selectedModel = null;
    }
    this.updateModelList();
    this.showStatus(`Removed: ${modelName}`, 1500);
  }
  
  handleWorldClick(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    if (this.currentMode === 'select') {
      this.handleSelectClick();
    } else if (this.currentMode === 'place') {
      this.handlePlaceClick();
    } else if (this.currentMode === 'move') {
      this.handleMoveClick();
    }
  }
  
  handleSelectClick() {
    const allPlacedObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
    const placedMeshes = [];
    
    allPlacedObjects.forEach(obj => {
      obj.traverse(child => {
        if (child.isMesh) {
          child.userData.parentObject = obj;
          placedMeshes.push(child);
        }
      });
    });
    
    const intersects = this.raycaster.intersectObjects(placedMeshes);
    
    if (intersects.length > 0) {
      //root placed object
      let targetObject = intersects[0].object;
      while (targetObject.parent && targetObject.userData.type !== 'world-builder-object') {
        targetObject = targetObject.parent;
      }
      if (targetObject.userData.type === 'world-builder-object') {
        this.selectObject(targetObject);
        return;
      }
    }
    this.clearSelection();
  }
  
  handlePlaceClick() {
    if (!this.selectedModel) {
      this.showStatus('Select a model first (press 1-9 or click in library)', 2000);
      return;
    }
    
    //ground surfaces for placement
    const groundObjects = [];
    this.scene.children.forEach(child => {
      if (child.geometry && child.geometry.type === 'PlaneGeometry') {
        groundObjects.push(child);
      }
      if (child.userData && child.userData.type === 'collision') {
        groundObjects.push(child);
      }
    });
    
    const groundIntersects = this.raycaster.intersectObjects(groundObjects);
    if (groundIntersects.length > 0) {
      this.placeModel(groundIntersects[0].point);
    } else {
      this.showStatus('Click on the ground to place object', 2000);
    }
  }
  

placeModel(position) {
  if (!this.selectedModel || !this.availableModels.has(this.selectedModel)) return;
  
  const modelData = this.availableModels.get(this.selectedModel);
  const modelClone = modelData.scene.clone();
  modelClone.position.copy(position);
  modelClone.position.y = Math.max(position.y, 0);
  const uniqueId = Date.now() + Math.random();
  const instanceName = `${this.selectedModel}_${uniqueId}`;
  
  modelClone.userData = {
    type: 'world-builder-object',
    modelName: this.selectedModel,        // Original model name
    instanceId: uniqueId,                 // Unique instance ID
    instanceName: instanceName,           //Unique name for saving
    id: uniqueId,
    created: new Date().toISOString(),
    isCollisionShape: modelData.isCollisionShape || false,
    shapeType: modelData.shapeType || null
  };
  
  this.scene.add(modelClone);
  
  if (modelData.isCollisionShape) {
    this.placedCollisionBoxes.push(modelClone);
    this.showStatus(`Placed collision: ${this.selectedModel}`, 1500);
    console.log('Placed collision shape at:', modelClone.position);
  } else {
    this.placedObjects.push(modelClone);
    this.showStatus(`Placed: ${this.selectedModel}`, 1500);
    console.log('Placed model at:', modelClone.position);
  }
  this.selectObject(modelClone);
  this.updateObjectList();
}
  
  selectObject(object) {
    if (this.selectedObject) {
      this.removeSelectionHighlight(this.selectedObject);
    }
    
    this.selectedObject = object;
    if (object) {
      this.addSelectionHighlight(object);
      
      const type = object.userData.isCollisionShape ? 'collision' : 'object';
      const icon = object.userData.isCollisionShape ? 'tg' : 'kd';
      this.showStatus(`${icon} Selected: ${object.userData.modelName} (${type})`, 1500);
    }
    this.updateObjectList();
  }
  
  addSelectionHighlight(object) {
    object.traverse(child => {
      if (child.isMesh && child.material) {
        const wireframe = new THREE.WireframeGeometry(child.geometry);
        const line = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ color: 0x00ffff }));
        line.name = 'selection-highlight';
        child.add(line);
      }
    });
  }
  
  removeSelectionHighlight(object) {
    object.traverse(child => {
      const highlight = child.getObjectByName('selection-highlight');
      if (highlight) {
        child.remove(highlight);
      }
    });
  }
  
  clearSelection() {
    if (this.selectedObject) {
      this.removeSelectionHighlight(this.selectedObject);
      this.selectedObject = null;
    }
    this.updateObjectList();
  }
  
  openRotationPanel() {
    if (!this.selectedObject) return;
    
    const rotation = this.selectedObject.rotation;
    const xDeg = Math.round(rotation.x * 180 / Math.PI);
    const yDeg = Math.round(rotation.y * 180 / Math.PI);
    const zDeg = Math.round(rotation.z * 180 / Math.PI);
    document.getElementById('wb-rot-x').value = xDeg;
    document.getElementById('wb-rot-y').value = yDeg;
    document.getElementById('wb-rot-z').value = zDeg;
    document.getElementById('wb-rot-x-num').value = xDeg;
    document.getElementById('wb-rot-y-num').value = yDeg;
    document.getElementById('wb-rot-z-num').value = zDeg;
    
    this.rotationPanel.style.display = 'block';
  }
  
  deleteSelected() {
    if (!this.selectedObject) return;
    
    const modelName = this.selectedObject.userData.modelName;
    const isCollision = this.selectedObject.userData.isCollisionShape;
    
    this.scene.remove(this.selectedObject);
    
    if (isCollision) {
      this.placedCollisionBoxes = this.placedCollisionBoxes.filter(obj => obj !== this.selectedObject);
      this.showStatus(` Deleted collision: ${modelName}`, 1500);
    } else {
      this.placedObjects = this.placedObjects.filter(obj => obj !== this.selectedObject);
      this.showStatus(` Deleted: ${modelName}`, 1500);
    }
    
    this.selectedObject = null;
    this.updateObjectList();
  }
  
  duplicateSelected() {
    if (!this.selectedObject) return;
    
    const original = this.selectedObject;
    const modelData = this.availableModels.get(original.userData.modelName);
    if (!modelData) return;
    const duplicate = modelData.scene.clone();
    duplicate.position.copy(original.position);
    duplicate.position.x += 2;
    duplicate.position.z += 2;
    duplicate.rotation.copy(original.rotation);
    duplicate.scale.copy(original.scale);
    
    duplicate.userData = {
      type: 'world-builder-object',
      modelName: original.userData.modelName,
      id: Date.now() + Math.random(),
      created: new Date().toISOString(),
      isCollisionShape: original.userData.isCollisionShape || false,
      shapeType: original.userData.shapeType || null
    };
    
    this.scene.add(duplicate);
    
    if (original.userData.isCollisionShape) {
      this.placedCollisionBoxes.push(duplicate);
      this.showStatus(`Duplicated collision: ${original.userData.modelName}`, 1500);
    } else {
      this.placedObjects.push(duplicate);
      this.showStatus(` Duplicated: ${original.userData.modelName}`, 1500);
    }
    
    this.selectObject(duplicate);
    this.updateObjectList();
  }
  
  updateObjectList() {
  const container = document.getElementById('wb-object-list');
  const countElement = document.getElementById('wb-object-count');
  
  if (!container || !countElement) return;
  
  const allObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
  countElement.textContent = allObjects.length;
  
  if (allObjects.length === 0) {
    container.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">No objects placed</div>';
    return;
  }
  
  const modelCounts = {};
  allObjects.forEach(obj => {
    const modelName = obj.userData.modelName;
    if (!modelCounts[modelName]) {
      modelCounts[modelName] = { count: 0, objects: [], isCollision: obj.userData.isCollisionShape };
    }
    modelCounts[modelName].count++;
    modelCounts[modelName].objects.push(obj);
  });
  
  let html = '';
  Object.entries(modelCounts).forEach(([modelName, data]) => {
    const icon = data.isCollision ? 'rg' : 'ld';
    const bgColor = data.isCollision ? 'rgba(255,0,255,0.05)' : 'rgba(255,255,255,0.05)';
    
    html += `
      <div style="
        padding: 4px; margin: 1px 0; background: ${bgColor};
        border-radius: 2px; font-size: 9px; border: 1px solid transparent;
      ">
        <strong>${icon} ${modelName}</strong> 
        <span style="color: #ffff00;">(${data.count}x)</span><br>
        <span style="color: #888; font-size: 8px;">Click objects individually to select</span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}
  
  selectObjectByIndex(index) {
    const allObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
    if (index < allObjects.length) {
      this.selectObject(allObjects[index]);
    }
  }
  
  saveWorld() {
    const allObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
    
    const worldData = {
      version: '1.0',
      created: new Date().toISOString(),
      objects: allObjects.map(obj => ({
        modelName: obj.userData.modelName,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        userData: obj.userData
      }))
    };
    
    localStorage.setItem('world-builder-save', JSON.stringify(worldData));
    
    const blob = new Blob([JSON.stringify(worldData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-save-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showStatus(`World saved (${allObjects.length} objects)`, 2000);
    console.log('World saved:', worldData);
  }
  
  async loadWorld() {
    const stored = localStorage.getItem('world-builder-save');
    if (!stored) {
      this.showStatus('No saved world found', 2000);
      return;
    }
    
    try {
      const worldData = JSON.parse(stored);
      
      this.placedObjects.forEach(obj => this.scene.remove(obj));
      this.placedCollisionBoxes.forEach(box => this.scene.remove(box));
      this.placedObjects = [];
      this.placedCollisionBoxes = [];
      this.clearSelection();
      
      for (const objData of worldData.objects) {
        if (this.availableModels.has(objData.modelName)) {
          const modelData = this.availableModels.get(objData.modelName);
          const obj = modelData.scene.clone();
          
          obj.position.set(objData.position.x, objData.position.y, objData.position.z);
          obj.rotation.set(objData.rotation.x, objData.rotation.y, objData.rotation.z);
          obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
          obj.userData = objData.userData;
          
          this.scene.add(obj);
          
          if (modelData.isCollisionShape || objData.userData.isCollisionShape) {
            this.placedCollisionBoxes.push(obj);
          } else {
            this.placedObjects.push(obj);
          }
        }
      }
      
      this.updateObjectList();
      this.showStatus(`Loaded ${worldData.objects.length} objects`, 2000);
      
    } catch (error) {
      console.error('Failed to load world:', error);
      this.showStatus('Failed to load world', 2000);
    }
  }
  
  loadWorldConfig() {
    const stored = localStorage.getItem('world-builder-save');
    if (stored) {
      console.log('Found saved world data');
    }
  }
  
  setupAutoSave() {
    setInterval(() => {
      const allObjects = [...this.placedObjects, ...this.placedCollisionBoxes];
      if (allObjects.length > 0) {
        const worldData = {
          version: '1.0',
          created: new Date().toISOString(),
          objects: allObjects.map(obj => ({
            modelName: obj.userData.modelName,
            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
            scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
            userData: obj.userData
          }))
        };
        localStorage.setItem('world-builder-autosave', JSON.stringify(worldData));
        console.log('Auto-saved world');
      }
    }, 5 * 60 * 1000);
  }
  
  showStatus(message, duration = 2000) {
    this.statusIndicator.textContent = message;
    this.statusIndicator.style.display = 'block';
    
    setTimeout(() => {
      if (this.isBuilderMode) {
        this.statusIndicator.textContent = 'WORLD BUILDER ACTIVE';
      } else {
        this.statusIndicator.style.display = 'none';
      }
    }, duration);
  }
  
  destroy() {
    this.placedObjects.forEach(obj => this.scene.remove(obj));
    this.placedCollisionBoxes.forEach(box => this.scene.remove(box));
    this.builderPanel.remove();
    this.rotationPanel.remove();
    this.statusIndicator.remove();
    this.clearSelection();
  }
}
export { WorldBuilder };
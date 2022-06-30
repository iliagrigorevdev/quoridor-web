
const PICK_AREA_HEIGHT = 0; // TODO check intersection in 2d
const PAWN_PICK_AREA_RADIUS = 0.25;
const PAWN_PICK_AREA_OFFSET_Z = 0.001;
const FENCE_PICK_AREA_DX = 0.125;
const FENCE_PICK_AREA_DY = 0.1;
const FENCE_PICK_AREA_OFFSET_X = 0.225;

const WHITE_PIECE_COLOR = [0.5, 0.5, 0.5];
const BLACK_PIECE_COLOR = [0.25, 0.25, 0.25];
const BOARD_COLOR = [135 / 255, 92 / 255, 60 / 255];
const SELECTION_BASE_COLOR = [0.2, 1, 0.2];
const SELECTION_ALTERNATE_COLOR = [0.2, 1, 1];
const THINKING_COLOR = [1, 0, 0];
const CROWN_COLOR = [1, 0.8, 0.3];

const CURVED_ANIMATION_END_TIME = 0.8;
const STRAIGHT_ANIMATION_END_TIME = 0.4;

const CAMERA_FOV = 40;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100;
const CAMERA_DISTANCE = 9;
const POINTER_DRAG_THRESHOLD = 3;
const POINTER_DRAG_THRESHOLD_SQUARED = POINTER_DRAG_THRESHOLD * POINTER_DRAG_THRESHOLD;
const POINTER_DRAG_FACTOR = 0.003;
const ELEVATION_MIN = 0.02 * Math.PI;
const ELEVATION_MAX = 0.48 * Math.PI;
const DEFAULT_ELEVATION = 0.25 * Math.PI;
const DEFAULT_WHITE_HEADING = -0.15 * Math.PI;
const DEFAULT_BLACK_HEADING = Math.PI - DEFAULT_WHITE_HEADING;

const iblUrl = "res/env_ibl.ktx";
const skyUrl = "res/env_skybox.ktx";

const pawnMeshUrl = "res/pawn.filamesh";
const fenceMeshUrl = "res/fence.filamesh";
const boardMeshUrl = "res/board.filamesh";
const movementMeshUrl = "res/movement.filamesh";
const placementMeshUrl = "res/placement.filamesh";
const thinkingMeshUrl = "res/thinking.filamesh";
const crownMeshUrl = "res/crown.filamesh";

const pieceMaterialUrl = "res/piece.filamat";
const boardMaterialUrl = "res/board.filamat";
const crownMaterialUrl = "res/crown.filamat";
const thinkingMaterialUrl = "res/thinking.filamat";
const selectionMaterialUrl = "res/selection.filamat";

const assets = [iblUrl, skyUrl, pawnMeshUrl, fenceMeshUrl, boardMeshUrl,
                movementMeshUrl, placementMeshUrl, thinkingMeshUrl,
                crownMeshUrl, pieceMaterialUrl, boardMaterialUrl,
                crownMaterialUrl, thinkingMaterialUrl, selectionMaterialUrl];

function convertVector(x, y, z = 0) {
  return vec3.fromValues(y, z, -x);
}

function convertBox(minX, minY, minZ, maxX, maxY, maxZ) {
  const minimum = convertVector(minX, minY, minZ);
  const maximum = convertVector(maxX, maxY, maxZ);
  for (let i = 0; i < 3; i++) {
    if (minimum[i] > maximum[i]) {
      const v = minimum[i];
      minimum[i] = maximum[i];
      maximum[i] = v;
    }
  }
  return {
    minimum: minimum,
    maximum: maximum
  };
}

const canvas = document.getElementsByTagName("canvas")[0];
const gl = canvas.getContext("webgl2");
if (gl) {
  Filament.init(assets, () => {
    window.app = new App(canvas);
  });
} else {
  const link = document.createElement("a");
  link.appendChild(document.createTextNode("support"));
  link.href = "https://caniuse.com/webgl2";
  const paragraph = document.createElement("p");
  paragraph.appendChild(document.createTextNode("Your browser does not "));
  paragraph.appendChild(link);
  paragraph.appendChild(document.createTextNode(" WebGL 2.0, or it is an experimental feature that is disabled."));
  paragraph.style.margin = "10px";
  const container = document.getElementById("container");
  container.removeChild(canvas);
  container.appendChild(paragraph);
}

class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.boardDimension = 5;
    this.boardOffset = (this.boardDimension - 1) / 2;

    this.players = null;
    this.movements = null;
    this.placements = null;
    this.current = -1;
    this.human = -1;
    this.predicting = false;
    this.lastTime = undefined;
    this.animatingPiece = null;
    this.animationTime = 0;
    this.animationEndTime = 0;
    this.actionResult = null;

    this.pawnRenderables = [];
    this.fenceRenderables = [];
    this.movementRenderables = [];
    this.placementRenderables = new Map();
    this.boardRenderable = null;
    this.thinkingRenderable = null;
    this.crownRenderable = null;

    this.elevation = DEFAULT_ELEVATION;
    this.heading = DEFAULT_WHITE_HEADING;
    this.pressing = false;
    this.dragging = false;
    this.pointerX = 0;
    this.pointerY = 0;

    this.engine = Filament.Engine.create(canvas);
    this.scene = this.engine.createScene();

    this.pawnMesh = this.engine.loadFilamesh(pawnMeshUrl);
    this.fenceMesh = this.engine.loadFilamesh(fenceMeshUrl);
    this.boardMesh = this.engine.loadFilamesh(boardMeshUrl);
    this.movementMesh = this.engine.loadFilamesh(movementMeshUrl);
    this.placementMesh = this.engine.loadFilamesh(placementMeshUrl);
    this.thinkingMesh = this.engine.loadFilamesh(thinkingMeshUrl);
    this.crownMesh = this.engine.loadFilamesh(crownMeshUrl);

    this.playerMaterials = this.createMaterials(pieceMaterialUrl,
                                                [WHITE_PIECE_COLOR, BLACK_PIECE_COLOR]);
    this.boardMaterial = this.createMaterial(boardMaterialUrl, BOARD_COLOR);
    this.selectionBaseMaterial = this.createMaterial(selectionMaterialUrl, SELECTION_BASE_COLOR);
    this.selectionAlternateMaterial = this.createMaterial(selectionMaterialUrl, SELECTION_ALTERNATE_COLOR);
    this.thinkingMaterial = this.createMaterial(thinkingMaterialUrl, THINKING_COLOR);
    this.crownMaterial = this.createMaterial(crownMaterialUrl, CROWN_COLOR);

    const sunlight = Filament.EntityManager.get().create();
    Filament.LightManager.Builder(Filament.LightManager$Type.SUN)
        .intensity(100000)
        .direction([-0.7, -0.5, -0.5])
        .castShadows(true)
        .build(this.engine, sunlight);
    this.scene.addEntity(sunlight);

    const indirectLight = this.engine.createIblFromKtx1(iblUrl);
    indirectLight.setIntensity(100000);
    indirectLight.setRotation(mat3.fromQuat(mat3.create(), quat.fromEuler(quat.create(), 0, 120, 0)));
    this.scene.setIndirectLight(indirectLight);

    const skybox = this.engine.createSkyFromKtx1(skyUrl);
    this.scene.setSkybox(skybox);

    this.swapChain = this.engine.createSwapChain();
    this.renderer = this.engine.createRenderer();
    this.camera = this.engine.createCamera(Filament.EntityManager.get().create());
    this.view = this.engine.createView();
    this.view.setCamera(this.camera);
    this.view.setScene(this.scene);
    this.dirty = 3;
    this.resize();

    this.step = this.step.bind(this);
    this.resize = this.resize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    window.requestAnimationFrame(this.step);

    Quoridor().then(instance => {
      this.quoridor = instance;
      this.quoridor.createGame = this.quoridor.cwrap("createGame", null, ["number"], {async: true});
      this.quoridor.predictAction = this.quoridor.cwrap("predictAction", "number", [], {async: true});
      this.quoridor.createGame(this.boardDimension).then(() => this.startGame());
    });
  }

  startGame() {
    this.quoridor.resetGame();
    const fenceCount = this.quoridor.getFenceCount();
    const pawnPositions = this.quoridor.getPawnPositions();
    const fenceOffset = Math.round((this.boardDimension - fenceCount) / 2);
    const whitePlayer = new Player(fenceCount);
    const blackPlayer = new Player(fenceCount);
    whitePlayer.pawn.move(-this.boardOffset + pawnPositions.whiteNx,
                          -this.boardOffset + pawnPositions.whiteNy,
                          0, false);
    blackPlayer.pawn.move(-this.boardOffset + pawnPositions.blackNx,
                          -this.boardOffset + pawnPositions.blackNy,
                          0, false);
    for (let i = 0; i < fenceCount; i++) {
      whitePlayer.fences[i].move(-this.boardOffset - 1.5,
                                 -this.boardOffset - 0.5 + fenceOffset + i,
                                 0, false);
      blackPlayer.fences[i].move(this.boardOffset + 1.5,
                                 this.boardOffset + 0.5 - fenceOffset - i,
                                 0, false);
    }
    this.players = [whitePlayer, blackPlayer];
    this.current = 0;
    this.human = (this.human + 1) % 2;
    this.predicting = false;
    this.animatingPiece = null;
    this.actionResult = this.quoridor.ActionResult.CONTINUE;

    this.elevation = DEFAULT_ELEVATION;
    this.heading = (this.human == 0 ? DEFAULT_WHITE_HEADING : DEFAULT_BLACK_HEADING);
    this.updateCamera();

    this.prepareView(fenceCount);
    this.showActions();
    this.showThinking();
    this.hideCrown();
  }

  prepareView(fenceCount) {
    if (this.boardRenderable == null) {
      this.boardRenderable = this.createRenderable(this.boardMaterial, this.boardMesh,
                                                   true, true, true);
    }
    if (this.thinkingRenderable == null) {
      this.thinkingRenderable = this.createRenderable(this.thinkingMaterial, this.thinkingMesh,
                                                      false, true, false);
    }
    if (this.crownRenderable == null) {
      this.crownRenderable = this.createRenderable(this.crownMaterial, this.crownMesh,
                                                   false, true, false);
    }

    for (let i = 0; i < this.players.length; i++) {
      const playerMaterial = this.playerMaterials[i];
      if (i == this.pawnRenderables.length) {
        this.pawnRenderables.push(this.createRenderable(playerMaterial, this.pawnMesh,
                                                        true, true, true));
      }
      if (i == this.fenceRenderables.length) {
        this.fenceRenderables.push([]);
      }
      const playerFenceRenderables = this.fenceRenderables[i];
      while (playerFenceRenderables.length < fenceCount) {
        playerFenceRenderables.push(this.createRenderable(playerMaterial, this.fenceMesh,
                                                          false, true, true));
      }
      playerFenceRenderables.forEach(fenceRenderable => this.scene.remove(fenceRenderable));
      const player = this.players[i];
      const pawnRenderable = this.pawnRenderables[i];
      player.pawn.renderable = pawnRenderable;
      this.syncPiece(player.pawn);
      for (let j = 0; j < fenceCount; j++) {
        const fenceRenderable = playerFenceRenderables[j];
        const fence = player.fences[j];
        fence.renderable = fenceRenderable;
        this.scene.addEntity(fenceRenderable);
        this.syncPiece(fence);
      }
    }
    this.dirty = 3;
  }

  syncPiece(piece) {
    this.setTransform(piece.renderable, piece.x, piece.y, piece.z, piece.rotation);
    this.dirty = 3;
  }

  hideActions() {
    this.movementRenderables.forEach(movementRenderable => {
      this.scene.remove(movementRenderable);
    });
    this.placementRenderables.forEach(placementRenderable => {
      this.scene.remove(placementRenderable);
    });
    this.movements = [];
    this.placements = [];
    this.dirty = 3;
  }

  showActions() {
    this.hideActions();

    if (this.current != this.human) {
      return;
    }

    const player = this.players[this.current];
    const opponent = this.players[1 - this.current];

    const validActionMovements = this.quoridor.validActionMovements();
    for (let i = 0; i < validActionMovements.size(); i++) {
      const actionMovement = validActionMovements.get(i);
      let x = player.pawn.x + actionMovement.movement.dx;
      let y = player.pawn.y + actionMovement.movement.dy;
      if ((Math.abs(x - opponent.pawn.x) < 1e-6) &&
          (Math.abs(y - opponent.pawn.y) < 1e-6)) { // jump over opponent
        x += actionMovement.movement.dx;
        y += actionMovement.movement.dy;
      }
      this.movements.push({
        action: actionMovement.action,
        pickPosition: convertVector(x, y)
      });
      if (i == this.movementRenderables.length) {
        this.movementRenderables.push(this.createRenderable(this.selectionBaseMaterial,
                                      this.movementMesh, false, false, false));
      }
      const movementRenderable = this.movementRenderables[i];
      this.setTransform(movementRenderable, x, y, PAWN_PICK_AREA_OFFSET_Z, 0);
      this.scene.addEntity(movementRenderable);
    }

    const validActionPlacements = this.quoridor.validActionPlacements();
    for (let i = 0; i < validActionPlacements.size(); i++) {
      const actionPlacement = validActionPlacements.get(i);
      const x = -this.boardOffset + 0.5 + actionPlacement.placement.nx;
      const y = -this.boardOffset + 0.5 + actionPlacement.placement.ny;
      const dx = (actionPlacement.placement.horizontal ? FENCE_PICK_AREA_DX : FENCE_PICK_AREA_DY);
      const dy = (actionPlacement.placement.horizontal ? FENCE_PICK_AREA_DY : FENCE_PICK_AREA_DX);
      const offsetX = (actionPlacement.placement.horizontal ? FENCE_PICK_AREA_OFFSET_X : 0);
      const offsetY = (actionPlacement.placement.horizontal ? 0 : FENCE_PICK_AREA_OFFSET_X);
      this.placements.push({
        action: actionPlacement.action,
        pickBoxes: [
          convertBox(x - offsetX - dx, y - offsetY - dy, 0,
                     x - offsetX + dx, y - offsetY + dy, PICK_AREA_HEIGHT),
          convertBox(x + offsetX - dx, y + offsetY - dy, 0,
                     x + offsetX + dx, y + offsetY + dy, PICK_AREA_HEIGHT)
        ]
      });
      if (!this.placementRenderables.has(actionPlacement.action)) {
        const selectionMaterial = (((actionPlacement.placement.nx & 1) == 1) ==
                                   ((actionPlacement.placement.ny & 1) == 1)
                                   ? this.selectionBaseMaterial : this.selectionAlternateMaterial);
        this.placementRenderables.set(actionPlacement.action, this.createRenderable(
                                      selectionMaterial, this.placementMesh, false, false, false));
      }
      const placementRenderable = this.placementRenderables.get(actionPlacement.action);
      this.setTransform(placementRenderable, x, y, 0,
                        (actionPlacement.placement.horizontal ? 0 : 90));
      this.scene.addEntity(placementRenderable);
    }
  }

  hideThinking() {
    this.scene.remove(this.thinkingRenderable);
    this.dirty = 3;
  }

  showThinking() {
    this.hideThinking();

    if (this.current == this.human) {
      return;
    }

    const player = this.players[this.current];

    this.setTransform(this.thinkingRenderable, player.pawn.x, player.pawn.y, 0, 0);
    this.scene.addEntity(this.thinkingRenderable);
  }

  hideCrown() {
    this.scene.remove(this.crownRenderable);
    this.dirty = 3;
  }

  showCrown() {
    this.hideCrown();

    let winner;
    if (this.actionResult == this.quoridor.ActionResult.PLAYER_WIN) {
      winner = this.players[1 - this.current];
    } else if (this.actionResult == this.quoridor.ActionResult.NO_GOAL_PATH) {
      winner = this.players[this.current];
    }

    if (winner !== undefined) {
      this.setTransform(this.crownRenderable, winner.pawn.x, winner.pawn.y, 0, 0);
      this.scene.addEntity(this.crownRenderable);
    }
  }

  executeAction(action) {
    if (this.actionResult != this.quoridor.ActionResult.CONTINUE) {
      return;
    }

    const player = this.players[this.current];
    const opponent = this.players[1 - this.current];

    if (this.quoridor.isMovementAction(action)) {
      this.actionResult = this.quoridor.executeAction(action);
      const pawnPositions = this.quoridor.getPawnPositions();
      const nx = (this.current == 0 ? pawnPositions.whiteNx : pawnPositions.blackNx);
      const ny = (this.current == 0 ? pawnPositions.whiteNy : pawnPositions.blackNy);
      const x = -this.boardOffset + nx;
      const y = -this.boardOffset + ny;
      const lift = ((Math.abs(player.pawn.x - x) > 0.5) &&
                    (Math.abs(player.pawn.y - y) > 0.5)) || // diagonal move
                   ((Math.abs((player.pawn.x + x) / 2 - opponent.pawn.x) < 1e-6) &&
                    (Math.abs((player.pawn.y + y) / 2 - opponent.pawn.y) < 1e-6)); // jump over opponent
      player.pawn.move(x, y, 0, true, lift);
      this.animatingPiece = player.pawn;
      this.animationEndTime = (lift ? CURVED_ANIMATION_END_TIME : STRAIGHT_ANIMATION_END_TIME);
    } else {
      if (player.remainFenceCount == 0) {
        throw new Error("No available fence");
      }
      const placement = this.quoridor.actionToPlacement(action);
      this.actionResult = this.quoridor.executeAction(action);
      const fence = player.fences[player.fences.length - player.remainFenceCount];
      fence.move(-this.boardOffset + 0.5 + placement.nx,
                 -this.boardOffset + 0.5 + placement.ny,
                 (placement.horizontal ? 0 : 90),
                 true);
      player.remainFenceCount--;
      this.animatingPiece = fence;
      this.animationEndTime = CURVED_ANIMATION_END_TIME;
    }

    this.animationTime = 0;
    this.hideActions();
    this.hideThinking();
  }

  updateAnimation(deltaTime) {
    if (this.animatingPiece == null) {
      return;
    }

    this.animationTime += deltaTime;
    const alpha = Math.min(this.animationTime / this.animationEndTime, 1);
    this.animatingPiece.update(alpha);
    this.syncPiece(this.animatingPiece);

    if (this.animationTime >= this.animationEndTime) {
      this.current = 1 - this.current;
      this.predicting = false;
      this.animatingPiece = null;
      if (this.actionResult == this.quoridor.ActionResult.CONTINUE) {
        this.showActions();
        this.showThinking();
      } else {
        this.showCrown();
      }
    }
  }

  updatePrediction() {
    if ((this.current == -1) || (this.current == this.human) ||
        this.predicting || (this.animatingPiece != null) || (this.dirty > 0) ||
        (this.actionResult != this.quoridor.ActionResult.CONTINUE)) {
      return;
    }

    this.predicting = true;
    this.quoridor.predictAction().then(action => {
      this.executeAction(action);
      this.lastTime = undefined;
    });
  }

  getBoundingBox(renderable) {
    const renderableManager = this.engine.getRenderableManager();
    const renderableInstance = renderableManager.getInstance(renderable);
    const boundingBox = renderableManager.getAxisAlignedBoundingBox(renderableInstance);
    renderableInstance.delete();
    return boundingBox;
  }

  createMaterial(materialUrl, color) {
    return this.createMaterials(materialUrl, [color])[0];
  }

  createMaterials(materialUrl, colors) {
    const material = this.engine.createMaterial(materialUrl);
    const materialInstances = [];
    for (const color of colors) {
      const materialInstance = material.createInstance();
      materialInstance.setColor3Parameter("color", Filament.RgbType.sRGB, color);
      materialInstances.push(materialInstance);
    }
    return materialInstances;
  }

  createRenderable(material, mesh, addToScene, castShadows, receiveShadows) {
    const renderable = Filament.EntityManager.get().create();
    Filament.RenderableManager.Builder(1)
        .boundingBox(this.getBoundingBox(mesh.renderable))
        .material(0, material)
        .geometry(0, Filament.RenderableManager$PrimitiveType.TRIANGLES,
                  mesh.vertexBuffer, mesh.indexBuffer)
        .castShadows(castShadows)
        .receiveShadows(receiveShadows)
        .build(this.engine, renderable);
    if (addToScene) {
      this.scene.addEntity(renderable);
    }
    return renderable;
  }

  setTransform(entity, x, y, z, rotation) {
    const transformManager = this.engine.getTransformManager();
    const transformInstance = transformManager.getInstance(entity);
    const transform = mat4.fromRotationTranslation(mat4.create(),
                      quat.fromEuler(quat.create(), 0, rotation, 0),
                      convertVector(x, y, z));
    transformManager.setTransform(transformInstance, transform);
    transformInstance.delete();
  }

  getCastingRay(clientX, clientY) {
    const dpr = window.devicePixelRatio;
    const x = (2 * clientX * dpr) / this.canvas.width - 1;
    const y = 1 - (2 * clientY * dpr) / this.canvas.height;
    const rayVec = vec4.fromValues(x, y, -1, 1);
    vec4.transformMat4(rayVec, rayVec, Filament.Camera.inverseProjection(
                       this.camera.getProjectionMatrix()));
    rayVec[2] = -1;
    rayVec[3] = 0;
    vec4.transformMat4(rayVec, rayVec, this.camera.getModelMatrix());
    const direction = vec3.fromValues(rayVec[0], rayVec[1], rayVec[2]);
    vec3.normalize(direction, direction);
    return {
      origin: this.camera.getPosition(),
      direction: direction
    };
  }

  step(timestamp) {
    if (this.lastTime === undefined) {
      this.lastTime = timestamp;
    }
    const deltaTime = 1e-3 * (timestamp - this.lastTime);
    this.lastTime = timestamp;

    this.updateAnimation(deltaTime);

    this.updatePrediction();

    if (this.dirty > 0) {
      this.render();
      this.dirty--;
    }

    window.requestAnimationFrame(this.step);
  }

  render() {
    this.renderer.render(this.swapChain, this.view);
  }

  resize() {
    const dpr = window.devicePixelRatio;
    const width = this.canvas.width = window.innerWidth * dpr;
    const height = this.canvas.height = window.innerHeight * dpr;
    this.view.setViewport([0, 0, width, height]);
    this.camera.setProjectionFov(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR,
                                 Filament.Camera$Fov.VERTICAL);
    this.updateCamera();
  }

  updateCamera() {
    const eye = [0, 0, CAMERA_DISTANCE];
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    vec3.rotateX(eye, eye, center, -this.elevation);
    vec3.rotateY(eye, eye, center, -this.heading);
    this.camera.lookAt(eye, center, up);
    this.dirty = 3;
  }

  isPrimaryPointer(e) {
    return (e.pointerType !== "touch") || e.isPrimary;
  }

  handlePointerDown(e) {
    if (!this.isPrimaryPointer(e) || (this.current == -1)) {
      return;
    }

    this.pressing = true;
    this.dragging = false;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  }

  handlePointerUp(e) {
    if (!this.isPrimaryPointer(e) || (this.current == -1)) {
      return;
    }

    if (!this.dragging) {
      if (this.actionResult == this.quoridor.ActionResult.CONTINUE) {
        const ray = this.getCastingRay(e.clientX, e.clientY);

        let movementHitDistance;
        let pickedMovementAction;
        for (const movement of this.movements) {
          const hitDistance = intersectCylinderY(ray, movement.pickPosition, PAWN_PICK_AREA_RADIUS,
                                                PICK_AREA_HEIGHT);
          if ((hitDistance !== undefined) && ((movementHitDistance === undefined) ||
              (hitDistance < movementHitDistance))) {
            movementHitDistance = hitDistance;
            pickedMovementAction = movement.action;
          }
        }

        let placementHitDistance;
        let pickedPlacementAction;
        for (const placement of this.placements) {
          for (const pickBox of placement.pickBoxes) {
            const hitDistance = intersectBox(ray, pickBox.minimum, pickBox.maximum);
            if ((hitDistance !== undefined) && ((placementHitDistance === undefined) ||
                (hitDistance < placementHitDistance))) {
              placementHitDistance = hitDistance;
              pickedPlacementAction = placement.action;
            }
          }
        }

        if ((pickedMovementAction !== undefined) && ((pickedPlacementAction === undefined) ||
            (movementHitDistance <= placementHitDistance))) {
          this.executeAction(pickedMovementAction);
        } else if (pickedPlacementAction !== undefined) {
          this.executeAction(pickedPlacementAction);
        }
      } else {
        this.startGame();
      }
    }

    this.pressing = false;
  }

  handlePointerMove(e) {
    if (!this.isPrimaryPointer(e) || (this.current == -1) || !this.pressing) {
      return;
    }

    const dx = e.clientX - this.pointerX;
    const dy = e.clientY - this.pointerY;
    if (this.dragging) {
      this.elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX,
                       this.elevation + dy * POINTER_DRAG_FACTOR));
      this.heading = (this.heading + dx * POINTER_DRAG_FACTOR) % (2 * Math.PI);
      this.updateCamera();
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    } else {
      const dragDistanceSquared = dx * dx + dy * dy;
      if (dragDistanceSquared >= POINTER_DRAG_THRESHOLD_SQUARED) {
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;
        this.dragging = true;
      }
    }
  }
}

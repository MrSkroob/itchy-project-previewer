"use strict";
(() => {
  // src/stage/stage.ts
  var vscode = acquireVsCodeApi();
  var STAGE_WIDTH = 480;
  var STAGE_HEIGHT = 360;
  var BACKDROP_Z_INDEX = 0;
  var stage = document.getElementById("stage-container");
  var stagePane = document.getElementById("stage-pane");
  var spriteProperties = document.getElementById("sprite-properties");
  var propertyTemplate = document.querySelector("template");
  var selectedSprite;
  var clamp = (num, min, max) => Math.min(Math.max(num, min), max);
  var COPY_ICON = "M4 4V1h11v11h-3v3H1V4h3zm1 0h7v7h2V2H5v2zm6 1H2v9h9V5z";
  var CHECK_ICON = "M6.27 10.87 2.7 7.3l1.06-1.06 2.51 2.51 5.97-5.97L13.3 3.84z";
  var PropertyViewer = class {
    selectedSprite;
    node;
    property;
    propertyNameNode;
    propertyValueNode;
    input;
    select;
    readonly;
    constructor(parent, template, property) {
      this.property = property;
      this.readonly = property.readonly;
      const fragment = template.content.cloneNode(true);
      const node = fragment.firstElementChild;
      if (!node) {
        throw new Error("Property template must have a root element.");
      }
      this.node = node;
      const propertyNameNode = this.node.querySelector(".property-name");
      const propertyValueNode = this.node.querySelector(".property-input");
      if (!propertyNameNode || !propertyValueNode) {
        throw new Error("Property template is missing required elements.");
      }
      this.propertyNameNode = propertyNameNode;
      this.propertyValueNode = propertyValueNode;
      this.propertyNameNode.textContent = property.label;
      if (property.options) {
        const select = document.createElement("select");
        for (const option of property.options) {
          const selection = document.createElement("option");
          selection.value = option.value;
          selection.textContent = option.name;
          select.appendChild(selection);
        }
        this.select = select;
        this.propertyValueNode.appendChild(select);
        this.select.addEventListener("change", this.onChange);
        this.select.style.minWidth = "120px";
      } else {
        const input = document.createElement("input");
        input.readOnly = this.readonly;
        this.input = input;
        this.propertyValueNode.appendChild(input);
        this.propertyValueNode.addEventListener("change", this.onChange);
        if (property.kind == "string") {
          this.input.style.minWidth = "100px";
        } else if (property.kind == "number") {
          this.input.style.minWidth = "45px";
        }
      }
      const copyButton = this.node.querySelector(".copy-button");
      copyButton?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(
          this.getInput().value
        );
        const path = this.node.querySelector(
          ".copy-button path"
        );
        if (!path) {
          return;
        }
        path.setAttribute("d", CHECK_ICON);
        setTimeout(() => {
          path.setAttribute("d", COPY_ICON);
        }, 1500);
        vscode.postMessage({
          type: "copiedToClipboard"
        });
      });
      parent.appendChild(this.node);
    }
    getInput() {
      if (this.select) {
        return this.select;
      }
      if (this.input) {
        return this.input;
      }
      throw new Error("this doesn't have any inputs...");
    }
    onChange = (_) => {
      if (!this.selectedSprite) {
        return;
      }
      const input = this.getInput();
      const oldValue = String(this.selectedSprite[this.property.property]);
      if (this.readonly) {
        input.value = oldValue;
        return;
      }
      let value;
      if (this.property.kind == "number") {
        value = Number(input.value);
        if (Number.isNaN(value)) {
          return;
        }
        this.selectedSprite[this.property.property] = value;
      } else {
        value = input.value;
        this.selectedSprite[this.property.property] = value;
      }
      if (this.property.property === "name") {
        vscode.postMessage({
          type: "renameSprite",
          oldName: oldValue,
          newName: String(value)
        });
      }
    };
    selectSprite(sprite) {
      this.selectedSprite = sprite;
      this.update();
    }
    clear() {
      this.selectedSprite = void 0;
    }
    update() {
      if (!this.selectedSprite) {
        return;
      }
      const value = this.selectedSprite[this.property.property];
      this.propertyNameNode.textContent = this.property.label;
      this.getInput().value = String(value);
    }
  };
  var properties = [
    { property: "x", label: "X", kind: "number", readonly: false },
    { property: "y", label: "Y", kind: "number", readonly: false },
    { property: "size", label: "Size", kind: "number", readonly: false },
    { property: "rotation", label: "Direction", kind: "number", readonly: false },
    {
      property: "rotationStyle",
      label: "Rotation Style",
      kind: "string",
      options: [
        {
          name: "Left-Right",
          value: "left-right"
        },
        {
          name: "All Around",
          value: "all around"
        },
        {
          name: "Don't Rotate",
          value: "don't rotate"
        }
      ],
      readonly: false
    }
  ];
  var viewers = [];
  var nameViewer = new PropertyViewer(spriteProperties, propertyTemplate, { property: "name", label: "Name", kind: "string", readonly: false });
  viewers.push(nameViewer);
  properties.forEach((property) => {
    viewers.push(new PropertyViewer(spriteProperties, propertyTemplate, property));
  });
  function updateViewers(sprite) {
    viewers.forEach((viewer) => {
      viewer.selectSprite(sprite);
    });
  }
  var sprites = /* @__PURE__ */ new Map();
  var spriteOrder = [];
  var stageScale = 1;
  function resizeStage() {
    const parent = stagePane;
    if (!parent) {
      return;
    }
    stageScale = Math.min(
      parent.clientWidth / STAGE_WIDTH,
      parent.clientHeight / STAGE_HEIGHT
    );
    stage.style.width = `${STAGE_WIDTH}px`;
    stage.style.height = `${STAGE_HEIGHT}px`;
    stage.style.transform = `scale(${stageScale})`;
  }
  function bringToFront(sprite) {
    const name = sprite.name;
    if (name.toLowerCase() === "stage") {
      return;
    }
    const index = spriteOrder.indexOf(name);
    if (index !== -1) {
      spriteOrder.splice(index, 1);
    }
    spriteOrder.push(name);
    updateLayers();
  }
  function updateLayers() {
    spriteOrder.forEach((name, layer) => {
      const sprite = sprites.get(name);
      if (!sprite) {
        return;
      }
      sprite.setLayer(layer);
      sprite.getSprite().style.zIndex = String(layer + 1);
    });
  }
  var Sprite = class {
    _size = 100;
    // Scratch coordinates
    _x = 0;
    _y = 0;
    _layer = 0;
    _rotation = 90;
    _rotationStyle = "all around";
    _costumeNumber = 0;
    name;
    costumes;
    costumeElements = [];
    sprite;
    stage;
    dragging = false;
    offsetX = 0;
    offsetY = 0;
    trueX = 0;
    trueY = 0;
    getLayer() {
      return this._layer;
    }
    setLayer(value) {
      this._layer = value;
    }
    get costumeNumber() {
      return this._costumeNumber + 1;
    }
    set costumeNumber(value) {
      this.switchCostumeTo(value - 1);
    }
    get size() {
      return this._size;
    }
    set size(value) {
      this._size = value;
      this.setSize(value / 100);
    }
    get x() {
      return this._x;
    }
    set x(value) {
      this.trueX = value;
      this.updatePosition();
    }
    get y() {
      return this._y;
    }
    set y(value) {
      this.trueY = value;
      this.updatePosition();
    }
    get layer() {
      return this._layer;
    }
    get rotation() {
      return this._rotation;
    }
    set rotation(value) {
      this.setRotation(value - 90);
    }
    get rotationStyle() {
      return this._rotationStyle;
    }
    set rotationStyle(value) {
      this._rotationStyle = value;
      this.setRotation(this._rotation - 90);
    }
    constructor(name, stage2, costumes) {
      this.name = name;
      this.costumes = costumes;
      this.stage = stage2;
      this.sprite = document.createElement("div");
      this.sprite.dataset.spriteId = name;
      if (name.toLowerCase() !== "stage") {
        this.sprite.className = "sprite";
        this.sprite.addEventListener("pointerdown", this.onMouseDown);
        this.sprite.addEventListener("pointerup", this.onMouseUp);
        this.sprite.addEventListener("pointermove", this.onMouseMove);
      } else {
        this.sprite.className = "backdrop";
        this.sprite.style.zIndex = String(BACKDROP_Z_INDEX);
      }
      for (const costume of costumes) {
        const image = document.createElement("img");
        image.src = costume;
        image.draggable = false;
        this.costumeElements.push(image);
      }
      this.stage.appendChild(this.sprite);
      if (this.costumeElements.length > 0) {
        this.switchCostumeTo(0);
      }
      this.updatePosition();
    }
    getSprite() {
      return this.sprite;
    }
    getCostume(index) {
      if (index < 0 || index >= this.costumeElements.length) {
        return;
      }
      return this.costumeElements[index];
    }
    switchCostumeTo(index) {
      const image = this.getCostume(index);
      if (!image) {
        return;
      }
      this._costumeNumber = index;
      this.setRotation(this._rotation - 90);
      this.setSize(this._size / 100);
      this.sprite.replaceChildren(image);
    }
    setSize(size) {
      this._size = size * 100;
      const image = this.getCostume(this._costumeNumber);
      if (!image) {
        return;
      }
      const minScale = Math.max(
        5 / image.naturalWidth,
        5 / image.naturalHeight
      );
      const scale = Math.max(size, minScale);
      image.style.scale = String(scale);
    }
    setRotation(degrees) {
      const image = this.getCostume(this._costumeNumber);
      if (!image) {
        return;
      }
      let rotation = degrees;
      this._rotation = degrees + 90;
      switch (this._rotationStyle) {
        case "left-right":
          if (degrees + 90 > 180) {
            rotation = 90;
          } else {
            rotation = 0;
          }
          break;
        case "all around":
          break;
        case "don't rotate":
          rotation = 0;
          break;
        default:
          break;
      }
      image.style.transform = `rotate(${rotation}deg)`;
    }
    updatePosition() {
      let x = Math.round(this.trueX);
      let y = Math.round(this.trueY);
      x = clamp(x, -(STAGE_WIDTH / 2), STAGE_WIDTH / 2);
      y = clamp(y, -(STAGE_HEIGHT / 2), STAGE_HEIGHT / 2);
      this.sprite.style.left = `${STAGE_WIDTH / 2 + Math.round(this.trueX)}px`;
      this.sprite.style.top = `${STAGE_HEIGHT / 2 - Math.round(this.trueY)}px`;
    }
    remove() {
      if (selectedSprite && selectedSprite.name === this.name) {
        selectedSprite = void 0;
      }
      this.sprite.remove();
    }
    pointerToScratch(event) {
      const stageRect = this.stage.getBoundingClientRect();
      const scaleX = stageRect.width / STAGE_WIDTH;
      const scaleY = stageRect.height / STAGE_HEIGHT;
      const stageX = (event.clientX - stageRect.left) / scaleX;
      const stageY = (event.clientY - stageRect.top) / scaleY;
      return {
        x: stageX - STAGE_WIDTH / 2,
        y: STAGE_HEIGHT / 2 - stageY
      };
    }
    onMouseMove = (event) => {
      if (!this.dragging) {
        return;
      }
      const pointer = this.pointerToScratch(event);
      this.trueX = pointer.x - this.offsetX;
      this.trueY = pointer.y - this.offsetY;
      this.updatePosition();
    };
    onMouseDown = (event) => {
      this.dragging = true;
      const pointer = this.pointerToScratch(event);
      this.sprite.setPointerCapture(event.pointerId);
      this.offsetX = pointer.x - this.trueX;
      this.offsetY = pointer.y - this.trueY;
      selectedSprite = this;
      bringToFront(this);
    };
    onMouseUp = (event) => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      const pointer = this.pointerToScratch(event);
      this.trueX = pointer.x - this.offsetX;
      this.trueY = pointer.y - this.offsetY;
      this._x = Math.round(this.trueX);
      this._y = Math.round(this.trueY);
      this.offsetX = 0;
      this.offsetY = 0;
      this.updatePosition();
      updateViewers(this);
    };
    toJSON() {
      return {
        name: this.name,
        size: this.size,
        x: this.x,
        y: this.y,
        layer: this.layer,
        costumeNumber: this.costumeNumber,
        rotation: this.rotation,
        rotationStyle: this.rotationStyle
      };
    }
    fromJSON(state) {
      this.x = state.x;
      this.y = state.y;
      this.name = state.name;
      this._layer = state.layer;
      this.rotation = state.rotation;
      this.size = state.size;
      this.rotationStyle = state.rotationStyle;
      this.costumeNumber = state.costumeNumber;
    }
  };
  function exportSpriteData() {
    const spriteData = [];
    sprites.forEach((sprite) => {
      spriteData.push(sprite.toJSON());
    });
    const message = {
      type: "postSaveData",
      stageState: spriteData
    };
    console.log("Sending save data...");
    vscode.postMessage(message);
  }
  function showNoProject() {
    removeAllSprites();
    const message = document.createElement("div");
    message.className = "empty-stage";
    message.textContent = "Open an Itchy project to preview the stage.";
    stage.appendChild(message);
  }
  function addSprite(spriteData, withData) {
    removeSprite(spriteData.name);
    const sprite = new Sprite(
      spriteData.name,
      stage,
      spriteData.costumes
    );
    if (withData) {
      sprite.fromJSON(withData);
    }
    sprites.set(spriteData.name, sprite);
    if (spriteData.name.toLowerCase() !== "stage") {
      spriteOrder.push(spriteData.name);
      spriteOrder.sort((a, b) => {
        const layer1 = sprites.get(a).getLayer();
        const layer2 = sprites.get(b).getLayer();
        if (layer1 == layer2) {
          return 0;
        } else if (layer1 > layer2) {
          return 1;
        } else {
          return -1;
        }
      });
    }
    console.log(spriteOrder);
    updateLayers();
    return sprite;
  }
  function removeSprite(name) {
    const sprite = sprites.get(name);
    if (!sprite) {
      return;
    }
    sprite.remove();
    sprites.delete(name);
    const index = spriteOrder.indexOf(name);
    if (index !== -1) {
      spriteOrder.splice(index, 1);
    }
    updateLayers();
  }
  function removeAllSprites() {
    for (const sprite of sprites.values()) {
      sprite.remove();
    }
    sprites.clear();
    spriteOrder.length = 0;
  }
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "addSprite":
        const sprite = addSprite(message.sprite);
        if (message.sprite?.data) {
          sprite.fromJSON(message.sprite.data);
        }
        break;
      case "removeSprite":
        removeSprite(message.sprite.name);
        break;
      case "removeAllSprites":
        removeAllSprites();
        break;
      case "noProject":
        showNoProject();
        break;
      case "requestSaveData":
        exportSpriteData();
        break;
    }
  });
  window.addEventListener("resize", resizeStage);
  resizeStage();
})();
//# sourceMappingURL=stage.js.map

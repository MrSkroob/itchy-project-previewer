import { Message, SpriteData, ObjectState, CostumeData } from "../messageTypes";
import { BaseSprite, BaseBackdrop, BaseInstance } from "./vm/objects";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./common/constants";
import { handleCopyButton, CodeSpaceViewer, PropertyDefinition, PropertyViewer, cloneCopyButton, codeTextHTML, codeSpaceHTML, propertyTemplate } from "./spriteProperties";


const stage = document.getElementById("stage-container")!;
const stagePane = document.getElementById("stage-pane")!;

const spriteProperties = document.getElementById("sprite-properties")!;


function rebuildViewers() {
    viewers.forEach(viewer => {
        viewer.rebuild(true);
    });
}


function targetViewers(sprite?: BaseInstance) {
    viewers.forEach(viewer => {
        viewer.selectSprite(sprite);
    });
}


function updateViewers() {
    viewers.forEach(viewer => {
        viewer.update();
    });
}


class Backdrop extends BaseBackdrop {
    constructor(stage: HTMLElement, costumes: CostumeData[]) {
        super(stage, costumes);

        this.sprite.className = "backdrop";
        this.sprite.addEventListener("pointerdown", this.onMouseDown);
    }

    private onMouseDown = (_: PointerEvent) => {
        targetViewers(this);
    };
}


class Sprite extends BaseSprite {
    private dragging = false; // to be moved

    private offsetX = 0;
    private offsetY = 0;

    constructor(name: string, stage: HTMLElement, costumes: CostumeData[]) {
        super(name, stage, costumes);

        this.sprite.addEventListener("pointerdown", this.onMouseDown);
        this.sprite.addEventListener("pointerup", this.onMouseUp);
        this.sprite.addEventListener("pointermove", this.onMouseMove);
    }

    private pointerToScratch(event: PointerEvent) {
        const stageRect = this.stage.getBoundingClientRect();

        const scaleX = stageRect.width / STAGE_WIDTH;
        const scaleY = stageRect.height / STAGE_HEIGHT;

        const stageX =
            (event.clientX - stageRect.left) / scaleX;

        const stageY =
            (event.clientY - stageRect.top) / scaleY;

        return {
            x: stageX - STAGE_WIDTH / 2,
            y: STAGE_HEIGHT / 2 - stageY
        };
    }

    private onMouseMove = (event: PointerEvent) => {
        if (!this.dragging) {
            return;
        }

        const pointer = this.pointerToScratch(event);
        // this._x = pointer.x;
        // this._y = pointer.y;

        this._x = pointer.x - this.offsetX;
        this._y = pointer.y - this.offsetY;        

        this.updatePosition();
    };

    private onMouseDown = (event: PointerEvent) => {
        this.dragging = true;
        const pointer = this.pointerToScratch(event);

        this.sprite.setPointerCapture(event.pointerId);

        // Remember where inside the sprite the user clicked.
        this.offsetX = pointer.x - this._x;
        this.offsetY = pointer.y - this._y;

        bringToFront(this);
        targetViewers(this);
    };

    private onMouseUp = (event: PointerEvent) => {
        if (!this.dragging) {
            return;
        }

        this.dragging = false;

        const pointer = this.pointerToScratch(event);

        // Preserve the original click offset.
        this._x = pointer.x - this.offsetX;
        this._y = pointer.y - this.offsetY;

        this.offsetX = 0;
        this.offsetY = 0;

        this.updatePosition();
        updateViewers();
    };
}

// Generating HTML for sprite properties
const properties: PropertyDefinition[] = [
    { property: "name", label: "Instance", kind: "string", options: [/* purposely left blank: to be filled in */], readonly: false, global: true},
    { property: "x", label: "X", kind: "number", readonly: false},
    { property: "y", label: "Y", kind: "number", readonly: false},
    { property: "size", label: "Size", kind: "number", readonly: false},
    { property: "rotation", label: "Direction", kind: "number", readonly: false},

    {
        property: "rotationStyle",
        label: "Rotation Style",
        kind: "string",
        options: [
            {
                name: "Left-Right", value: "left-right"
            }, 
            {
                name: "All Around", value: "all around"
            },
            {
                name: "Don't Rotate", value: "don't rotate"
            }
        ], 
        readonly: false
    },
    {
        property: "costumeName",
        label: "Costume Name",
        kind: "string",
        options: [], // to be filled in. purposely left blank
        readonly: false
    },
    {
        property: "visible",
        label: "Visible",
        kind: "boolean",
        readonly: false
    }
];

const codeButton = cloneCopyButton();
codeButton.title = "Copy code";

handleCopyButton(codeButton, { get value() {return codeTextHTML.textContent;} });
codeSpaceHTML.appendChild(codeButton);


// interfacing with the extension

const sprites: Map<string, Sprite | Backdrop> = new Map<string, Sprite | Backdrop>();
const spriteOrder: string[] = [];

const codespaceViewer = new CodeSpaceViewer();

const viewers: PropertyViewer[] = [];

properties.forEach(property => {
    viewers.push(new PropertyViewer(spriteProperties, propertyTemplate, property, sprites, codespaceViewer, targetViewers));
});


let stageScale = 1;

function resizeStage() {
    const parent = stagePane;

    if (!parent) {
        return;
    }

    stageScale = Math.min(
        parent.clientWidth / STAGE_WIDTH,
        parent.clientHeight / STAGE_HEIGHT,
    );
    

    stage.style.width = `${STAGE_WIDTH}px`;
    stage.style.height = `${STAGE_HEIGHT}px`;

    stage.style.transform = `scale(${stageScale})`;
}


function bringToFront(sprite: Sprite) {
    const name = sprite.name;
    if (name.toLowerCase() === "stage") {
        return;
    }

    const index = spriteOrder.indexOf(name);

    if (index !== -1) {
        spriteOrder.splice(index, 1);
    }

    spriteOrder.push(name);
    sprite.setLayer(spriteOrder.length);

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


function exportSpriteData() {
    const spriteData: ObjectState[] = [];
    sprites.forEach(sprite => {
        spriteData.push(sprite.toJSON());
    });

    const message: Message = {
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
    message.textContent =
        "Open an Itchy project to preview the stage.";

    stage.appendChild(message);
}


function addSprite(spriteData: SpriteData, withData?: ObjectState) {
    removeSprite(spriteData.name);

    let sprite: Sprite | Backdrop;
    const isStage = spriteData.name.toLowerCase() === "stage";

    if (isStage) {
        sprite = new Backdrop(stage, spriteData.costumes);
    } else {
        sprite = new Sprite(spriteData.name, stage, spriteData.costumes);
    }

    if (withData) {
        sprite.fromJSON(withData);
    }

    sprites.set(spriteData.name, sprite);
    rebuildViewers();

    if (!isStage) {
        spriteOrder.push(spriteData.name);
        spriteOrder.sort((a, b) => {
            const layer1 = sprites.get(a)!.getLayer();
            const layer2 = sprites.get(b)!.getLayer();

            if (layer1 === layer2) {
                return 0;
            }
            else if (layer1 > layer2) {
                return 1;
            }
            else {
                return -1;
            }
        });
    }

    updateLayers();

    return sprite;
}


function removeSprite(name: string) {
    const sprite = sprites.get(name);

    if (!sprite) {
        return;
    }

    sprite.remove();
    sprites.delete(name);
    targetViewers();
    rebuildViewers();

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


window.addEventListener("message", event => {
    const message: Message = event.data;

    switch (message.type) {
        case "addSprite":
            const sprite = addSprite(message.sprite!);
            if (message.sprite?.data) {
                sprite.fromJSON(message.sprite.data);
            }
            break;

        case "removeSprite":
            removeSprite(message.sprite!.name);
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


// window.addEventListener("resize", resizeStage);

// resizeStage();


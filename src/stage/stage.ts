import { Message, SpriteData, ObjectState, CostumeData } from "../messageTypes";
import { BaseSprite, BaseBackdrop, BaseInstance, Workspace } from "./vm/objects";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./common/constants";
import { handleCopyButton, CodeSpaceViewer, PropertyDefinition, PropertyViewer, cloneCopyButton, codeTextHTML, codeSpaceHTML, propertyTemplate } from "./spriteProperties";


const stageHTML = document.getElementById("stage-container")!;
const spriteProperties = document.getElementById("sprite-properties")!;


type ExecutionMode = "editing" | "running"

class Backdrop extends BaseBackdrop {
    private parent: Stage;

    constructor(data: SpriteData, stageHTML: HTMLElement, parent: Stage) {
        super(data, stageHTML);
        this.parent = parent;
        this.sprite.className = "backdrop";
        this.sprite.addEventListener("pointerdown", this.onMouseDown);
    }

    private onMouseDown = (_: PointerEvent) => {
        this.parent.targetViewers(this);
    };
}


class Sprite extends BaseSprite {
    private dragging = false; // to be moved

    private offsetX = 0;
    private offsetY = 0;
    private parent: Stage; 

    constructor(data: SpriteData, stage: HTMLElement, parent: Stage) {
        super(data, stage);
        this.parent = parent;
        this.sprite.addEventListener("pointerdown", this.onMouseDown);
        this.sprite.addEventListener("pointerup", this.onMouseUp);
        this.sprite.addEventListener("pointermove", this.onMouseMove);
    }

    private pointerToScratch(event: PointerEvent) {
        const stageRect = this.stageHTML.getBoundingClientRect();

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

        this.parent.bringToFront(this);
        this.parent.targetViewers(this);
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
        this.parent.updateViewers();
    };
}


// a class representing the current workspace
class Stage implements Workspace {
    private backdrop?: BaseBackdrop;
    private spriteOrder: string[] = [];
    private viewers: PropertyViewer[] = [];
    private codeSpaceViewer = new CodeSpaceViewer();
    readonly MAX_SPRITES = 100;

    private spriteCount = 0;
    public sprites: Map<string, BaseSprite | BaseBackdrop> = new Map();

    constructor() {
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

        this.addViewers(properties)
    }

    public targetViewers(sprite?: BaseInstance) {
        this.viewers.forEach(viewer => {
            viewer.selectSprite(sprite);
        })
    }

    public updateLayers() {
        this.spriteOrder.forEach((name, layer) => {
            const sprite = this.sprites.get(name);

            if (!sprite) {
                return;
            }
            sprite.setLayer(layer);
            sprite.getSprite().style.zIndex = String(layer + 1);
        });
    }


    public bringToFront(sprite: BaseSprite) {
        const name = sprite.name;
        const index = this.spriteOrder.indexOf(name);

        if (index !== -1) {
            this.spriteOrder.splice(index, 1);
        }

        this.spriteOrder.push(name);
        sprite.setLayer(this.spriteOrder.length);

        this.updateLayers();
    }

    public updateViewers() {
        this.viewers.forEach(viewer => {
            viewer.update();
        })
    }

    private rebuildViewers() {
        this.viewers.forEach(
            (viewer: PropertyViewer) => {
                viewer.rebuild(true);
            }
        )
    }

    public removeAllSprites() {
        for (const sprite of this.sprites.values()) {
            sprite.remove();
        }

        this.sprites.clear();
        this.spriteCount = 0;
        this.spriteOrder.length = 0;
    }

    public removeSprite(name: string) {
        const sprite = this.sprites.get(name);

        if (!sprite) {
            return;
        }

        this.spriteCount -= 1;

        sprite.remove();
        this.sprites.delete(name);
        this.targetViewers();
        this.rebuildViewers();

        const index = this.spriteOrder.indexOf(name);

        if (index !== -1) {
            this.spriteOrder.splice(index, 1);
        }

        this.updateLayers();
    }

    public addSprite(spriteData: SpriteData, withData?: ObjectState) {
        this.removeSprite(spriteData.name);

        if (this.spriteCount >= this.MAX_SPRITES) {
            return;
        }

        const sprite = new Sprite(spriteData, stageHTML, this);
        this.spriteCount += 1;

        if (withData) {
            sprite.fromJSON(withData);
        }

        this.sprites.set(spriteData.name, sprite);

        if (!spriteData.isClone) {
            // if this sprite is a clone anyway, don't rebuild viewers since they're not supposed to be targetable.
            this.rebuildViewers();
        }

        this.spriteOrder.push(spriteData.name);
        this.spriteOrder.sort((a, b) => {
            const layer1 = this.sprites.get(a)!.getLayer();
            const layer2 = this.sprites.get(b)!.getLayer();

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

        this.updateLayers();

        return sprite;
    }

    public setBackdrop(backdropData: SpriteData, withData?: ObjectState) {
        if (this.backdrop) {
            this.backdrop.remove();
        }
        this.backdrop = new Backdrop(backdropData, stageHTML, this);

        if (withData) {
            this.backdrop.fromJSON(withData);
        }

        this.sprites.set(backdropData.name, this.backdrop);
        this.rebuildViewers();
        this.updateLayers();
    }

    public addViewers(properties: PropertyDefinition[]) {
        const codeButton = cloneCopyButton();
        codeButton.title = "Copy code";

        handleCopyButton(codeButton, { get value() {return codeTextHTML.textContent;} });
        codeSpaceHTML.appendChild(codeButton);

        properties.forEach(property => {
            this.viewers.push(new PropertyViewer(
                spriteProperties, 
                propertyTemplate, 
                property, 
                this.codeSpaceViewer, 
                this
            ));
        });
    }

    public exportSpriteData() {
        const spriteData: ObjectState[] = [];
        this.sprites.forEach(sprite => {
            spriteData.push(sprite.toJSON());
        });

        const message: Message = {
            type: "postSaveData",
            stageState: spriteData
        };

        console.log("Sending save data...");

        vscode.postMessage(message);
    }

}


const workspace = new Stage();


function showNoProject() {
    const message = document.createElement("div");

    message.className = "empty-stage";
    message.textContent =
        "Open an Itchy project to preview the stage.";

    stageHTML.appendChild(message);
}

window.addEventListener("message", event => {
    const message: Message = event.data;

    switch (message.type) {
        case "addSprite":
            if (message.sprite!.name.toLowerCase() !== "stage") {
                workspace.addSprite(message.sprite!, message.sprite!.data);
            } else {
                workspace.setBackdrop(message.sprite!, message.sprite!.data)
            }
            break;

        case "removeSprite":
            workspace.removeSprite(message.sprite!.name);
            break;

        case "removeAllSprites":
            workspace.removeAllSprites();
            break;

        case "noProject":
            showNoProject();
            break;
            
        case "requestSaveData":
            workspace.exportSpriteData();
            break;
    }
});

import { Message, SpriteData, ObjectState, VariableData } from "./messageTypes";
import { BaseSprite, BaseBackdrop, BaseInstance, Workspace } from "./vm/objects";
// import { ItchyVM } from "./vm/itchyVM";
import { Renderer } from "./renderer/renderer";
import { STAGE_HEIGHT, STAGE_WIDTH, TICK_RATE } from "./common/constants";
import { handleCopyButton, CodeSpaceViewer, PropertyDefinition, PropertyViewer, cloneCopyButton, codeTextHTML, codeSpaceHTML, propertyTemplate } from "./spriteProperties";
import { ItchyVM } from "./vm/itchyVM";


interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

// trust me bro
declare function acquireVsCodeApi(): VsCodeApi;


declare global {
    var vscode: VsCodeApi;
}

globalThis.vscode = acquireVsCodeApi();

const canvas = document.getElementById("stage-canvas")! as HTMLCanvasElement;
const stageHTML = document.getElementById("stage-container")!;
const spriteProperties = document.getElementById("sprite-properties")!;


const glLoad = canvas.getContext("webgl2");

if (!glLoad) {
    throw new Error("This browser/device does not support webgl");
}

const gl = glLoad;


enum ExecutionMode {
    EDIT_TIME,
    RUN_TIME
}

// type ExecutionMode = 
//     | "edittime" // code execution does not occur; you can drag sprites around
//     | "runtime" // code execution mode; cannot edit sprites during runtime.

class Backdrop extends BaseBackdrop {
    private parent: Stage;

    constructor(data: SpriteData, stageHTML: HTMLElement, parent: Stage) {
        super(gl, data, stageHTML);
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
        super(gl, data, stage);
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

        super.setX(pointer.x - this.offsetX);
        super.setY(pointer.y - this.offsetY);        
    };

    private onMouseDown = (event: PointerEvent) => {
        this.dragging = true;
        const pointer = this.pointerToScratch(event);

        this.sprite.setPointerCapture(event.pointerId);

        // Remember where inside the sprite the user clicked.
        this.offsetX = pointer.x - this.getX();
        this.offsetY = pointer.y - this.getY();

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
        this.setX(pointer.x - this.offsetX);
        this.setY(pointer.y - this.offsetY);

        this.offsetX = 0;
        this.offsetY = 0;

        this.parent.updateViewers();
    };
}


// a class representing the current workspace
export class Stage implements Workspace {
    private renderer = new Renderer(canvas);
    private backdrop?: BaseBackdrop;
    private spriteOrder: BaseInstance[] = [];

    private viewers: PropertyViewer[] = [];
    private codeSpaceViewer = new CodeSpaceViewer();
    readonly MAX_SPRITES = 100;

    private spriteCount = 0;
    
    public sprites: Map<string, BaseSprite | BaseBackdrop> = new Map();
    public stageHTML: HTMLElement;

    private savedSpriteEdits: Map<BaseSprite, ObjectState> = new Map();

    private lastTime?: number;
    private accumulator = 0;

    private running = false;

    private prevState: Map<string, ObjectState> = new Map();
    private vm;

    constructor(stageHTML: HTMLElement) {
        // Generating HTML for sprite properties
        this.stageHTML = stageHTML;
        this.vm = new ItchyVM(TICK_RATE, this.sprites);
        const properties: PropertyDefinition[] = [
            { property: "name", label: "Instance", kind: "string", options: [/* purposely left blank: to be filled in */], global: true},
            { property: "x", label: "X", kind: "number"},
            { property: "y", label: "Y", kind: "number"},
            { property: "size", label: "Size", kind: "number"},
            { property: "rotation", label: "Direction", kind: "number"},

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
            },
            {
                property: "costumeName",
                label: "Costume Name",
                kind: "string",
                options: [], // to be filled in. purposely left blank
            },
            {
                property: "visible",
                label: "Visible",
                kind: "boolean",
            }
        ];

        this.addViewers(properties);
    }

    public updateVariables(data: VariableData[]) {
        data = data.filter((value) => {
            return !value.name.includes(":")
        })

        this.sprites.forEach((sprite) => {
            sprite.updateVariableRegistry(data);
        })

        data.forEach(element => {
            const sprite = this.sprites.get(element.owner);
            if (!sprite) { return; }

            if (element.type === "list") {
                sprite.addList(element.name);
            } else {
                sprite.addVariable(element.name);
            }
        });
    }

    public prepareRuntime() {
        this.sprites.forEach(
            (sprite, _) => {
                if (sprite instanceof BaseBackdrop) {
                    return;
                }
                this.savedSpriteEdits.set(sprite, sprite.toJSON());
                sprite.setVisible(false);
            }
        );
        this.targetViewers();
    }

    public targetViewers(sprite?: BaseInstance) {
        this.viewers.forEach(viewer => {
            viewer.selectSprite(sprite);
        });
    }

    public updateLayers() {
        this.spriteOrder.forEach((otherSprite, layer) => {
            const sprite = this.sprites.get(otherSprite.name);

            if (!sprite) {
                return;
            }
            sprite.setLayer(layer);
            sprite.getSprite().style.zIndex = String(layer + 1);
        });
    }

    public addToLayer(sprite: BaseInstance) {
        this.spriteOrder.push(sprite);
        this.spriteOrder.sort((a, b) => {
            const layer1 = a.getLayer();
            const layer2 = b.getLayer();

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

    public bringToFront(sprite: BaseSprite) {
        const index = this.spriteOrder.indexOf(sprite);

        if (index !== -1) {
            this.spriteOrder.splice(index, 1);
        }

        this.spriteOrder.push(sprite);
        sprite.setLayer(this.spriteOrder.length);

        this.updateLayers();
    }

    public updateViewers() {
        this.viewers.forEach(viewer => {
            viewer.update();
        });
    }

    private rebuildViewers() {
        this.viewers.forEach(
            (viewer: PropertyViewer) => {
                viewer.rebuild(true);
            }
        );
    }

    public removeAllSprites() {
        for (const sprite of this.sprites.values()) {
            this.renderer.removeDrawable(sprite.name);
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

        this.renderer.removeDrawable(name);

        this.prevState.delete(name);

        sprite.remove();
        this.sprites.delete(name);
        this.targetViewers();
        this.rebuildViewers();

        const index = this.spriteOrder.indexOf(sprite);

        if (index !== -1) {
            this.spriteOrder.splice(index, 1);
        }

        this.updateLayers();
    }

    public getSprite(name: string) {
        return this.sprites.get(name) as BaseSprite;
    }

    public async addSprite(spriteData: SpriteData) {
        this.removeSprite(spriteData.name);

        if (this.spriteCount >= this.MAX_SPRITES) {
            return;
        }

        const sprite = new Sprite(spriteData, this.stageHTML, this);
        this.spriteCount += 1;
        this.sprites.set(spriteData.name, sprite);

        this.prevState.set(spriteData.name, sprite.toJSON());

        await this.renderer.addDrawable(sprite.name, sprite);
        // this.renderer.render(this.spriteOrder);

        if (!spriteData.isClone) {
            // if this sprite is a clone anyway, don't rebuild viewers since they're not supposed to be targetable.
            this.rebuildViewers();
        }

        this.addToLayer(sprite);
        this.updateLayers();

        return sprite;
    }

    public async setBackdrop(backdropData: SpriteData) {
        if (this.backdrop) {
            this.backdrop.remove();
        }
        const backdrop = new Backdrop(backdropData, this.stageHTML, this);
        this.backdrop = backdrop;

        this.sprites.set(backdropData.name, backdrop);
        this.addToLayer(backdrop);

        this.prevState.set(backdropData.name, backdrop.toJSON());

        this.rebuildViewers();
        this.updateLayers();

        await this.renderer.addDrawable(backdropData.name, this.backdrop);
        // this.renderer.render(this.spriteOrder);
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

    public renderLoop = (time: number) => {
        if (this.lastTime === undefined) {
            this.lastTime = time;
        }

        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        this.accumulator += Math.min(deltaTime, 250);

        // Advance the simulation at a fixed tick rate.
        let steps = 0;

        if (this.running) {
            while (this.accumulator >= this.vm.msPerTick && steps < 5) {
                this.vm.step();
                this.accumulator -= this.vm.msPerTick;
                steps++;
            }
        }

        // Prevent excessive catch-up after a long pause.
        if (steps === 5) {
            this.accumulator = 0;
        }

        // Render the latest state.
        this.renderer.render(this.spriteOrder);

        requestAnimationFrame(this.renderLoop);
    }

    public execute(filePath: string) {
        // runs the ... runtime
        this.running = true;        
        this.vm.registerProgram(filePath);
        this.vm.start();

        this.lastTime = undefined;
        this.accumulator = 0;
    }

    public kill() {
        // kills the runtime
        this.running = false;
        this.vm.stop();

        this.sprites.forEach(element => {
            const prevState = this.prevState.get(element.name);
            if (!prevState) { return; }

            element.fromJSON(prevState);
        });
    }
}


const workspace = new Stage(stageHTML);
requestAnimationFrame(workspace.renderLoop);

function showNoProject() {
    workspace.removeAllSprites();

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
            // tolower 
            if (message.sprite!.name !== "stage") {
                workspace.addSprite(message.sprite!);
            } else {
                workspace.setBackdrop(message.sprite!);
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
        case "execute":
            if (!message.filePath) {
                return;
            }
            workspace.execute(message.filePath);
            break;
        case "kill":
            workspace.kill();
            // vm.stop();
            break;
        case "updateVars":
            const data = message.variableData;
            workspace.updateVariables(data!);
            break;
    }
});

import { Message, SpriteData, SpriteState } from "./messageTypes";


interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

// trust me bro
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;
const BACKDROP_Z_INDEX = 0;

const stage = document.getElementById("stage-container")!;
const stagePane = document.getElementById("stage-pane")!;

const spriteProperties = document.getElementById("sprite-properties")!;


// This is here to shut the linter up
let selectedSprite: Sprite | undefined;

type NumberProperty = 
    | "x"
    | "y"
    | "size"
    | "rotation"
    | "costumeNumber"
    // | "rotationStyle"


type StringProperty =
    | "rotationStyle"
    | "name";

type PropertyDefinition =
    | {
        options?: Option[];
        kind: "number";
        property: NumberProperty;
        label: string;
        readonly: boolean
    }
    | {
        options?: Option[];
        kind: "string";
        property: StringProperty;
        label: string;
        readonly: boolean
    };

// html element
interface Option {
    name: string,
    value: string
}

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
const COPY_ICON =
    "M4 4V1h11v11h-3v3H1V4h3zm1 0h7v7h2V2H5v2zm6 1H2v9h9V5z";

const CHECK_ICON =
    "M6.27 10.87 2.7 7.3l1.06-1.06 2.51 2.51 5.97-5.97L13.3 3.84z";

const propertyTemplate = document.getElementById("property-input-template") as HTMLTemplateElement;
const copyButtonTemplate = document.getElementById("copy-button-template") as HTMLTemplateElement;
const spritePropertiesCode = document.getElementById("code-template") as HTMLElement;
const codeSpace = document.getElementById("text-contents") as HTMLSpanElement;


function cloneTemplate(template: HTMLTemplateElement) {
    return (template.content
        .cloneNode(true) as DocumentFragment)
        .firstElementChild as HTMLElement | null;
}


function cloneButton() {
    return cloneTemplate(copyButtonTemplate)! as HTMLButtonElement;
}


interface HTMLElementWithValue {
    value: string;
}


function handleCopyButton(button: HTMLButtonElement, input: HTMLElementWithValue) {
    button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(
            input.value
        );

        const path = button.querySelector<SVGPathElement>(
            "path"
        );

        if (!path) {
            return;
        }

        path.setAttribute("d", CHECK_ICON);

        setTimeout(() => {
            path.setAttribute("d", COPY_ICON);
        }, 1500);

        vscode.postMessage({
            type: "copiedToClipboard",
        });
    });
}

class CodeSpaceViewer {
    size: number = 100;
    x: number = 0;
    y: number = 0;
    rotation: number = 90;
    rotationStyle: string = "all around";

    public setValue(propertyName: string, value: any) {
        switch (propertyName) {
            case "size":
                this.size = value;
                break;
            case "x":
                this.x = value;
                break;
            case "y":
                this.y = value;
                break;
            case "rotationStyle":
                this.rotationStyle = value;
                break;
            case "rotation":
                this.rotation = value;
                break;
            default:
                break;
        }
        console.log(this.getCode());
        codeSpace.textContent = this.getCode();
    }

    public getCode() {
        return `event event_whenflagclicked() {
    motion_pointindirection(${this.rotation});
    motion_gotoxy(${this.x}, ${this.y});
    looks_setsizeto(${this.size});
    motion_setrotationstyle("${this.rotationStyle}");
}
`;
    }
}


const codeSpaceViewer = new CodeSpaceViewer();


class PropertyViewer {
    private selectedSprite: Sprite | undefined;

    private node: HTMLElement;
    private property: PropertyDefinition;

    private propertyNameNode: HTMLElement;
    private propertyValueNode: HTMLElement;

    private input?: HTMLInputElement;
    private select?: HTMLSelectElement;

    private readonly: boolean;

    constructor(
        parent: HTMLElement,
        template: HTMLTemplateElement,
        property: PropertyDefinition
    ) {
        this.property = property;
        this.readonly = property.readonly;

        const node = cloneTemplate(template);

        if (!node) {
            throw new Error("Property template must have a root element.");
        }

        this.node = node;

        const propertyNameNode =
            this.node.querySelector<HTMLElement>(".property-name");

        const propertyValueNode =
            this.node.querySelector<HTMLElement>(".property-input");

        if (!propertyNameNode || !propertyValueNode) {
            throw new Error("Property template is missing required elements.");
        }

        const button = cloneButton(); 
        button.title = "Copy value";

        this.propertyNameNode = propertyNameNode;
        this.propertyValueNode = propertyValueNode;
        this.propertyValueNode.appendChild(button);

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
            this.select.className = "text";
            this.propertyValueNode.appendChild(select);
            this.select.addEventListener("change", this.onChange);
            this.select.style.minWidth = "120px";
        } else {
            const input = document.createElement("input");
            input.readOnly = this.readonly;
            this.input = input;
            this.input.className = "text";
            this.propertyValueNode.appendChild(input);
            this.propertyValueNode.addEventListener("change", this.onChange);

            if (property.kind === "string") {
                this.input.style.minWidth = "100px";
            }
            else if (property.kind === "number") {
                this.input.style.minWidth = "45px";
            }
        }

        handleCopyButton(button, this.getInput());
        parent.appendChild(this.node);
    }

    public getInput() {
        if (this.select) {
            return this.select;
        }

        if (this.input) {
            return this.input;
        }

        throw new Error("this doesn't have any inputs...");
    }

    private onChange = (_: Event) => {
        if (!this.selectedSprite) {
            return;
        }
        
        const input = this.getInput();
        const oldValue = String(this.selectedSprite[this.property.property]);

        if (this.readonly) {
            input.value = oldValue;
            return;
        }

        let value: number | string;
        if (this.property.kind === "number") {
            value = Number(input.value);
            if (Number.isNaN(value)) {
                return;
            }
            this.selectedSprite[this.property.property] = value; 
        }
        else {
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

        codeSpaceViewer.setValue(this.property.property, value);
    };

    public selectSprite(sprite: Sprite) {
        this.selectedSprite = sprite;
        this.update();
    }

    public clear() {
        this.selectedSprite = undefined;
    }

    public update() {
        if (!this.selectedSprite) {
            return;
        }

        const value =
            this.selectedSprite[this.property.property];

        this.propertyNameNode.textContent = this.property.label;
        this.getInput().value = String(value);
        codeSpaceViewer.setValue(this.property.property, value);
    }
}


const properties: PropertyDefinition[] = [
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
];

const viewers: PropertyViewer[] = [];

const nameViewer = new PropertyViewer(spriteProperties, propertyTemplate, {property: "name", label: "Name", kind: "string", readonly: false});
viewers.push(nameViewer);

const codeButton = cloneButton();
codeButton.title = "Copy code";

handleCopyButton(codeButton, { get value() {return codeSpace.textContent;} });
spritePropertiesCode.appendChild(codeButton);

properties.forEach(property => {
    viewers.push(new PropertyViewer(spriteProperties, propertyTemplate, property));
});


function updateViewers(sprite: Sprite) {
    viewers.forEach(viewer => {
        viewer.selectSprite(sprite);
    });
}


const sprites: Map<string, Sprite> = new Map<string, Sprite>();
const spriteOrder: string[] = [];

let stageScale = 1;

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
    // sprite.setLayer(spriteOrder.length);

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


class Sprite {
    private _size = 100;
    // Scratch coordinates
    private _x = 0;
    private _y = 0;

    private _layer = 0;
    private _rotation = 90;
    private _rotationStyle = "all around";
    private _costumeNumber = 0;

    name: string;

    costumes: string[];
    private costumeElements: HTMLImageElement[] = [];

    private sprite: HTMLDivElement;
    private stage: HTMLElement;

    private dragging = false;

    private offsetX = 0;
    private offsetY = 0;

    private trueX = 0;
    private trueY = 0;

    public getLayer() {
        return this._layer;
    }

    public setLayer(value: number) {
        this._layer = value;
    }

    public get costumeNumber() {
        return this._costumeNumber + 1;
    }

    public set costumeNumber(value: number) {
        // costume switcher updates _costumeNumber internally
        this.switchCostumeTo(value - 1);
    }

    public get size() {
        return this._size;
    }

    public set size(value: number) {
        // clamp

        this._size = value;
        this.setSize(value / 100);
    }

    public get x() {
        return this._x;
    }

    public set x(value: number) {
        this.trueX = value;
        this.updatePosition();
    }

    public get y() {
        return this._y;
    }

    public set y(value: number) {
        this.trueY = value;
        this.updatePosition();
    }

    public get layer() {
        return this._layer;
    }

    public get rotation() {
        return this._rotation;
    }

    public set rotation(value: number) {
        this.setRotation(value - 90);
    }

    public get rotationStyle() {
        return this._rotationStyle;
    }

    public set rotationStyle(value: string) {
        this._rotationStyle = value;
        this.setRotation(this._rotation - 90);
    }

    constructor(name: string, stage: HTMLElement, costumes: string[]) {
        this.name = name;
        this.costumes = costumes;
        this.stage = stage;

        this.sprite = document.createElement("div");
        this.sprite.dataset.spriteId = name;

        if (name.toLowerCase() !== "stage") {
            this.sprite.className = "sprite";
            this.sprite.addEventListener("pointerdown", this.onMouseDown);
            this.sprite.addEventListener("pointerup", this.onMouseUp);
            this.sprite.addEventListener("pointermove", this.onMouseMove);
        }
        else {
            this.sprite.className = "backdrop";
            this.sprite.style.zIndex = String(BACKDROP_Z_INDEX);
        }

        for (const costume of costumes) {
            const image = document.createElement("img");

            image.src = costume;
            image.draggable = false;

            this.costumeElements.push(image);
        }

        // Actually add the sprite to the HTML stage
        this.stage.appendChild(this.sprite);

        if (this.costumeElements.length > 0) {
            this.switchCostumeTo(0);
        }

        this.updatePosition();
    }

    public getSprite() {
        return this.sprite;
    }

    private getCostume(index: number) {
        if (index < 0 || index >= this.costumeElements.length) {
            return;
        }

        return this.costumeElements[index];
    }

    public switchCostumeTo(index: number) {
        const image = this.getCostume(index);

        if (!image) {
            return;
        }

        this._costumeNumber = index;

        this.setRotation(this._rotation - 90);
        this.setSize(this._size / 100);
        this.sprite.replaceChildren(image);
    }

    public setSize(size: number) {
        // this expects a number where 0 = 0% and 1 = 100%.
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

    private pointsLeft(direction: number) {
        direction = ((direction + 180) % 360 + 360) % 360 - 180;

        return direction < 0;
    }

    public setRotation(degrees: number) {
        // this expects rotational values starting from 0
        const image = this.getCostume(this._costumeNumber);

        if (!image) {
            return;
        }

        let rotation = degrees;
        this._rotation = degrees + 90;

        switch (this._rotationStyle) {
            case "left-right":
                image.style.transform =
                    this.pointsLeft(this._rotation)
                        ? "scaleX(-1)"
                        : "scaleX(1)";
                break;
            case "all around":
                image.style.transform = `rotate(${rotation}deg)`;
                break;
            case "don't rotate":
                rotation = 0;
                image.style.transform = `rotate(0deg)`;
                break;
            default:
                break;
        }
    }

    public updatePosition() {
        // Always use the logical 480x360 coordinate system.
        // CSS scaling handles how large the stage appears on screen.
        let x = Math.round(this.trueX);
        let y = Math.round(this.trueY);

        x = clamp(x, -(STAGE_WIDTH / 2), STAGE_WIDTH / 2);
        y = clamp(y, -(STAGE_HEIGHT / 2), STAGE_HEIGHT / 2);

        this.sprite.style.left =
            `${STAGE_WIDTH / 2 + Math.round(this.trueX)}px`;

        this.sprite.style.top =
            `${STAGE_HEIGHT / 2 - Math.round(this.trueY)}px`;
    }

    public remove() {
        if (selectedSprite && selectedSprite.name === this.name) {
            selectedSprite = undefined;
        }
        this.sprite.remove();
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

        this.trueX = pointer.x - this.offsetX;
        this.trueY = pointer.y - this.offsetY;        

        this.updatePosition();
    };

    private onMouseDown = (event: PointerEvent) => {
        this.dragging = true;
        const pointer = this.pointerToScratch(event);
        // this._x = pointer.x;
        // this._y = pointer.y;

        this.sprite.setPointerCapture(event.pointerId);

        // Remember where inside the sprite the user clicked.
        this.offsetX = pointer.x - this.trueX;
        this.offsetY = pointer.y - this.trueY;

        selectedSprite = this;

        bringToFront(this);
    };

    private onMouseUp = (event: PointerEvent) => {
        if (!this.dragging) {
            return;
        }

        this.dragging = false;

        const pointer = this.pointerToScratch(event);
        // this._x = pointer.x;
        // this._y = pointer.y;

        // Preserve the original click offset.
        this.trueX = pointer.x - this.offsetX;
        this.trueY = pointer.y - this.offsetY;

        this._x = Math.round(this.trueX);
        this._y = Math.round(this.trueY);

        this.offsetX = 0;
        this.offsetY = 0;

        this.updatePosition();
        updateViewers(this);
    };

    public toJSON(): SpriteState {
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

    public fromJSON(state: SpriteState) {
        this.x = state.x;
        this.y = state.y;
        this.name = state.name;
        this._layer = state.layer;
        this.rotation = state.rotation;
        this.size = state.size;
        this.rotationStyle = state.rotationStyle;
        this.costumeNumber = state.costumeNumber;
    }
}


function exportSpriteData() {
    const spriteData: SpriteState[] = [];
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


function addSprite(spriteData: SpriteData, withData?: SpriteState) {
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

    console.log(spriteOrder);

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


window.addEventListener("resize", resizeStage);

resizeStage();


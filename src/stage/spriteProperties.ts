import { BaseSprite } from "./vm/objects";
// import { Message, SpriteData, ObjectState, CostumeData } from "../messageTypes";

export const propertyTemplate = document.getElementById("property-input-template") as HTMLTemplateElement;
// const copyButtonTemplate = document.getElementById("copy-button-template") as HTMLTemplateElement;
export const codeSpaceHTML = document.getElementById("code-template") as HTMLElement;
export const codeTextHTML = document.getElementById("text-contents") as HTMLSpanElement;
const copyButtonTemplate = document.getElementById("copy-button-template") as HTMLTemplateElement;
const COPY_ICON =
    "M4 4V1h11v11h-3v3H1V4h3zm1 0h7v7h2V2H5v2zm6 1H2v9h9V5z";

const CHECK_ICON =
    "M6.27 10.87 2.7 7.3l1.06-1.06 2.51 2.51 5.97-5.97L13.3 3.84z";

function cloneTemplate(template: HTMLTemplateElement) {
    return (template.content
        .cloneNode(true) as DocumentFragment)
        .firstElementChild as HTMLElement | null;
}


export function cloneCopyButton() {
    return cloneTemplate(copyButtonTemplate)! as HTMLButtonElement;
}

interface HTMLElementWithValue {
    value: string;
}

export function handleCopyButton(button: HTMLButtonElement, input: HTMLElementWithValue) {
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

        globalThis.vscode.postMessage({
            type: "copiedToClipboard",
        });
    });
}


export class CodeSpaceViewer {
    size: number = 100;
    x: number = 0;
    y: number = 0;
    rotation: number = 90;
    rotationStyle: string = "all around";
    costumeName: string = "";

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
            case "costumeName":
                this.costumeName = value;
                break;
            default:
                break;
        }
        codeTextHTML.textContent = this.getCode();
    }

    public getCode() {
        if (this.costumeName) {
            return `event event_whenflagclicked() {
    motion_pointindirection(${this.rotation});
    motion_gotoxy(${this.x}, ${this.y});
    looks_setsizeto(${this.size});
    looks_switchcostumeto("${this.costumeName}");
    motion_setrotationstyle("${this.rotationStyle}");
}`;
        } else {
            return `event event_whenflagclicked() {
    motion_pointindirection(${this.rotation});
    motion_gotoxy(${this.x}, ${this.y});
    looks_setsizeto(${this.size});
    motion_setrotationstyle("${this.rotationStyle}");
}`;
        }

    }
}


type NumberProperty = 
    | "x"
    | "y"
    | "size"
    | "rotation"
    | "costumeNumber";
    // | "rotationStyle"


type StringProperty =
    | "rotationStyle"
    | "name"
    | "costumeName";

// html element
interface Option {
    name: string,
    value: string | number
}

export type PropertyDefinition =
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


export class PropertyViewer {
    private selectedSprite: BaseSprite | undefined;

    private node: HTMLElement;
    private property: PropertyDefinition;

    private propertyNameNode: HTMLElement;
    private propertyValueNode: HTMLElement;

    private input?: HTMLInputElement;
    private select?: HTMLSelectElement;

    private readonly: boolean;
    private codeSpaceViewer: CodeSpaceViewer;

    constructor(
        parent: HTMLElement,
        template: HTMLTemplateElement,
        property: PropertyDefinition,
        codeSpaceViewer: CodeSpaceViewer
    ) {
        this.codeSpaceViewer = codeSpaceViewer;
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

        const button = cloneCopyButton(); 
        button.title = "Copy value";

        this.propertyNameNode = propertyNameNode;
        this.propertyValueNode = propertyValueNode;
        this.propertyValueNode.appendChild(button);

        this.propertyNameNode.textContent = property.label;

        if (property.options) {
            this.propertyValueNode.appendChild(this.buildOptions(property.options));
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

    private buildOptions(options: Option[]) {
        let select: HTMLSelectElement;
        if (this.select) {
            this.select.replaceChildren();
            select = this.select;
        } else {
            select = document.createElement("select");
        }

        for (const option of options) {
            const selection = document.createElement("option");

            selection.value = String(option.value);
            selection.textContent = option.name;

            select.appendChild(selection);
        }

        this.select = select;
        this.select.className = "text";
        this.propertyValueNode.appendChild(select);
        this.select.addEventListener("change", this.onChange);
        this.select.style.minWidth = "120px";

        return select;
    }

    private costumeOptions(sprite: BaseSprite) {
        const options: Option[] = [];
        sprite.getCostumeMap().forEach(
            (_: number, costumeName: string) => {
                options.push({
                    name: costumeName,
                    value: costumeName
                });
            }
        );

        return options;
    }

    private getFillInOptions(sprite: BaseSprite, optionName: string): Option[] | null {
        switch (optionName) {
            case "costumeName":
                return this.costumeOptions(sprite);        
            default:
                break;
        }
        return null;
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

        this.codeSpaceViewer.setValue(this.property.property, value);
    };

    public selectSprite(sprite: BaseSprite) {
        this.selectedSprite = sprite;
        this.update();

        // we do this work outside of update because we don't want to refresh the list every time.
        const options = this.getFillInOptions(sprite, this.property.property);
        if (!options) { return; }
        this.buildOptions(options);
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
        this.codeSpaceViewer.setValue(this.property.property, value);
    }
}

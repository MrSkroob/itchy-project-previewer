export interface Texture {
    texture: WebGLTexture,
    width: number,
    height: number
};


export interface VariableData {
    name: string,
    owner: string,
    type: "list" | "variable",
    visible: boolean,
    x?: number,
    y?: number
}


export interface CachedTexture extends Texture {
    svgLevels?: WebGLTexture[];
}

export interface CostumeData {
    name: string;
    fsPath: string;
    extension: string;
    texture?: CachedTexture;
};


export interface SpriteData {
    name: string;
    costumes: CostumeData[];
    data?: ObjectState;
    isClone?: boolean;
};


export interface ObjectState {
    name: string;
    costumeNumber: number;
    visible: boolean;
    size: number;
    x: number;
    y: number;
    layer: number;
    rotation: number;
    rotationStyle: string;
    variableState: [string, VariableData][];
};


export interface Message {
    type: string;
    sprite?: SpriteData | null;
    stageState?: ObjectState[];
    filePath?: string;
    variableData?: VariableData[];
};

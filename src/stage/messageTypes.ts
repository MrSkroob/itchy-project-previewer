export interface Texture {
    texture: WebGLTexture,
    width: number,
    height: number
};


export interface CostumeData {
    name: string;
    fsPath: string;
    extension: string;
    texture?: Texture;
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
};


export interface Message {
    type: string;
    sprite?: SpriteData | null;
    stageState?: ObjectState[];
};

export interface CostumeData {
    name: string;
    fsPath: string;
}


export interface SpriteData {
    name: string;
    costumes: CostumeData[];
    data?: SpriteState;
}


export interface SpriteState {
    name: string;
    size: number;
    x: number;
    y: number;
    layer: number;
    costumeNumber: number;
    rotation: number;
    rotationStyle: string;
}


export interface Message {
    type: string;
    sprite?: SpriteData | null;
    stageState?: SpriteState[];
}

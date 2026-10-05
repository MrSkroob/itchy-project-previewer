export interface CostumeData {
    name: string;
    fsPath: string;
}


export interface SpriteData {
    name: string;
    costumes: CostumeData[];
    data?: ObjectState;
}


export interface ObjectState {
    name: string;
    costumeNumber: number;
    size: number;
    x: number;
    y: number;
    layer: number;
    rotation: number;
    rotationStyle: string;
}


export interface Message {
    type: string;
    sprite?: SpriteData | null;
    stageState?: ObjectState[];
}

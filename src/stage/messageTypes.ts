export interface SpriteData {
    name: string;
    costumes: string[];
}


export interface Message {
    type: string;
    sprite?: SpriteData | null;
}

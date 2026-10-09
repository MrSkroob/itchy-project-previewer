import { CostumeData } from "../../messageTypes";
import { shader as fragCode } from "./shaders/fragmentShader.glsl";
import { shader as vertCode } from "./shaders/vertexShader.glsl";


interface Image {
    texture: WebGLTexture,
    width: number,
    height: number
}


export async function rasteriseSVG(uri: string) {
    const image = new Image();

    image.src = uri;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error(`Could not rasterise image: {uri}`);
    }

    ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return canvas;
}


export async function createImageTexture(gl: WebGL2RenderingContext, uri: string) {
    const image = new Image();
    image.src = uri;
    await image.decode();

    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
    );
    
    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
    );

    return {
        texture: texture,
        width: image.naturalWidth,
        height: image.naturalHeight
    };
}

export async function createSVGImageTexture(gl: WebGL2RenderingContext, uri: string): Promise<Image> {
    const canvas = await rasteriseSVG(uri);
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
    );

    return {
        texture: texture,
        width: canvas.width,
        height: canvas.height
    };
}


export async function getTexture(gl: WebGL2RenderingContext, uri: string, fileExtension: string): Promise<Image> {
    switch (fileExtension) {
        case ".svg":
            return await createImageTexture(gl, uri);
        default:
            return await createImageTexture(gl, uri);
    }
}


export function createShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error("Could not create shader");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    const error = gl.getShaderInfoLog(shader) as string;
    gl.deleteShader(shader);

    throw new Error(error);
}


export function createGLProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    const error = gl.getProgramInfoLog(program) as string;
    gl.deleteProgram(program);

    throw new Error(error);
}


function setTexcoord(gl: WebGL2RenderingContext) {
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            [

            ]
        ),
        gl.STATIC_DRAW
    );
}


class SpriteShader {
    private program;
    private gl;

    private textures: Map<string, Image> = new Map();

    constructor(gl: WebGL2RenderingContext) {
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragCode);
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertCode);
        this.program = createGLProgram(gl, vertexShader, fragmentShader);
        this.gl = gl;

        const posBufferLocation = gl.getAttribLocation(this.program, "a_position");
        const texCoordLocation = gl.getAttribLocation(this.program, "a_texcoord");

        gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        // gl.bindBuffer(gl.)
    }

    public async registerImage(image: CostumeData) {
        const texture = await getTexture(this.gl, image.fsPath, image.extension);
        this.textures.set(image.name, texture)
    }

    public async deregisterImage(imageName: string) {
        const image = this.textures.get(imageName)!;
        
        this.gl.deleteTexture(image.texture);
        this.textures.delete(imageName);
    }

    public drawImage(imageName: string, x: number, y: number) {
        const image = this.textures.get(imageName)!;

        this.gl.bindTexture(this.gl.TEXTURE_2D, image.texture);
        this.gl.useProgram(this.program);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, );
    }
}
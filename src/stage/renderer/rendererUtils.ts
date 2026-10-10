import { Texture } from "../messageTypes";
import { STAGE_WIDTH, STAGE_HEIGHT } from "../common/constants";
import { shader as fragCode } from "./shaders/fragmentShader.glsl";
import { shader as vertCode } from "./shaders/vertexShader.glsl";


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

export async function createSVGImageTexture(gl: WebGL2RenderingContext, uri: string): Promise<Texture> {
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
        width: canvas.width,
        height: canvas.height
    };
}


export async function getTexture(gl: WebGL2RenderingContext, uri: string, fileExtension: string): Promise<Texture> {
    switch (fileExtension) {
        case ".svg":
            return await createSVGImageTexture(gl, uri);
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

    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    const error = gl.getProgramInfoLog(program) as string;
    gl.deleteProgram(program);
    throw new Error(error);
}


export class SpriteRenderer {
    private gl;
    private matrixUniformLocation;

    constructor(gl: WebGL2RenderingContext) {
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragCode);
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertCode);
        const program = createGLProgram(gl, vertexShader, fragmentShader);

        gl.useProgram(program);

        this.gl = gl;

        const vertexBuffer = gl.createBuffer();
        const posBufferLocation = gl.getAttribLocation(program, "a_position");
        const texCoordsLocation = gl.getAttribLocation(program, "a_texcoord");

        const imageBufferLocation = gl.getUniformLocation(program, "u_texture");
        this.matrixUniformLocation = gl.getUniformLocation(program, "u_matrix");

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(posBufferLocation);
        gl.vertexAttribPointer(posBufferLocation, 2, gl.FLOAT, false, 16, 0)

        gl.enableVertexAttribArray(texCoordsLocation);
        gl.vertexAttribPointer(texCoordsLocation, 2, gl.FLOAT, false, 16, 8)

        gl.uniform1i(imageBufferLocation, 0);

        gl.viewport(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.activeTexture(gl.TEXTURE0);
    }

    private getBuffer(image: Texture, x: number, y: number, scale = 1) {
        const width = image.width * scale;
        const height = image.height * scale;

        // Convert from Scratch coordinates to canvas coordinates.
        // Scratch: centre origin, positive Y points upwards.
        // Canvas: top-left origin, positive Y points downwards.
        const centreX = x + STAGE_WIDTH / 2;
        const centreY = STAGE_HEIGHT / 2 - y;

        const destinationLeft = centreX - width / 2;
        const destinationRight = centreX + width / 2;

        const destinationTop = centreY - height / 2;
        const destinationBottom = centreY + height / 2;

        // Texture coordinates.
        const textureLeft = 0;
        const textureRight = 1;
        const textureTop = 0;
        const textureBottom = 1;

        const vertices = new Float32Array([
            // Position                         Texture coordinates
            destinationLeft, destinationBottom, textureLeft, textureBottom,
            destinationRight, destinationBottom, textureRight, textureBottom,
            destinationLeft, destinationTop,    textureLeft, textureTop,

            destinationLeft, destinationTop,    textureLeft, textureTop,
            destinationRight, destinationBottom, textureRight, textureBottom,
            destinationRight, destinationTop,    textureRight, textureTop
        ]);

        // splurge our image to the canvas' bounds
        const projectionMatrix = new Float32Array([
            2 / STAGE_WIDTH, 0, 0, 0,
            0, -2 / STAGE_HEIGHT, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ]);

        const transformationMatrix = projectionMatrix;

        this.gl.uniformMatrix4fv(
            this.matrixUniformLocation,
            false,
            transformationMatrix
        );
        

        return vertices;
    }

    public clear() {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    private translate(matrix: Float32Array, x: number, y: number) {
        for (let row = 0; row < 4; row++) {
            matrix[12 + row] +=
                matrix[row] * x +
                matrix[4 + row] * y;
        }
    }

    private rotate(matrix: Float32Array, radians: number) {
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);

        for (let row = 0; row < 4; row++) {
            const horizontal = matrix[row];
            const vertical = matrix[4 + row];

            matrix[row] = horizontal * cosine + vertical * sine;
            matrix[4 + row] = vertical * cosine - horizontal * sine;
        }
    }

    private scale(matrix: Float32Array, horizontal: number, vertical: number) {
        for (let row = 0; row < 4; row++) {
            matrix[row] *= horizontal;
            matrix[4 + row] *= vertical;
        }
    }

    public drawImage(image: Texture, x: number, y: number, scale: number, rotation: number) {
        const buffer = this.getBuffer(image, x, y, scale);

        // this.translate(buffer, 0, 0);
        // this.rotate(buffer, rotation * (Math.PI / 180));
        // this.scale(buffer, scale, scale);

        this.gl.bufferData(this.gl.ARRAY_BUFFER, buffer, this.gl.DYNAMIC_DRAW);
        this.gl.bindTexture(this.gl.TEXTURE_2D, image.texture);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        const error = this.gl.getError();

        if (error !== this.gl.NO_ERROR) {
            console.error("WebGL error:", error);
        }
    }
}

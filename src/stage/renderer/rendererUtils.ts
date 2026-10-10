import { Texture, CachedTexture } from "../messageTypes";
import { STAGE_WIDTH, STAGE_HEIGHT } from "../common/constants";
import { shader as fragCode } from "./shaders/fragmentShader.glsl";
import { shader as vertCode } from "./shaders/vertexShader.glsl";


// One cache per WebGL context.
// WebGLTexture objects cannot be shared between unrelated contexts.
const svgCaches = new WeakMap<
    WebGL2RenderingContext,
    Map<string, Promise<CachedTexture>>
>();


export async function rasteriseSVG(uri: string, scale: number) {
    const image = new Image();

    image.src = uri;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth * scale;
    canvas.height = image.naturalHeight * scale;

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


export async function createSVGImageTexture(gl: WebGL2RenderingContext, uri: string, scale: number=1): Promise<Texture> {
    const canvas = await rasteriseSVG(uri, scale);
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


export function getTexture(
    gl: WebGL2RenderingContext,
    uri: string,
    fileExtension: string,
    maxSVGScale: number = 5
): Promise<CachedTexture> {
    if (fileExtension.toLowerCase() !== ".svg") {
        return createImageTexture(gl, uri);
    }

    let cache = svgCaches.get(gl);

    if (!cache) {
        cache = new Map();
        svgCaches.set(gl, cache);
    }

    const maximum = Math.max(1, Math.floor(maxSVGScale));
    const key = JSON.stringify([uri, maximum]);

    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const promise = createSVGImageTexture(
        gl,
        uri,
        maximum
    );

    cache.set(key, promise);

    // Failed loads should be retryable.
    promise.catch(() => {
        if (cache.get(key) === promise) {
            cache.delete(key);
        }
    });

    return promise;
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

        const VERTICES = new Float32Array([
            // X,    Y,    U, V
            -0.5, -0.5,   0, 1,
            0.5, -0.5,   1, 1,
            -0.5,  0.5,   0, 0,

            -0.5,  0.5,   0, 0,
            0.5, -0.5,   1, 1,
            0.5,  0.5,   1, 0
        ]);

        gl.useProgram(program);

        this.gl = gl;

        const vertexBuffer = gl.createBuffer();
        const posBufferLocation = gl.getAttribLocation(program, "a_position");
        const texCoordsLocation = gl.getAttribLocation(program, "a_texcoord");

        const imageBufferLocation = gl.getUniformLocation(program, "u_texture");
        this.matrixUniformLocation = gl.getUniformLocation(program, "u_matrix");


        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            VERTICES,
            gl.STATIC_DRAW
        );

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

    private selectTexture(
        image: CachedTexture,
        scale: number
    ): [WebGLTexture, number] {
        const levels = image.svgLevels;

        // PNGs and other raster images only have one texture.
        if (!levels || levels.length === 0) {
            return [image.texture, 1];
        }

        // Choose the smallest cached resolution
        // that is at least as large as the display scale.
        const level = Math.min(
            Math.max(1, Math.ceil(Math.abs(scale))),
            levels.length
        );

        return [levels[level - 1], level];
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


    private getMatrix(image: Texture, x: number, y: number, scale: number, direction: number) {
        // Projection from Scratch coordinates to clip space.
        // Scratch already has its origin at the centre,
        // and positive Y points upwards.
        const matrix = new Float32Array([
            2 / STAGE_WIDTH, 0, 0, 0,
            0, 2 / STAGE_HEIGHT, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);

        this.translate(matrix, x, y);

        const radians = direction * Math.PI / 180;
        this.rotate(matrix, radians);

        this.scale(
            matrix,
            image.width * scale,
            image.height * scale
        );

        return matrix;
    }

    public drawImage(
        image: CachedTexture,
        x: number,
        y: number,
        scale: number,
        direction: number
    ) {
        const [texture, levelSelected] = this.selectTexture(image, scale);

        const matrix = this.getMatrix(
            image,
            x,
            y,
            scale,
            direction
        );

        this.gl.uniformMatrix4fv(
            this.matrixUniformLocation,
            false,
            matrix
        );

        this.gl.bindTexture(
            this.gl.TEXTURE_2D,
            texture
        );

        this.gl.drawArrays(
            this.gl.TRIANGLES,
            0,
            6
        );
    }
}

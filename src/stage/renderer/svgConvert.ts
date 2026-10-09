import { text } from "stream/consumers";

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


export async function createImageTexture(gl: WebGLRenderingContext, uri: string) {
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

    return texture;
}

export async function createSVGImageTexture(gl: WebGLRenderingContext, uri: string) {
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

    return texture;
}


export async function getTexture(gl: WebGL2RenderingContext, uri: string, fileExtension: string) {
    switch (fileExtension) {
        case ".svg":
            return createImageTexture(gl, uri);
        default:
            return createImageTexture(gl, uri);
    }
}
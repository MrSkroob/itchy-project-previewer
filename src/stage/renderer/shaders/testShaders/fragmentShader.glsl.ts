export const shader = /*glsl*/`#version 300 es

precision mediump float;
uniform sampler2D u_image;
in varying vec2 v_uv;
out vec4 outputColor;

void main() {
  outputColor = texture2D(u_image, v_uv);
}`
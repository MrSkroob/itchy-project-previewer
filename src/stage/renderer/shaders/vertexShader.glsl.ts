export const shader = /*glsl*/`#version 300 es

in vec4 a_position;
in vec2 a_texcoord;
uniform bool u_mirror;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
    vec2 texcoord = a_texcoord;

    if (u_mirror) {
        texcoord.x = 1.0 - texcoord.x;
    }
    gl_Position = u_matrix * a_position;
    v_texcoord = texcoord;
}
`;
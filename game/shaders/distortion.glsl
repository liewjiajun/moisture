// Liquid Distortion Shader for Moisture
extern float time;
extern float intensity;

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec2 uv = texture_coords;

    // Ripple distortion
    float ripple1 = sin(uv.y * 20.0 + time * 3.0) * 0.003 * intensity;
    float ripple2 = sin(uv.x * 15.0 + time * 2.5) * 0.002 * intensity;
    float ripple3 = cos((uv.x + uv.y) * 10.0 + time * 4.0) * 0.002 * intensity;

    // Water caustics effect
    float caustic = sin(uv.x * 30.0 + time) * sin(uv.y * 30.0 + time * 1.3) * 0.002 * intensity;

    // Apply distortion
    uv.x += ripple1 + ripple3 + caustic;
    uv.y += ripple2 + caustic;

    // Clamp UV to prevent edge artifacts
    uv = clamp(uv, 0.001, 0.999);

    vec4 texColor = Texel(tex, uv);

    // Add subtle color shift based on distortion
    float shift = (ripple1 + ripple2) * 10.0;
    texColor.r += shift * 0.1;
    texColor.g += shift * 0.05;
    texColor.b -= shift * 0.05;

    // Vignette effect that intensifies with difficulty
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(texture_coords, center);
    float vignette = 1.0 - (dist * 0.5 * intensity);
    texColor.rgb *= vignette;

    return texColor * color;
}

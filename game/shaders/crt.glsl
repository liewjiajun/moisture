// CRT Shader with scanlines, curvature, and chromatic aberration
extern float time;
extern vec2 inputSize;

// CRT curvature amount
const float curvature = 0.03;

// Scanline intensity
const float scanlineIntensity = 0.15;

// Chromatic aberration amount
const float chromatic = 0.002;

// Vignette strength
const float vignetteStrength = 0.3;

vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
    uv = uv + uv * offset * offset * curvature;
    uv = uv * 0.5 + 0.5;
    return uv;
}

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    // Apply CRT curvature
    vec2 uv = curve(texture_coords);

    // Check if outside screen bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }

    // Chromatic aberration
    float r = Texel(tex, vec2(uv.x + chromatic, uv.y)).r;
    float g = Texel(tex, uv).g;
    float b = Texel(tex, vec2(uv.x - chromatic, uv.y)).b;
    vec3 col = vec3(r, g, b);

    // Scanlines
    float scanline = sin(uv.y * inputSize.y * 3.14159) * 0.5 + 0.5;
    scanline = pow(scanline, 1.5) * scanlineIntensity;
    col = col * (1.0 - scanline);

    // Horizontal line flicker (subtle)
    float flicker = sin(time * 10.0 + uv.y * 100.0) * 0.01 + 1.0;
    col *= flicker;

    // Vignette
    vec2 vignetteUV = uv * (1.0 - uv.yx);
    float vignette = vignetteUV.x * vignetteUV.y * 15.0;
    vignette = pow(vignette, vignetteStrength);
    col *= vignette;

    // Slight green tint like old monitors
    col.g *= 1.05;

    // Brightness boost to compensate for darkening effects
    col *= 1.2;

    return vec4(col, 1.0) * color;
}

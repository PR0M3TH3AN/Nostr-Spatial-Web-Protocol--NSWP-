// What fills a doorway: a field of light, deeper towards the middle, with
// cells that kindle and fade and a slow band that rises through it. The same
// as the veil in packages/sdk/src/home.ts, written for Godot. Change one,
// change the other.
//
// For a flat mesh the size of the opening, standing on the floor.
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform vec3 accent : source_color = vec3(0.298, 0.788, 0.941);
uniform float aim : hint_range(0.0, 1.0) = 0.0;
// The opening, in metres, and where its straight sides end and its round top begins.
uniform vec2 size = vec2(1.5, 2.1);
uniform float spring = 1.35;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Distance to the nearest edge of a honeycomb, and which cell this is.
vec3 comb(vec2 p) {
	vec2 r = vec2(1.0, 1.7320508);
	vec2 a = mod(p, r) - r * 0.5;
	vec2 b = mod(p - r * 0.5, r) - r * 0.5;
	vec2 g = dot(a, a) < dot(b, b) ? a : b;
	float edge = 0.5 - max(abs(g.x), dot(abs(g), normalize(r)));
	return vec3(edge, p - g);
}

void fragment() {
	// Godot's flat meshes count the second coordinate from the top.
	vec2 p = vec2((UV.x - 0.5) * size.x, (1.0 - UV.y) * size.y);
	float half_w = size.x * 0.5;
	float d = p.y < spring ? half_w - abs(p.x) : half_w - length(p - vec2(0.0, spring));
	if (d < 0.0) {
		discard;
	}
	vec2 mid = vec2(0.0, size.y * 0.52);
	float deep = 1.0 - smoothstep(0.0, 1.15, length((p - mid) * vec2(1.0, 0.72)));
	vec3 c = mix(vec3(0.004, 0.007, 0.012), accent * 0.2, deep);
	// The honeycomb: faint lines, and a cell here and there lit for a while.
	vec3 h = comb(p * 9.0 + vec2(0.0, TIME * 0.12));
	float cell = hash(h.yz);
	float lit = smoothstep(0.86, 1.0, sin(TIME * (0.35 + cell * 0.6) + cell * 40.0) * 0.5 + 0.5) * step(0.7, cell);
	c += accent * (smoothstep(0.045, 0.0, h.x) * (0.1 + 0.2 * deep) + lit * 0.32 * smoothstep(0.0, 0.2, h.x));
	// A band of light rising, and the glow at the heart of it.
	float band = smoothstep(0.16, 0.0, abs(fract(p.y * 0.36 - TIME * 0.07) - 0.5) - 0.02);
	c += accent * band * 0.12;
	c += (accent * 0.85 + 0.25) * pow(deep, 3.0) * (0.36 + 0.4 * aim);
	// Darker towards the frame, so it reads as set back into it.
	c *= 0.45 + 0.55 * smoothstep(0.0, 0.22, d);
	c *= 1.0 + aim * 0.5;
	ALBEDO = c;
}

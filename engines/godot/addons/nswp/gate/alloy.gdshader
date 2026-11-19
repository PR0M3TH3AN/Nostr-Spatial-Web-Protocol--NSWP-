// Alloy: the one surface everything the kit models is drawn in. The same
// surface as packages/sdk/src/alloy.ts, written for Godot. Change one, change
// the other.
//
// Dark metal that is never lit by a light. Its shape shows from three things
// worked out per pixel: a fixed light from above and in front, the horizon's
// glow reflected in it, and a rim of that glow where it turns away from the
// eye. Corners marked as lights are drawn bright, with a pulse that travels
// along them.
//
// A mesh for it carries, at each corner: its tone in COLOR (as sRGB, since an
// importer may keep a colour in eight bits), how much of a light it is in
// UV.x, and how far along its seam it is in UV.y.
shader_type spatial;
render_mode unshaded;

uniform vec3 accent : source_color = vec3(0.298, 0.788, 0.941);
uniform vec3 ground : source_color = vec3(0.016, 0.027, 0.043);
// 0 to 1: how strongly it is being pointed at. Its lights answer.
uniform float aim : hint_range(0.0, 1.0) = 0.0;
uniform float gloss : hint_range(0.0, 1.0) = 0.75;
uniform float speed = 1.0;
uniform float sheen : hint_range(0.0, 1.0) = 0.0;
uniform float reach = 3.0;
// Set when the mesh came through an importer that turns the second texture coordinate over (Godot's OBJ importer does).
uniform bool flow_flipped = true;

varying vec3 world_at;
varying vec3 world_normal;

vec3 sky_glow(vec3 d, vec3 a, vec3 g) {
	float h = clamp(d.y, -1.0, 1.0);
	float band = pow(1.0 - abs(h), 9.0);
	float line = pow(1.0 - abs(h), 60.0);
	vec3 up = mix(g * 0.55, g * 0.2, smoothstep(0.0, 0.7, h));
	vec3 base = h > 0.0 ? up : g;
	return base + a * (band * 0.4 + line * 0.9);
}

vec3 to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void vertex() {
	world_at = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
	vec3 tone = to_linear(COLOR.rgb);
	float glow = UV.x;
	float flow = flow_flipped ? 1.0 - UV.y : UV.y;
	vec3 n = normalize(world_normal);
	vec3 v = normalize(CAMERA_POSITION_WORLD - world_at);
	float facing = max(dot(n, v), 0.0);
	// Form: a light from above and in front, and more from the sky than from the floor.
	float key = max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0);
	float dome = 0.5 + 0.5 * n.y;
	vec3 c = tone * (0.3 + 0.6 * dome + 0.75 * key);
	// The place reflected in it, strongest at a glancing angle, as on real metal.
	float fresnel = pow(1.0 - facing, 4.0);
	vec3 mirror = sky_glow(reflect(-v, n), accent, ground);
	c += mirror * (0.1 + 0.75 * fresnel) * gloss;
	// A rim of the place's light where the surface turns away.
	c += accent * pow(1.0 - facing, 3.0) * 0.16;
	// Colours that shift with the angle, for things meant to be looked at.
	if (sheen > 0.0) {
		vec3 shift = 0.5 + 0.5 * cos(6.2831 * (facing * 1.2 + vec3(0.0, 0.33, 0.67)) + world_at.y * 1.5);
		c = mix(c, c + shift * accent * 0.8 + shift * 0.1, sheen * (0.3 + 0.7 * fresnel));
	}
	// Lights: the place's colour, with a brighter pulse travelling along them.
	if (glow > 0.001) {
		float run = fract(flow / reach - TIME * 0.22 * speed);
		float pulse = smoothstep(0.8, 1.0, run) + smoothstep(0.1, 0.0, run) * 0.6;
		vec3 light = mix(accent, vec3(1.0), 0.06 + 0.5 * pulse + 0.3 * aim);
		c = mix(c, light * (0.8 + 0.6 * pulse + 0.5 * aim), glow);
	}
	// Distance takes it into the ground's colour.
	float far = length(CAMERA_POSITION_WORLD - world_at);
	c = mix(c, ground, smoothstep(55.0, 290.0, far) * (1.0 - glow * 0.5));
	ALBEDO = c;
}

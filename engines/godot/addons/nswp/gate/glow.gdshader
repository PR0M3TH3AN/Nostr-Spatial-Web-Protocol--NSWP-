// The light a doorway gives off: a soft glow round its arch, and a pool on
// the floor in front and behind. Drawn, since nothing here is lit by lights.
// The same as gateGlow in packages/sdk/src/home.ts, written for Godot. Change
// one, change the other.
//
// For flat meshes in the doorway's own space: sheets standing either side of
// it, and one lying on the floor (on_floor), whose corners are laid down here.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled;

uniform vec3 accent : source_color = vec3(0.298, 0.788, 0.941);
uniform float aim : hint_range(0.0, 1.0) = 0.0;
uniform float spring = 1.35;
// The arch's own radius: half the opening and half the frame.
uniform float radius = 0.84;
uniform bool on_floor = false;

varying vec2 at;

void vertex() {
	at = VERTEX.xy;
	if (on_floor) {
		VERTEX = vec3(VERTEX.x, 0.014, VERTEX.y);
	}
}

void fragment() {
	float a;
	if (on_floor) {
		// On the floor: brightest under the opening, gone a couple of metres out.
		vec2 q = at / vec2(1.7, 2.4);
		a = pow(max(1.0 - dot(q, q), 0.0), 2.0) * 0.2;
	} else {
		float d = at.y < spring ? abs(abs(at.x) - radius) : abs(length(at - vec2(0.0, spring)) - radius);
		a = (exp(-d * 5.0) * 0.16 + exp(-d * 18.0) * 0.2) * smoothstep(-0.02, 0.5, at.y);
	}
	ALBEDO = accent;
	ALPHA = a * (0.8 + 0.6 * aim);
}

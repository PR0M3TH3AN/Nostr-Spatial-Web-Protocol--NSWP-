/**
 * The standard doorway's opening, in metres. In a file of its own so that
 * anything can read it without bringing a renderer along: the Three.js kit
 * models the doorway from these, and so does every other engine's.
 */
export const PORTAL_WIDTH = 1.5;
export const PORTAL_HEIGHT = 2.1;
/** Where the doorway's straight sides end and its round top begins. */
export const PORTAL_SPRING = PORTAL_HEIGHT - PORTAL_WIDTH / 2;
/** How far above the floor the middle of a doorway's sign hangs. */
export const PORTAL_SIGN_HEIGHT = PORTAL_HEIGHT + 0.72;
/**
 * How near a visitor must be to choose a door from where they stand, in metres: ten feet. Further off, a door is
 * not lit when pointed at and a press on it does not go through, so nobody crosses a world by a stray click on a
 * door at the far end of it. Walking into a doorway always goes through.
 */
export const DOOR_REACH = 3.05;
/**
 * The least distance between the middles of two doors, in metres: a door's own width and a clear metre of wall.
 * Nearer than this, two doors' frames, signs and marks run into each other, and someone pointing from across a
 * room can't tell which one they have. Every way of laying doors out goes by it (`door-layout.ts`), in every
 * engine. (The owner, 2026-11-21: "Let's make sure there is a minimum distance separation between each door.")
 */
export const DOOR_SPACING = 2.5;

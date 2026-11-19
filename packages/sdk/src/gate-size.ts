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

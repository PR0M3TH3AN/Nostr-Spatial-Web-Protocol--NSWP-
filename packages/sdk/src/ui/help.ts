/**
 * The Help tab's own words: how to look round, move, and bring the controls up. The same wherever the menu is drawn,
 * but for whose controls they are.
 *
 * - A world that draws its own menu puts its own sentence about itself first, and then these.
 * - A client that draws the menu above a world has these as its own help. What the world says of itself is a note
 *   after them, under the world's name (protocol/02-doors.md, "The client has the menu").
 */
export function helpWords(whose: "world" | "client"): string {
  const how =
    "Drag to look around. Walk with W, A, S, D or the up and down arrows; the left and right arrows turn you. Or point at the floor and select to step there: twice to run. Shift runs and Space jumps. The key left of 1 brings these controls up in any world, whatever is on screen; on a touch screen, hold two fingers still. Select a doorway to see where it leads before you go.";
  return whose === "world"
    ? `${how} These controls are this world's own: your headset's or browser's own controls always get you out.`
    : `${how} These controls are your own client's, the same in every world: its Home takes you home whatever a world does.`;
}

/**
 * The visitor's menu, as a part of the kit a client can carry by itself (docs/plans/the-clients-menu.md, "The kit
 * in two parts"). `nswp-sdk/menu`.
 *
 *   import { mountMenu, portHere } from "nswp-sdk/menu";
 *   const menu = mountMenu(portHere(controls));   // a world with no client above it: its own controls, direct
 *
 * The menu is given a world's port and nothing else of the world. A world's own build loads this as a file of its
 * own, so that a world whose client draws the menu need never fetch it.
 */
export { mountMenu, type Hud as Menu } from "./ui/hud.js";
export { portHere, type WorldPort } from "./ui/port.js";

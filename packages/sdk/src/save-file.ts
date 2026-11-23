/**
 * A file handed to the visitor: a picture, a clip.
 *
 * In a page of its own a world saves it itself, as a download. Where its client has the menu, the visitor's press
 * was on the client's page, so the file goes up to the client and the client's page saves it (protocol/02-doors.md,
 * "The client has the menu": a row of the kind `save`).
 */
import { handUp } from "./client-frame.js";

/** This page's own save: the device's, as a download. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Hand a file to the visitor: their device's own save. True where it went up to the client to be saved there,
 * under a name of the client's own; false where this page saved it as a download, under `name`.
 */
export function saveFile(blob: Blob, name: string): boolean {
  if (handUp(blob)) return true;
  download(blob, name);
  return false;
}

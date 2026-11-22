# A full-screen button, and Escape that opens the menu first

- **Asked:** 2026-11-21. The owner: "when the player is not in full screen
  mode, there should be a little fullscreen button somewhere. Like at the
  top center or something. And then when i am in fullscreen mode. Escape
  once should not exit full screen. It should pull up the menu. Escape
  again from the menu should exit full screen."
- **Who:** the NSWP builder (the kit: `ui/fullscreen.ts`, `fps.ts`), for
  every world; BitPortal uses it.
- **State:** merged as kit 0.78.0 (NSWP pull requests 286 and 287), vendored into BitPortal and the template. Not live. A scripted-Chrome trial passed, casual and intense; not tried in Firefox, Safari or on a real keyboard.

## What it can honestly be

- A small "Full screen" button at the top centre on a desk when the page
  isn't full screen; never in a headset session.
- A browser lets Escape leave full screen whatever a page wants, except
  where the Keyboard Lock API exists (Chrome, Brave, Edge): there a page in
  full screen can take a short Escape and leaves full screen only on a long
  hold. So in those browsers: Escape opens the menu, Escape again from the
  menu leaves full screen. In Firefox and Safari Escape leaves full screen
  as the browser insists, and the menu comes up then.

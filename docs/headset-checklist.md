# Headset checklist

Nothing here has been run on a real headset. Everything in the spec marked
"tested" was tested on a desktop, or in an emulated Meta Quest 3 driven by a
script. This is the list to run the first time someone has a headset on, and
again on each new kind of headset.

It takes about twenty minutes. Write down the headset, its browser and the
date, then for each line: **yes**, **no**, or what happened instead. A "no" is
the useful answer. Record the result in spec §21.2.

Open each address in the headset's own browser. No account is needed.

## 1. The room: `https://bitportal.vercel.app/walk/`

| # | Do this | It should |
|---|---|---|
| 1.1 | Open the page and press **Enter VR** | Put you in a room, facing a wall of arched doors, with nothing to install |
| 1.2 | Look at the doors without moving | Let you read each door's name and address from where you stand |
| 1.3 | Point at a door | Light its frame and show a panel with its address and a line about it |
| 1.4 | Point at the floor a few metres ahead | Show a ring on the floor where you are pointing |
| 1.5 | Pull the trigger (or pinch) on the floor | Put you there at once, with no sliding |
| 1.6 | Point at a door's **Save** button and select it | Save that door, and say so in front of you. The other doors stay where they were |
| 1.7 | Try 1.6 from the middle of the room | Work without hitting the door by mistake. **How many tries did it take?** |
| 1.8 | Look down and a little ahead for a small arched **Menu** button | Be there, low, out of the way of the doors |
| 1.9 | Select **Menu** | Open the console in front of you: sections down the left, buttons beside them |
| 1.9a | Close it, then raise your left wrist in front of your face | Bring the same console up above your wrist. **Did it also appear when you didn't mean it to, while pointing at doors?** |
| 1.9b | Point at it with your other hand and select a section | Change section. Lower your wrist: it goes away |
| 1.10 | Select **View**, then **Turn around** | Face you the other way in one step: your own wall, with the door you saved |
| 1.11 | Select **Remove** on that door, then **Put it back** | Take it away and bring it back to the same place |
| 1.12 | Sit down and repeat 1.3, 1.6 and 1.10 | All still work without standing or turning your body |
| 1.13 | Select a door | Leave VR and show the Airlock: a flat page with the address |

## 2. Crossing: the Airlock and World A

| # | Do this | It should |
|---|---|---|
| 2.1 | On the Airlock, read the page | Show the real address first, then whether it is verified |
| 2.2 | Press **Continue** | Open World A. **Did you have to press Enter VR again?** (Expected: yes) |
| 2.3 | In VR, open the console (wrist or **Menu**) | Offer **Back to your lobby** under Travel |
| 2.4 | Close the menu, point at the portal and select it | Leave for the Airlock, naming World B |
| 2.5 | Cancel, go back into World A, open the menu, select **Back to your lobby** | Return you to BitPortal's room, facing the door you left through |
| 2.6 | Count the steps from "in the room" to "standing in World A in VR" | **How many, and which felt unnecessary?** |

## 3. A world from the template: `https://nswp-world-template.vercel.app/`

| # | Do this | It should |
|---|---|---|
| 3.1 | Enter VR and point at the floor | Show the ring, and step there when you select |
| 3.2 | Try to step onto the bench | Refuse: the bench is in the way |
| 3.3 | Step close to a doorway and read its sign | Show the world's name and, under it, its address |
| 3.4 | Walk or step through a doorway | Leave for the Airlock |
| 3.5 | Open the console | Offer Join the room under Room, and Turn around and Leave VR under View |
| 3.6 | Open **Look** and choose another colour | Change the console's colour at once, and keep it next time you visit this world |

## 4. The shared room (needs a second person or device)

| # | Do this | It should |
|---|---|---|
| 4.1 | In World A in VR, open the console's Room section and read the line under the buttons | Say that joining shows your IP address to the others, before you join |
| 4.2 | Select **Join the room**, with someone else joined from another device | Show them as an avatar that moves when they do |
| 4.3 | Select **Turn microphone on** | Ask for the microphone. **Did the headset show its permission prompt while in VR, or did you have to leave VR?** |
| 4.4 | Talk | Be heard by the other person, from the direction of your avatar |
| 4.5 | Select **Turn microphone off**, then **Leave the room** | Stop your voice, then remove your avatar for the other person |
| 4.6 | Repeat 4.2 with the two devices on different networks (one on mobile data) | Connect. **If it doesn't, that is the known gap: there is no relay fallback yet** |

## 5. Things to notice throughout

- Anything too small or too far to read.
- Anything that needed more than two tries to select.
- Any moment the view moved without you asking.
- Any moment you didn't know how to get back or get out. The headset's own
  home button must always work; nothing here replaces it.
- Whether text in front of you (the "Saved" note) sat in the way.
- Frame rate: did anything stutter when turning your head?

## What each "no" means

| Lines | Where the fix belongs |
|---|---|
| 1.2, 1.7 | Sizes in BitPortal's room: `bitportal/src/walk/main.ts` |
| 1.4, 1.5, 3.1, 3.2 | Stepping: the template's `src/plumbing/boot.ts`, and BitPortal's room |
| 1.8 to 1.10, 2.3, 3.5, 3.6 | The console: `packages/sdk/src/console.ts`. The wrist gesture's distances are near the end of its `update()` |
| 2.2, 2.6 | The crossing itself, spec §6.5. The largest cost in the whole design, and not yet solved |
| 4.3 | Whether a microphone can be turned on from inside VR at all on that browser |
| 4.6 | Phase 4b: a relay fallback for networks that block direct connections |

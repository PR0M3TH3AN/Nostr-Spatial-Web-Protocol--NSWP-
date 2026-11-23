# Your own music: it keeps playing across worlds, it has proper controls, and it can play from your BitLogin files

- **Asked:** 2026-11-23. The owner: "If the user is playing a custom song,
  could we have it play while moving across worlds? This would make it less
  distracting trying to find where your song left off and play again from
  there on the new world. Also i dont think we even have playback controls
  for our users own music. Thats another thing we should add. Can we also
  play from files in our bitlogin files?"
- **Who:** three pieces. Across worlds: BitPortal's session, with the
  client's menu's step 2. Controls: the NSWP builder (the kit's menu, the
  Sound tab). From BitLogin's files: BitLogin and BitPortal, with the menu's
  step 4. Not briefed.
- **State:** asked.

## What is true today

- A visitor's own music is the kit's jukebox (`sound.ts`): songs added from
  their own device, kept in the browser **for that one world's site**, heard
  only by them. Each world has its own list, and a door stops the music: the
  next world starts silent, and they find the song and the place in it again.
- The jukebox can play, pause and go to the next song, and list, add and
  remove. There is no going back a song, no moving within a song, no time
  shown, and no "now playing" a visitor can see at a glance.
- Songs come only from the device. BitLogin's files can't be played.

## What is wanted

1. **It keeps playing through a door.** The same song, from where it was,
   with no gap a visitor has to mend.
2. **Playback controls:** at the least play and pause, next and previous,
   moving within the song with the time shown, what is playing now, and the
   list. Shuffle and repeat are for the design to propose.
3. **Playing from BitLogin's files:** a song kept in their own files at
   their sign-in address can be chosen and played.

## How each is reached

- **Across worlds** follows from the client's menu: Sound is the client's
  tab, and the client's page plays the visitor's music itself, so it never
  stops at a door and no world is told (tried in the stand-in client,
  NSWP 396). It becomes true in BitPortal with the menu's step 2, and the
  list becomes one list for every world, kept by the client. Step 2's "done"
  gains: a song playing in the room is still playing, unbroken, three worlds
  later. A world opened by its own address keeps today's jukebox.
- **The controls** are the kit's menu's own rows in Sound, the same in the
  client's menu and the kit's fallback. On the bar, a pinned "now playing"
  with play and pause is for the design to propose. In a headset, the same
  rows.
- **From BitLogin's files:** the sign-in address's panel hands a chosen file
  to the client at the visitor's press, as a world's file is handed down.
  It needs a word from BitLogin's panel for "the visitor chose this file",
  carrying the file and nothing else of the account. Only audio kinds, and a
  size limit. The world is never given it.

## For the design to settle

- Which audio kinds and how big; what happens to a song too big to keep.
- Where the client keeps the songs (they are the visitor's files, on this
  device), and whether the list is synced or only the choice of what was
  playing.
- Sharing music with people nearby (a world's room does this today from the
  jukebox's output): how it works when the client plays the music, since the
  world no longer has the sound. Until then, what the row says.
- A phone and a headset: playing on with the screen locked isn't promised.

## Must not

- Tell a world what a visitor is listening to, unless they share it.
- Let a world start, stop or change the visitor's own music.

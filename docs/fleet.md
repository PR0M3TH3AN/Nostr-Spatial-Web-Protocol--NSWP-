# How the sessions work together

Several AI sessions build this with the owner, each in its own project. This
is how they stay one system, written down on 2026-11-21 when the owner said:
"build our little fleet how you think it will work best."

## Who has what

| Session | Its project | It decides |
|---|---|---|
| **NSWP** (the orchestrator) | This repository (the protocol, the kit, the reference worlds), BitPortal the website, the world template | The kit and the protocol; what the others are asked to build to; what is recorded as decided |
| **Bitlogin** | The sign-in address: accounts, the signer, the wallet, the buy and tip screens | Everything in its own code and its own releases |
| **Bitunlock** | The selling service: listings, payments, receipts | Everything in its own code and its own releases |
| **Bitportal VR** | Headsets: staying in VR, world to world | What a headset test shows; proposes changes to the kit by pull request |
| **BitBrowser** | A headset browser of our own (a fork) | Everything in its own code; nothing of payments or identity (`browser/spec.md`, section 2a) |

The owner speaks to any of them. The orchestrator answers the others'
questions of design, keeps the plans current, and says what is live.

## The rules

1. **An agreement is a file, not a message.** What two projects must agree on
   is written as examples both run (`vectors/`), a schema, or a section of a
   plan, before either builds to it. A message says where the file is.
2. **Each repository's main folder stays on `main`, clean, and nobody edits
   in it.** It is what is deployed and what others copy from. Every change is
   made in a worktree beside it and arrives by pull request. (Agreed for this
   repository and BitPortal's; the others' are their own sessions' to run.)
3. **The checks are run here, on this machine.** There is no paid check
   anywhere else (the owner: "We should do the CI tests local. I have no
   github credits and im not paying for that"). `npm run gate` is every check
   this repository has, stops at the first failure, and exits with its code.
   Nothing is merged on a gate that didn't pass. Whoever merges says which
   command they ran and that it exited 0. A test that fails only while the
   machine is busy still failed: it is run again when quiet, and that is
   said.
4. **A report says what was seen and what wasn't.** "Passed here", "the
   other session reports", and "nobody has tried" are three different
   things, and each is written as what it is.
5. **Anything that goes out is the owner's word, given in the session that
   does it.** A push that deploys, a release, a migration of live data, a
   live setting, a publish to public relays, a new thing at a host. One
   session never carries another's approval: it agrees the exact step with
   the session that will do it, and tells the owner the question is waiting
   there, with a recommendation. Questions of design are answered between
   sessions freely.
6. **Merged is not live.** Every report to the owner begins with what the
   public sites are on.
7. **One list of what waits on the owner.** The orchestrator keeps it: each
   open decision, which session to answer it in, and a recommendation. A
   session that asks the owner something tells the orchestrator, so it is on
   the list.
8. **A message says what it wants.** Its first line says whether it needs
   an answer or is for information. One report for one stage of work, not
   several. Before asking again, a session checks whether the answer is
   already waiting for it: messages cross.
9. **What a session runs for the others is said.** The local sites, the
   stand-in relay and the sandbox each belong to one session and stop with
   it. Whoever runs one says so, and says before it changes under someone.
10. **A big piece of work starts in a session of its own,** from a written
    brief that names the files and what done looks like. The orchestrator
    reviews it; it doesn't hold everything in its own head.

## Trying things together

`trials/` holds the scripts that try the projects together on one machine,
and `trials/README.md` says what each needs running. What a trial showed is
recorded in the plan it belongs to.

#!/bin/bash
# What of BitBlocks lives only on this laptop (fleet rule 15). Read only: it fetches
# from GitHub and reads; it never commits, pushes, stashes or switches a branch.
# Exit 0: everything is on GitHub. Exit 1: something isn't; each line says what and where.
# Skipped on purpose: the orchestrator's local copies of pull requests (pr-*, *-merge,
# combo), which are on GitHub in their pull requests.
GH="${BITBLOCKS_GITHUB_DIR:-$HOME/Documents/GitHub}"
REPOS="${BITBLOCKS_REPOS:-Nostr-Spatial-Web-Protocol--NSWP- bitportal bitlogin nswp-agents bitportal-art bitunlock nswp-world-template BitBrowser bitgate}"
found=0
say() { echo "$*"; found=1; }
for R in $REPOS; do
  D="$GH/$R"
  [ -e "$D/.git" ] || { say "$R: no repository at $D"; continue; }
  if [ -z "$(git -C "$D" remote)" ]; then
    say "$R: has no GitHub copy at all ($(git -C "$D" rev-list --all --count) commits)"; continue
  fi
  git -C "$D" fetch -q --prune origin 2>/dev/null || say "$R: could not reach GitHub to compare"
  git -C "$D" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}' | while read -r W; do
    [ -d "$W" ] || continue
    n=$(git -C "$W" status --porcelain 2>/dev/null | grep -v -E "^\?\? (.*/)?node_modules/?$" | wc -l)
    on=$(git -C "$W" branch --show-current 2>/dev/null); [ -n "$on" ] || on="no branch"
    [ "$n" -gt 0 ] && echo "$R: $n uncommitted in $W (on $on)"
  done | grep . && found=1
  for b in $(git -C "$D" for-each-ref --format='%(refname:short)' refs/heads); do
    case "$b" in pr-*|*-merge|*-merge[0-9]|combo) continue;; esac
    c=$(git -C "$D" rev-list --count "$b" --not --remotes=origin 2>/dev/null)
    [ "${c:-0}" -gt 0 ] && say "$R: branch $b has $c commit(s) on no GitHub branch (last $(git -C "$D" log -1 --format=%cd --date=short "$b"))"
  done
  s=$(git -C "$D" stash list | wc -l)
  [ "$s" -gt 0 ] && say "$R: $s stash(es), which are never pushed"
done
[ "$found" = 0 ] && echo "Everything of BitBlocks is on GitHub ($(date '+%F %H:%M'))."
exit $found

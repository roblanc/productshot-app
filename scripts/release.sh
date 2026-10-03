#!/usr/bin/env bash
# Publishes the committed desktop/ folder to the `desktop` branch of the public
# roblanc/productshot-app repo and tags it desktop-v<version>. The tag starts
# .github/workflows/release.yml there, which builds the DMG on a Mac and
# attaches it to a GitHub release. Run from anywhere in the productshot repo:
#
#   bash desktop/scripts/release.sh
#
# Bump "version" in desktop/package.json and commit first. Only what is
# committed ships: the tree is taken from HEAD, not from the working copy.
#
# That repo's default branch is `gh-pages`, which `npm run deploy` force-pushes.
# The workflow lives on `desktop` so that push can never delete it; a tag push
# runs the workflow file of the tagged commit, whatever the default branch is.
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

REMOTE="${DESKTOP_REMOTE:-https://github.com/roblanc/productshot-app.git}"
VERSION="$(git show HEAD:desktop/package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
TAG="desktop-v$VERSION"

if git ls-remote --tags "$REMOTE" "refs/tags/$TAG" | grep -q .; then
  echo "$TAG is already released. Bump the version in desktop/package.json, commit, and run again." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
if ! git clone -q --depth 1 --branch desktop "$REMOTE" "$WORK" 2>/dev/null; then
  git init -q "$WORK"
  git -C "$WORK" checkout -q --orphan desktop
  git -C "$WORK" remote add origin "$REMOTE"
fi

find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git archive HEAD:desktop | tar -x -C "$WORK"

# The scratch clone has no identity of its own; commit as this repository does.
git -C "$WORK" config user.name "$(git config user.name)"
git -C "$WORK" config user.email "$(git config user.email)"
git -C "$WORK" add -A
git -C "$WORK" commit -q -m "Product Shot for Mac $VERSION, from productshot $(git rev-parse --short HEAD)"
git -C "$WORK" tag "$TAG"
# The same as scripts/deploy-site.sh: a stray GITHUB_TOKEN would push as
# whatever that token belongs to rather than as the signed-in account.
env -u GITHUB_TOKEN git -C "$WORK" push -q origin desktop "$TAG"

echo "Pushed $TAG. The build runs at https://github.com/roblanc/productshot-app/actions"
echo "When it is green: https://github.com/roblanc/productshot-app/releases/latest/download/ProductShot.dmg"

# Operation Atlas

**Command the front. Redraw the map.**

A real-time strategy game played on a procedurally generated board. Every seed
builds a different country — Voronoi territories running edge to edge, terrain
bands, and the powers placed as far apart as the road network allows.

```bash
npm install
npm run dev
```

## How it plays

Press on one of your holdings and drag to a target. The readout tells you
exactly how the fight resolves *before* you let go — garrisons, terrain
multiplier, who is left standing. Scroll mid-drag to commit more or fewer
troops. Nothing is turn-based; garrisons grow and rivals move while you think.

Four things decide matches:

**Supply.** A holding only grows while an unbroken chain of your own territory
links it back to your capital. Cut an enemy's chain and everything behind it
stops growing and starts bleeding out. You never have to storm what you can
strangle — and the attack preview tells you how many holdings a capture severs.

**Ground.** Mountain passes nearly double a defender's strength. Woodland bites
attackers as they arrive. Plains and harbours are rich but hard to hold.
Hatched borders carry no road, so nothing crosses there — those are the walls
of the map.

**Time on the road.** Armies march in real time, bleed stragglers as they go,
and can be intercepted head-on. You can see a column coming and reinforce
against it. Ground you have just taken is disordered for eight seconds, so a
blitz cannot chain indefinitely.

**Fog.** Ownership is always visible; garrison strength is only known next to
your own lines. A greyed number is stale intel — what your scouts last saw.

Supplied territory earns **command points**: forts (defence that keeps paying
while you are busy elsewhere), barracks (compounding growth in the rear),
watchtowers (vision two steps out), and levies (troops right now).

Win by destroying every rival, or by holding 70% of the map for twenty
unbroken seconds.

### Controls

| Action | Input |
| --- | --- |
| Give an order | Drag from your territory to a target |
| Dispatches | The ✉ icon in the top bar (badge shows unread) |
| Adjust commitment | Scroll while dragging, or the Commitment slider |
| Inspect | Click any territory |
| Pan / zoom | Drag the map / scroll — zoom out to see the whole board |
| Pause | `Space` |
| Build on the selected holding | `F` fortify · `B` barracks · `T` watchtower · `R` levy |

## Layout

```
src/
  engine/     simulation — no DOM, no rendering, deterministic from a seed
    rng          seeded PRNG
    voronoi      cell generation, adjacency, road pruning
    worldgen     board, terrain bands, chokepoints, starting powers
    terrain      the six terrain types and what they change
    state        game state, selectors, fog of war
    supply       capital connectivity and severance
    combat       one battle formula, shared by AI, player and preview
    armies       dispatch, marching, interception, arrival
    ai           rival commanders
    events       world events
    sim          the tick
    commands     every player order (the only way the UI mutates state)
  render/     canvas drawing
    terrainLayer static map, painted once into an offscreen canvas
    scene        per-frame world and screen passes
    camera       pan, zoom, framing
  ui/         React — menu, HUD, panels
  audio/      WebAudio sound, synthesised at runtime (no asset files)
```

The engine is pure and headless: give it a seed and it produces the same board
and the same match every time. `src/engine/config.js` holds every tunable
number in the game — difficulty, balance, factions, victory conditions.

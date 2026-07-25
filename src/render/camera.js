// ============================================================
// Camera: pan, zoom, and world<->screen conversion.
// Screen coordinates are CSS pixels; the DPR scale is applied separately.
// ============================================================

import { clamp } from "../engine/geometry";

export function createCamera() {
    return {
        x: 0,
        y: 0,
        zoom: 1,
        targetX: 0,
        targetY: 0,
        targetZoom: 1,
        minZoom: 0.25,
        maxZoom: 2.4,
        shake: 0,
        // Screen px/sec. Set on drag release so a fast pan keeps drifting and
        // settles under friction, instead of stopping dead at the fingertip.
        velX: 0,
        velY: 0,
    };
}

/** Cover-fit: the board fills the viewport on both axes, cropping the longer one. */
export function coverZoom(world, viewport) {
    return Math.max(viewport.width / world.width, viewport.height / world.height);
}

/** Contain-fit: the whole board is visible, letterboxed on the shorter axis. */
export function containZoom(world, viewport) {
    return Math.min(viewport.width / world.width, viewport.height / world.height);
}

/**
 * How far out the camera may pull. Deliberately below contain-fit so the
 * player can take in the entire board at once with a margin of dark table
 * around it — that overview is the whole point of a strategy map.
 */
export function minZoomFor(world, viewport) {
    return containZoom(world, viewport) * 0.86;
}

export function fitToWorld(camera, world, viewport) {
    camera.minZoom = minZoomFor(world, viewport);
    camera.maxZoom = Math.max(2.8, containZoom(world, viewport) * 6);
    // Open at cover-fit: the board fills the screen, and pulling back to the
    // full overview is one scroll away.
    camera.zoom = camera.targetZoom = clamp(coverZoom(world, viewport), camera.minZoom, camera.maxZoom);
    camera.x = camera.targetX = world.width / 2;
    camera.y = camera.targetY = world.height / 2;
}

/**
 * Keep the viewport strictly inside the board. On an axis where the map is
 * smaller than the screen the camera is pinned to the centre instead.
 */
function clampToBoard(camera, world, viewport) {
    const halfW = viewport.width / (2 * camera.zoom);
    const halfH = viewport.height / (2 * camera.zoom);

    camera.targetX = world.width >= halfW * 2
        ? clamp(camera.targetX, halfW, world.width - halfW)
        : world.width / 2;
    camera.targetY = world.height >= halfH * 2
        ? clamp(camera.targetY, halfH, world.height - halfH)
        : world.height / 2;
}

export function worldToScreen(camera, p, viewport) {
    return {
        x: (p.x - camera.x) * camera.zoom + viewport.width / 2,
        y: (p.y - camera.y) * camera.zoom + viewport.height / 2,
    };
}

export function screenToWorld(camera, p, viewport) {
    return {
        x: (p.x - viewport.width / 2) / camera.zoom + camera.x,
        y: (p.y - viewport.height / 2) / camera.zoom + camera.y,
    };
}

/**
 * Zoom about a fixed screen point, so the map doesn't slide under the cursor.
 * `wheelDeltaY` is the raw event value: a mouse sends a handful of large
 * ticks, a trackpad sends a stream of small ones. Scaling continuously from
 * that (rather than a fixed per-event step) makes both feel proportional —
 * a big fling zooms further than a light nudge either way.
 */
export function zoomAt(camera, screenPoint, wheelDeltaY, viewport) {
    const factor = clamp(Math.pow(1.0013, -wheelDeltaY), 0.72, 1.35);
    const before = screenToWorld(camera, screenPoint, viewport);
    camera.targetZoom = clamp(camera.targetZoom * factor, camera.minZoom, camera.maxZoom);
    // Solve for the camera centre that keeps `before` under the same pixel.
    const after = {
        x: (screenPoint.x - viewport.width / 2) / camera.targetZoom,
        y: (screenPoint.y - viewport.height / 2) / camera.targetZoom,
    };
    camera.targetX = before.x - after.x;
    camera.targetY = before.y - after.y;
}

export function panBy(camera, dxScreen, dyScreen) {
    camera.targetX -= dxScreen / camera.zoom;
    camera.targetY -= dyScreen / camera.zoom;
}

const FRICTION_PER_SEC = 0.055;   // fraction of velocity remaining after 1s
const MIN_VELOCITY = 12;          // px/sec — below this, just stop

/** Kick off momentum panning after a drag release. Velocity is screen px/sec. */
export function throwCamera(camera, vx, vy) {
    camera.velX = vx;
    camera.velY = vy;
}

/** Apply and decay drag momentum. No-op once it has settled. */
export function applyMomentum(camera, dt) {
    if (Math.abs(camera.velX) < MIN_VELOCITY && Math.abs(camera.velY) < MIN_VELOCITY) {
        camera.velX = 0;
        camera.velY = 0;
        return;
    }
    panBy(camera, camera.velX * dt, camera.velY * dt);
    const decay = Math.pow(FRICTION_PER_SEC, dt);
    camera.velX *= decay;
    camera.velY *= decay;
}

export function focusOn(camera, point, zoomFactor) {
    camera.targetX = point.x;
    camera.targetY = point.y;
    if (zoomFactor) {
        camera.targetZoom = clamp(camera.zoom * zoomFactor, camera.minZoom, camera.maxZoom);
    }
}

/** Ease toward the target each frame, and clamp to the world with slack. */
export function updateCamera(camera, world, viewport, dt) {
    // Recomputed every frame so a resize can't strand the camera outside its
    // own limits.
    camera.minZoom = minZoomFor(world, viewport);
    camera.maxZoom = Math.max(2.8, containZoom(world, viewport) * 6);
    camera.targetZoom = clamp(camera.targetZoom, camera.minZoom, camera.maxZoom);

    const ease = 1 - Math.pow(0.0012, dt);
    camera.zoom += (camera.targetZoom - camera.zoom) * ease;
    camera.x += (camera.targetX - camera.x) * ease;
    camera.y += (camera.targetY - camera.y) * ease;

    clampToBoard(camera, world, viewport);
    // The eased position has to obey the same bounds too, or a fast pan or a
    // zoom-out can slide the board off-screen for a few frames before settling.
    const halfW = viewport.width / (2 * camera.zoom);
    const halfH = viewport.height / (2 * camera.zoom);
    camera.x = world.width >= halfW * 2 ? clamp(camera.x, halfW, world.width - halfW) : world.width / 2;
    camera.y = world.height >= halfH * 2 ? clamp(camera.y, halfH, world.height - halfH) : world.height / 2;

    camera.shake = Math.max(0, camera.shake - dt * 2.6);
}

export function addShake(camera, amount) {
    camera.shake = Math.min(1, camera.shake + amount);
}

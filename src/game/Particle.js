// ============================================================
// PARTICLE SYSTEM
// ============================================================
export class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = (Math.random() - 0.5) * 80;
        this.life = 1; this.decay = 0.6 + Math.random() * 0.8;
        this.r = 2 + Math.random() * 3;
        this.color = color;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= this.decay * dt; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}


const PICK_LIFTING_FRACTION = 0.1;
const PICK_LIFTING_HEIGHT = 0.4;
const PICK_CURVE_HEIGHT = 0.8;

class Piece {
  constructor() {
    this.renderable = null;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.rotation = 0
    this.lastX = 0;
    this.lastY = 0;
    this.lastRotation = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.targetRotation = 0;
    this.lift = false;
  }

  move(x, y, rotation, animate, lift = true) {
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
    if (!animate) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.rotation = this.targetRotation;
    }
    this.lastX = this.x;
    this.lastY = this.y;
    this.lastRotation = this.rotation;
    this.lift = lift;
  }

  update(alpha) {
    const t = alpha * alpha * (3 - 2 * alpha);
    let l, d, h;
    if (this.lift) {
      if (t <= PICK_LIFTING_FRACTION) { // lifting
        l = t / PICK_LIFTING_FRACTION;
        d = 0;
        h = 0;
      } else if (1 - t > PICK_LIFTING_FRACTION) { // curve
        l = 1;
        const k = (t - PICK_LIFTING_FRACTION) / (1 - 2 * PICK_LIFTING_FRACTION);
        const a = k * Math.PI;
        d = 0.5 * (1 - Math.cos(a));
        h = Math.sin(a);
      } else { // descent
        l = (1 - t) / PICK_LIFTING_FRACTION;
        d = 1;
        h = 0;
      }
    } else {
      l = 0;
      d = t;
      h = 0;
    }
    this.z = PICK_LIFTING_HEIGHT * l + PICK_CURVE_HEIGHT * h;
    this.x = this.lastX * (1 - d) + this.targetX * d;
    this.y = this.lastY * (1 - d) + this.targetY * d;
    this.rotation = this.lastRotation * (1 - d) + this.targetRotation * d;
  }
}

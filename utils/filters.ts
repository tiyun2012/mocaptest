export class OneEuroFilter {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  xPrev: number | null;
  dxPrev: number | null;
  tPrev: number | null;

  constructor(minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  filter(t: number, x: number): number {
    if (this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = t;
      return x;
    }

    const dt = t - this.tPrev;
    // Avoid division by zero
    if (dt <= 0) return this.xPrev!;

    const dCutoff = this.dCutoff;
    const dx = (x - this.xPrev!) / dt;
    const edx = this.lowPassFilter(dt, dx, this.dxPrev!, dCutoff);
    
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const result = this.lowPassFilter(dt, x, this.xPrev!, cutoff);

    this.xPrev = result;
    this.dxPrev = edx;
    this.tPrev = t;

    return result;
  }

  lowPassFilter(dt: number, x: number, xPrev: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const alpha = 1.0 / (1.0 + tau / dt);
    return xPrev + alpha * (x - xPrev);
  }
}

export class Vector3Filter {
  xFilter: OneEuroFilter;
  yFilter: OneEuroFilter;
  zFilter: OneEuroFilter;

  constructor(minCutoff = 1.0, beta = 0.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta);
    this.yFilter = new OneEuroFilter(minCutoff, beta);
    this.zFilter = new OneEuroFilter(minCutoff, beta);
  }

  filter(t: number, v: {x: number, y: number, z: number}): {x: number, y: number, z: number} {
    return {
      x: this.xFilter.filter(t, v.x),
      y: this.yFilter.filter(t, v.y),
      z: this.zFilter.filter(t, v.z)
    };
  }
}

const auxVec1 = vec3.create();
const auxVec2 = vec3.create();
const auxVec3 = vec3.create();
const normalY = vec3.fromValues(0, 1, 0);
const normalNegY = vec3.fromValues(0, -1, 0);

function intersectPlane(ray, normal, d) {
	const denom = vec3.dot(normal, ray.direction);
	if (Math.abs(denom) > 1e-6) {
		const nom = vec3.dot(normal, ray.origin) + d;
		const t = -(nom / denom);
		if (t >= 0) {
			return t;
		}
	}
}

function intersectCylinderY(ray, position, radius, height) {
  const cp1 = position;
  const cp2 = vec3.add(auxVec1, vec3.scale(auxVec1, normalY, height), position);
  const cd1 = vec3.dot(normalY, cp1);
  const cd2 = vec3.dot(normalY, cp2);

  let ct1;
  let ct2;
  if ((ct1 = intersectPlane(ray, normalNegY, cd1)) !== undefined) {
    const ci1 = vec3.add(auxVec2, ray.origin, vec3.scale(auxVec2, ray.direction, ct1));
    if (vec3.distance(cp1, ci1) >= radius) {
      ct1 = undefined;
    }
  }
  if ((ct2 = intersectPlane(ray, normalY, -cd2)) !== undefined) {
    const ci2 = vec3.add(auxVec2, ray.origin, vec3.scale(auxVec2, ray.direction, ct2));
    if (vec3.distance(cp2, ci2) >= radius) {
      ct2 = undefined;
    }
  }
  if ((ct1 !== undefined) && (ct2 !== undefined)) {
    return (ct1 < ct2) ? ct1 : ct2;
  } else if (ct1 !== undefined) {
    return ct1;
  } else if (ct2 !== undefined) {
    return ct2;
  }

  const a = vec3.sub(auxVec1, ray.direction, vec3.scale(auxVec1, normalY,
                     vec3.dot(ray.direction, normalY)));
  const A = vec3.dot(a, a);
  if (A < 1e-12) {
    return;
  }
  const dp = vec3.sub(auxVec2, ray.origin, position);
  const b = vec3.sub(auxVec3, dp, vec3.scale(auxVec3, normalY, vec3.dot(dp, normalY)));
  const B = 2 * vec3.dot(a, b);
  const C = vec3.dot(b, b) - radius * radius;

  const d = B * B - 4 * A * C;
  if (d < 0) {
    return;
  }
  const D = Math.sqrt(d);
  const k = 1 / (2 * A);
  const t1 = k * (-B - D);
  const t2 = k * (-B + D);
  if ((t1 < 0) && (t2 < 0)) {
    return;
  }

  if (t1 >= 0) {
    const p1 = vec3.add(auxVec1, vec3.scale(auxVec1, ray.direction, t1), ray.origin);
    const d1 = vec3.dot(normalY, p1);
    if ((cd1 - d1) * (cd2 - d1) < 0) {
      return t1;
    }
  }
  if (t2 >= 0) {
    const p2 = vec3.add(auxVec1, vec3.scale(auxVec1, ray.direction, t2), ray.origin);
    const d2 = vec3.dot(normalY, p2);
    if ((cd1 - d2) * (cd2 - d2) < 0) {
      return t2;
    }
  }
}

function intersectBox(ray, minimum, maximum) {
  if ((ray.origin[0] >= minimum[0]) && (ray.origin[0] <= maximum[0]) &&
      (ray.origin[1] >= minimum[1]) && (ray.origin[1] <= maximum[1]) &&
      (ray.origin[2] >= minimum[2]) && (ray.origin[2] <= maximum[2])) {
    return 0;
  }

  let hitDistance;
  for (let i = 0; i < 3; i++) {
    let distance;
    if ((ray.origin[i] <= minimum[i]) && (ray.direction[i] > 0)) {
      distance = (minimum[i] - ray.origin[i]) / ray.direction[i];
    } else if ((ray.origin[i] >= maximum[i]) && (ray.direction[i] < 0)) {
      distance = (maximum[i] - ray.origin[i]) / ray.direction[i];
    }
    if ((distance === undefined) || (distance < 0)) {
      continue;
    }
    const hitPoint = vec3.add(auxVec1, ray.origin, vec3.scale(auxVec1, ray.direction, distance));
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    if ((hitPoint[j] >= minimum[j]) && (hitPoint[j] <= maximum[j]) &&
        (hitPoint[k] >= minimum[k]) && (hitPoint[k] <= maximum[k]) &&
        ((hitDistance === undefined) || (distance < hitDistance))) {
      hitDistance = distance;
    }
  }
  return hitDistance;
}

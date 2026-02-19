#version 300 es

precision highp float;

const float PI = 3.14159265359;
const float EPSILON = 0.0001;
const float INFINITY = 1000000.0;

out vec4 fragColor;

uniform vec2 resolution; // viewport resolution in pixels
uniform float mouseX;
uniform float mouseY;
uniform float fovScale;

uniform float time; // time elapsed in seconds
uniform samplerCube galaxy;
// uniform sampler2D colorMap;

uniform float frontView;
uniform float topView;
uniform float cameraRoll;

uniform float gravatationalLensing;
uniform float renderBlackHole;
uniform float mouseControl;

uniform float adiskEnabled;
uniform float adiskParticle;
uniform float adiskHeight;
uniform float adiskLit;
uniform float adiskDensityV;
uniform float adiskDensityH;
uniform float adiskNoiseScale;
// uniform float adiskNoiseLOD;
// uniform float adiskNoiseLOD;
uniform float adiskSpeed;

uniform float gamma;
uniform float tonemappingEnabled;
uniform float bloomStrength;

struct Ring {
  vec3 center;
  vec3 normal;
  float innerRadius;
  float outerRadius;
  float rotateSpeed;
};

///----
/// Simplex 3D Noise
/// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y +
                           vec4(0.0, i1.y, i2.y, 1.0)) +
                   i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0 / 7.0; // N=7
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm =
      taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m =
      max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 *
         dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
///----

// float ringDistance(vec3 rayOrigin, vec3 rayDir, Ring ring) {
//   float denominator = dot(rayDir, ring.normal);
//   float constant = -dot(ring.center, ring.normal);
//   if (abs(denominator) < EPSILON) {
//     return -1.0;
//   } else {
//     float t = -(dot(rayOrigin, ring.normal) + constant) / denominator;
//     if (t < 0.0) {
//       return -1.0;
//     }

//     vec3 intersection = rayOrigin + t * rayDir;

//     // Compute distance to ring center
//     float d = length(intersection - ring.center);
//     if (d >= ring.innerRadius && d <= ring.outerRadius) {
//       return t;
//     }
//     return -1.0;
//   }
// }

// vec3 panoramaColor(sampler2D tex, vec3 dir) {
//   vec2 uv = vec2(0.5 - atan(dir.z, dir.x) / PI * 0.5, 0.5 - asin(dir.y) / PI);
//   return texture2D(tex, uv).rgb;
// }

vec3 accel(float h2, vec3 pos) {
  float r2 = dot(pos, pos);
  float r5 = pow(r2, 2.5);
  vec3 acc = -1.5 * h2 * pos / r5 * 1.0;
  return acc;
}

vec4 quadFromAxisAngle(vec3 axis, float angle) {
  vec4 qr;
  float half_angle = (angle * 0.5) * 3.14159 / 180.0;
  qr.x = axis.x * sin(half_angle);
  qr.y = axis.y * sin(half_angle);
  qr.z = axis.z * sin(half_angle);
  qr.w = cos(half_angle);
  return qr;
}

vec4 quadConj(vec4 q) { return vec4(-q.x, -q.y, -q.z, q.w); }

vec4 quat_mult(vec4 q1, vec4 q2) {
  vec4 qr;
  qr.x = (q1.w * q2.x) + (q1.x * q2.w) + (q1.y * q2.z) - (q1.z * q2.y);
  qr.y = (q1.w * q2.y) - (q1.x * q2.z) + (q1.y * q2.w) + (q1.z * q2.x);
  qr.z = (q1.w * q2.z) + (q1.x * q2.y) - (q1.y * q2.x) + (q1.z * q2.w);
  qr.w = (q1.w * q2.w) - (q1.x * q2.x) - (q1.y * q2.y) - (q1.z * q2.z);
  return qr;
}

vec3 rotateVector(vec3 position, vec3 axis, float angle) {
  vec4 qr = quadFromAxisAngle(axis, angle);
  vec4 qr_conj = quadConj(qr);
  vec4 q_pos = vec4(position.x, position.y, position.z, 0);

  vec4 q_tmp = quat_mult(qr, q_pos);
  qr = quat_mult(q_tmp, qr_conj);

  return vec3(qr.x, qr.y, qr.z);
}

#define IN_RANGE(x, a, b) (((x) > (a)) && ((x) < (b)))

void cartesianToSpherical(in vec3 xyz, out float rho, out float phi,
                          out float theta) {
  rho = sqrt((xyz.x * xyz.x) + (xyz.y * xyz.y) + (xyz.z * xyz.z));
  phi = asin(xyz.y / rho);
  theta = atan(xyz.z, xyz.x);
}

// Convert from Cartesian to spherical coord (rho, phi, theta)
// https://en.wikipedia.org/wiki/Spherical_coordinate_system
vec3 toSpherical(vec3 p) {
  float rho = sqrt((p.x * p.x) + (p.y * p.y) + (p.z * p.z));
  float theta = atan(p.z, p.x);
  float phi = asin(p.y / (rho + EPSILON));
  return vec3(rho, theta, phi);
}

vec3 toCrood(vec3 s) {
  float x = s.x * cos(s.z) * cos(s.y);
  float y = s.x * sin(s.z);
  float z = s.x * cos(s.z) * sin(s.y);
  return vec3(x, y, z);
}

// vec3 toSpherical2(vec3 pos) {
//   vec3 radialCoords;
//   radialCoords.x = length(pos) * 1.5 + 0.55;
//   radialCoords.y = atan(-pos.x, -pos.z) * 1.5;
//   radialCoords.z = abs(pos.y);
//   return radialCoords;
// }

// void ringColor(vec3 rayOrigin, vec3 rayDir, Ring ring, inout float minDistance,
//                inout vec3 color) {
//   float distance = ringDistance(rayOrigin, normalize(rayDir), ring);
//   if (distance >= EPSILON && distance < minDistance &&
//       distance <= length(rayDir) + EPSILON) {
//     minDistance = distance;

//     vec3 intersection = rayOrigin + normalize(rayDir) * minDistance;
//     vec3 ringColor;

//     {
//       float dist = length(intersection);

//       float v = clamp((dist - ring.innerRadius) /
//                           (ring.outerRadius - ring.innerRadius),
//                       0.0, 1.0);

//       vec3 base = cross(ring.normal, vec3(0.0, 0.0, 1.0));
//       float angle = acos(dot(normalize(base), normalize(intersection)));
//       if (dot(cross(base, intersection), ring.normal) < 0.0)
//         angle = -angle;

//       float u = 0.5 - 0.5 * angle / PI;
//       // HACK
//       u += time * ring.rotateSpeed;

//       vec3 color = vec3(0.0, 0.5, 0.0);
//       // HACK
//       float alpha = 0.5;
//       ringColor = vec3(color);
//     }

//     color += ringColor;
//   }
// }

vec3 getBlackBodyColor(float t) {
    t = clamp(t, 1000.0, 40000.0) / 100.0;
    vec3 c;
    
    // Red
    if (t <= 66.0) {
        c.r = 255.0;
    } else {
        c.r = 329.698727446 * pow(t - 60.0, -0.1332047592);
    }
    
    // Green
    if (t <= 66.0) {
        c.g = 99.4708025861 * log(t) - 161.1195681661;
    } else {
        c.g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
    }
    
    // Blue
    if (t >= 66.0) {
        c.b = 255.0;
    } else if (t <= 19.0) {
        c.b = 0.0;
    } else {
        c.b = 138.5177312231 * log(t - 10.0) - 305.0447927307;
    }
    
    return clamp(c / 255.0, 0.0, 1.0);
}

mat3 lookAt(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));
  
  // vec3 vv = normalize(cross(ww, uu));

  return mat3(-uu, vv, ww);
}

float sqrLength(vec3 a) { return dot(a, a); }

void adiskColor(vec3 pos, vec3 dir, inout vec3 color, inout float alpha, vec2 uv, vec3 oripos) {
  float innerRadius = 2.6;
  float outerRadiusX = 12.0;
  float outerRadiusZ = 6.0;
  float r = length(pos);

  // Density linearly decreases as the distance to the blackhole center
  // increases.
  float density = max(
      0.0, 1.0 - length(pos.xyz / vec3(outerRadiusX, adiskHeight, outerRadiusX)));
  if (density < 0.001) {
    return;
  }

  density *= pow(1.0 - abs(pos.y) / adiskHeight, adiskDensityV);

  // Set particale density to 0 when radius is below the inner most stable
  // circular orbit.
  density *= smoothstep(innerRadius, innerRadius * 1.1, length(pos));

  // Avoid the shader computation when density is very small.
  if (density < 0.001) {
    return;
  }

  vec3 sphericalCoord = toSpherical(pos);

  // Scale the rho and phi so that the particales appear to be at the correct
  // scale visually.
  sphericalCoord.y *= 2.0;
  // sphericalCoord.z *= 4.0;

  density *= 1.0 / pow(sphericalCoord.x, adiskDensityH);
  density *= 16000.0;

  // ================= 艺术化改造 1：宏观螺旋臂 (打破对称性) =================
  float arms = 2.0;         // 设定旋臂数量（图二看起来像是有两条巨大的主旋臂）
  float twist = 3.5;        // 旋臂的扭曲/卷曲程度
  float spiralSpeed = 1.5;  // 旋臂往里吸的旋转速度
  
  // 利用正弦波结合角度(theta)和距离(r)，构造一个向内卷曲的螺旋遮罩
  float spiralPattern = sin(sphericalCoord.y * arms - sphericalCoord.x * twist + time * spiralSpeed);
  // 平滑映射，并保留 20% 的底灰，让旋臂之间不至于完全漆黑
  float rawSpiralMask = mix(0.2, 1.0, smoothstep(-0.5, 0.8, spiralPattern));
  float spiralStrength = smoothstep(innerRadius, innerRadius + 2.5, r);
  float spiralMask = mix(1.0, rawSpiralMask, spiralStrength);
  
  // 将螺旋遮罩乘到密度上，此时吸积盘在三维空间中已经变成了“风车/漩涡”状
  density *= spiralMask;

  if (adiskParticle < 0.5) {
    color += vec3(0.0, 1.0, 0.0) * density * 0.02;
    return;
  }

  // 真实感的吸积盘速度
  float globalAngularVelocity = 5.0 * adiskSpeed;
  float spatialTwist = 25.0 * pow(innerRadius / r, 1.5);

  // float theta = atan(pos.z, pos.x);
  // // 1. 离心率 (Eccentricity)：
  // // 黑洞最内侧(ISCO)必须保持完美的圆形(0.0)，否则违反广义相对论；
  // // 越往外圈，轨道的椭圆离心率逐渐增加（比如最大增加到 0.4）。
  // float eccentricity = 0.3 * smoothstep(innerRadius, outerRadiusX, r);
  // // 2. 核心数学公式：
  // // cos(2.0 * angle) 会在 360 度内产生两个波峰和波谷，代表椭圆的长轴和短轴。
  // // (theta - spatialTwist) 是最绝妙的一笔：它让椭圆的长轴随着半径 r 的变化而发生旋转扭曲！
  // float ellipseMod = 1.0 - eccentricity * cos(2.0 * (theta - spatialTwist * 0.02));
  
  // // 3. 计算等效的“椭圆半径”
  // float r_eff = r * ellipseMod;

  // // 制造拉丝感噪声
  // // sphericalCoord.y *= 0.1;
  // sphericalCoord.x = 2.0 * r_eff;

  // 2. 微观流体：真实的开普勒差速 (内圈狂飙，外圈缓慢)
  float diffOmega = adiskSpeed * 10.0 * pow(innerRadius / r, 1.5);
  
  // ★ 3. 你的核心逻辑：循环与权重分配 ★
  float cycle = 4.0;           // 周期 12s
  float halfCycle = cycle * 0.5; // 半周期 6s
  
  // 计算两个模式的当前循环时间：范围永远在 [0.0, 12.0) 之间
  float t1 = mod(time, cycle); 
  float t2 = mod(time + halfCycle, cycle); // 相位相差 6s
  
  // 计算混合权重 (三角波映射)
  // 当 t1 = 6.0 时，abs(0) = 0，w1 = 1.0 (最清晰)
  // 当 t1 = 0.0 或 12.0 时，abs(6) = 6，w1 = 0.0 (完全透明，此时悄悄重置跳变)
  float w1 = 1.0 - abs(t1 - halfCycle) / halfCycle;
  float w2 = 1.0 - abs(t2 - halfCycle) / halfCycle; 
  // (注：在数学上 w1 + w2 永远等于 1.0，完美守恒)

  // 赋予两个模式各自的差速旋转角度
  float theta1 = sphericalCoord.y + t1 * diffOmega;
  float theta2 = sphericalCoord.y + t2 * diffOmega;

  float noise1 = 1.0;
  float noise2 = 1.0;

  float noise = 1.0;
  for (int i = 0; i < 3; i++) {
    // float t1 = mod(sphericalCoord.y, 2.0 * PI);
    // // float t2 = 2.0 * PI - t1;
    // float t2 = mod(sphericalCoord.y + PI, 2.0 * PI);
    // float weight = 0.5 - 0.5 * cos(t1);
    // vec3 crood1 = vec3(sphericalCoord.x, cos(t1) * 0.1, sphericalCoord.z);
    // vec3 crood2 = vec3(sphericalCoord.x, cos(t2) * 0.1, sphericalCoord.z);
    // float n1 = snoise(crood1 * pow(float(i + 1), 2.0) * adiskNoiseScale);
    // float n2 = snoise(crood2 * pow(float(i + 1), 2.0) * adiskNoiseScale);
    // noise *= 0.5 * mix(n1, n2, weight) + 0.5;
    // noise *= 0.5 * (n1 + n2) + 0.5;
    vec3 crood1 = vec3(sphericalCoord.x, theta1, sphericalCoord.z);
    vec3 crood2 = vec3(sphericalCoord.x, theta2, sphericalCoord.z);
    noise1 *= 0.5 * snoise(toCrood(crood1) * adiskNoiseScale * pow(float(i + 1), 2.0)) + 0.5;
    noise2 *= 0.5 * snoise(toCrood(crood2) * adiskNoiseScale * pow(float(i + 1), 2.0)) + 0.5;
    // noise *= 0.5 * snoise(toCrood(sphericalCoord * pow(float(i), 2.0)) * adiskNoiseScale) + 0.5;
    noise = noise1 * w1 + noise2 * w2;
    // if (i % 2 == 0) {
    // if (int(mod(float(i), 2.0)) == 0) {
    //   sphericalCoord.y += time * globalAngularVelocity + spatialTwist;
    // } else {
    //   sphericalCoord.y -= time * globalAngularVelocity - spatialTwist;
    // }
    // sphericalCoord.y += time * angularVelocity;
  }
  // vec3 dustColor =
  //     // texture(colorMap, vec2(sphericalCoord.x / outerRadius, 0.5)).rgb;
  //     vec3(sphericalCoord.x / outerRadius, 0.1, sphericalCoord.x / outerRadius);
  // float r = uv.x * cos(cameraRoll * 3.14159 / 180.0)
  //     - uv.y * sin(cameraRoll * 3.14159 / 180.0);
  // r = r * fovScale;
  // if (r < 0.0) 
  // {
  //   dustColor = vec3(0.2, 0.2, sphericalCoord.x / outerRadius * -r + 0.2);
  // }
  // else 
  // {
  //   dustColor = vec3(sphericalCoord.x / outerRadius * r + 0.2, 0.2, 0.2);
  // }

  // // ======================带有物理真实的多普勒效应========================
  // // 1. 计算吸积盘在此处物质的轨道速度 (开普勒速度)
  // // 假设黑洞在中心，吸积盘绕 Y 轴旋转。切线方向是 Y轴与位置向量的叉乘
  // vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), pos)); 
  // float r = length(pos);
  
  // // v = c * sqrt(Rs / 2r)。 你的 shader 中视界设定为 r=1.0 (dot(pos,pos)<1.0)。
  // // 乘以 0.7 是一个艺术化调整系数，防止速度过于逼近光速导致 gamma 趋于无穷大产生 NaN 噪点
  // float v_mag = 0.7 * sqrt(1.0 / (2.0 * r)); 
  // vec3 v = tangent * v_mag; // 相对论速度向量 (光速 c=1)
  
  // // 2. 计算洛伦兹因子与多普勒因子
  // float v2 = dot(v, v);
  // float gamma = 1.0 / sqrt(max(1.0 - v2, 0.0001)); // 洛伦兹因子
  
  // // 观察者视线方向：光线追踪中 dir 是从相机射向场景的，所以光子射向相机的方向是 -normalize(dir)
  // vec3 photonDirToEye = -normalize(dir);
  
  // // 核心公式：D = 1 / (gamma * (1 - v · n))
  // float doppler = 1.0 / (gamma * (1.0 - dot(v, photonDirToEye))); 
  
  // // 3. 相对论性聚束效应 (Relativistic Beaming)
  // // 亮度会根据多普勒因子的 3 次方 (几何光学) 发生极其强烈的变化
  // float beaming = pow(doppler, 2.5); 

  // // 4. 多普勒频移引发的颜色变化 (黑体温度偏移)
  // // 基础温度：越靠近黑洞越热 (标准吸积盘模型 T ~ r^-0.75)
  // // 你可以调整 8000.0 这个基础色温来改变吸积盘的整体色调 (比如改成 6000.0 会偏黄，12000.0 会偏蓝)
  // float baseTemp = 3000.0 * pow(innerRadius / r, 0.75); 
  
  // // 观测温度 = 发射温度 * 多普勒因子
  // float obsTemp = baseTemp * doppler; 
  // vec3 dustColor = getBlackBodyColor(obsTemp);

  // color += density * adiskLit * dustColor * alpha * abs(noise);

  // ======================带有艺术化的物理真实多普勒效应=======================

  // vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), pos)); 
  // float r = length(pos);
  // float v_mag = 0.7 * sqrt(1.0 / (2.0 * r)); 
  // vec3 v = tangent * v_mag; 
  
  // float v2 = dot(v, v);
  // float gamma = 1.0 / sqrt(max(1.0 - v2, 0.0001)); 
  // vec3 photonDirToEye = -normalize(dir);
  // float doppler = 1.0 / (gamma * (1.0 - dot(v, photonDirToEye))); 
  
  // // 1. 夸大温度频移：使用 doppler 的 2 次方甚至 3 次方，强制拉开色差
  // float colorDoppler = pow(doppler, 3.0); 
  
  // // 提高基础色温到 4500.0，这样稍微蓝移一点就会突破 10000K 变成蓝色
  // float baseTemp = 4500.0 * pow(innerRadius / r, 0.75); 
  // float obsTemp = baseTemp * colorDoppler; 
  // vec3 dustColor = getBlackBodyColor(obsTemp);
  
  // // 2. 压制高光亮度：为了不让耀眼的亮度触发 ACES 的“洗白”机制，
  // // 我们将聚束效应的上限卡死，不让它超过 2.0 倍
  // float beaming = pow(clamp(doppler, 0.3, 1.6), 2.0);

  // color += density * adiskLit * dustColor * beaming * alpha * abs(noise);

  // ================= 物理基础 + 动态高能消光调制 =================
  
  // 1. 物理速度与多普勒因子
  vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), pos)); 
  float v_mag = 0.7 * sqrt(1.0 / (2.0 * r)); 
  vec3 v = tangent * v_mag; 
  
  float v2 = dot(v, v);
  float gamma = 1.0 / sqrt(max(1.0 - v2, 0.0001)); 
  vec3 photonDirToEye = -normalize(dir);
  float doppler = 1.0 / (gamma * (1.0 - dot(v, photonDirToEye))); 

  // -----------------------------------------------------------
  // ★ 新增：土星环带层次感 (Radial Banding) ★
  // 利用正弦波和开普勒距离 r 生成明暗相间的同心圆环结构
  
  // 主环带：较宽的环缝
  float ringFreq1 = 3.0; 
  float ringPattern = smoothstep(0.2, 0.8, sin(r * ringFreq1 - time * 0.1) * 0.5 + 0.5);
  
  // 细节碎环：细密的唱片纹理
  float ringFreq2 = 12.0;
  float fineRings = smoothstep(0.4, 0.9, sin(1.0 / pow(r, 2.0) * ringFreq2) * 0.5 + 0.5);
  
  // 将环带叠加，并保留 15% 的底灰，避免环缝完全变成死黑透明的
  float ringDensity = mix(0.15, 1.0, ringPattern * fineRings);
  density *= ringDensity;
  // -----------------------------------------------------------

  // 2. 基础温度与频移
  // 基础温度设为 2000.0，留出足够的空间让红侧变暗红，蓝侧变炽白
  float baseTemp = 2000.0 * pow(innerRadius / r, 0.5); 
  // 稍微增大指数，夸大温度两极分化
  float obsTemp = baseTemp * pow(doppler, 1.8); 
  vec3 physicalColor = getBlackBodyColor(obsTemp);

  // 3. ★ 核心：动态星际消光 (Dynamic Extinction) ★
  // 红移侧滤镜：吸收蓝绿光，呈现深邃的暗红色
  vec3 redShiftTint = vec3(1.0, 0.15, 0.05); 
  // 蓝移侧滤镜：高能穿透，稍微偏冷调，让蓝白光芒爆发
  vec3 blueShiftTint = vec3(0.05, 0.15, 1.0); 
  
  // smoothstep 将 doppler 因子平滑映射到 [0, 1] 的混合权重
  // doppler < 0.7 时完全使用红移滤镜，> 1.3 时完全使用蓝移滤镜
  float tintMix = smoothstep(0.7, 1.3, doppler);
  vec3 dynamicTint = mix(redShiftTint, blueShiftTint, tintMix);

  // 物理黑体颜色 乘以 动态滤镜
  vec3 dustColor = physicalColor * dynamicTint;
  
  // 4. 聚束效应与亮度控制
  // 稍微放宽蓝移侧的高光上限，让穿透出来的蓝白光更刺眼
  float beaming = pow(clamp(doppler, 0.5, 1.8), 2.5);

  // color += density * ringDensity * adiskLit * dustColor * beaming * alpha * abs(noise);
  color += density * adiskLit * dustColor * beaming * alpha * abs(noise);

  // ============================纯粹风格化多普勒效应=============================

  
  // oripos = normalize(oripos);
  // vec3 v1 = 0.0 - oripos;
  // vec3 v2 = normalize(pos);
  // // vec3 v2 = pos - oripos;
  // // vec3 normal = normalize(cross(v1, v2));
  // float invariance = dot(vec3(0.0, 1.0, 0.0), cross(v1, v2));
  // float sgn = sign(invariance);
  // invariance = abs(invariance);
  // invariance = pow(invariance, 0.7);
  // vec3 dustColor = vec3(0.5 - sphericalCoord.x / outerRadius * invariance * 0.5 * sgn, 0.5 - sphericalCoord.x / outerRadius * invariance * 0.5, 0.5 + sphericalCoord.x / outerRadius * invariance * 0.5 * sgn);

  // color += density * adiskLit * dustColor * alpha * abs(noise);
}

vec3 traceColor(vec3 pos, vec3 dir, vec2 uv) {
  vec3 color = vec3(0.0);
  float alpha = 1.0;
  vec3 oripos = pos;

  float STEP_SIZE = 0.2;
  dir *= STEP_SIZE;

  // Initial values
  vec3 h = cross(pos, dir);
  float h2 = dot(h, h);

  for (int i = 0; i < 150; i++) {
    if (renderBlackHole > 0.5) {
      // If gravatational lensing is applied
      if (gravatationalLensing > 0.5) {
        vec3 acc = accel(h2, pos);
        dir += acc;
      }

      // Reach event horizon
      if (dot(pos, pos) < 1.0) {
        return color;
      }

      float minDistance = INFINITY;

      if (adiskEnabled > 0.5) {
        adiskColor(pos, dir, color, alpha, uv, oripos);
      }
    }

    pos += dir;
  }

  // Sample skybox color
  dir = rotateVector(normalize(dir), vec3(0.0, 1.0, 0.0), time);
  color += texture(galaxy, dir).rgb * alpha;
  return color;
}

void main() {

  mat3 view;

  float mControl = step(0.5, mouseControl);
  float fView = step(0.5, frontView);
  float tView = step(0.5, topView);

  vec3 cameraPos;
  // vec2 mouse = clamp(vec2(mouseX, mouseY) / resolution.xy, 0.0, 1.0) - 0.5;
  vec2 mouse = clamp(vec2(mouseX, mouseY), 0.0, 1.0) - 0.5;

  vec3 mCameraPos = vec3(-sin(mouse.x * 10.0) * 15.0, mouse.y * 30.0,
                     cos(mouse.x * 10.0) * 15.0);

  vec3 fCameraPos = vec3(15.0, 2.5, 15.0);
  vec3 tCameraPos = vec3(15.0, 5.0, 0.0);
  vec3 defaultCameraPos = vec3(-cos(time * 0.1) * 15.0, sin(time * 0.1) * 15.0,
                     sin(time * 0.1) * 15.0);

  cameraPos = mControl * mCameraPos + (1.0 - mControl) * (fView * fCameraPos + (1.0 - fView) * tView * tCameraPos) + (1.0 - mControl) * (1.0 - fView) * (1.0 - tView) * defaultCameraPos;

  float cRoll = mControl * cameraRoll + (1.0 - mControl) * fView * 45.0 + (1.0 - mControl) * (1.0 - fView) * 0.0;
  
  // if (mouseControl > 0.5) {
  //   vec2 mouse = clamp(vec2(mouseX, mouseY) / resolution.xy, 0.0, 1.0) - 0.5;
  //   cameraPos = vec3(-sin(mouse.x * 10.0) * 15.0, mouse.y * 30.0,
  //                    cos(mouse.x * 10.0) * 15.0);

  // } else if (frontView > 0.5) {
  //   cameraPos = vec3(10.0, 1.0, 10.0);
  // } else if (topView > 0.5) {
  //   cameraPos = vec3(15.0, 10.0, 0.0);
  // } else {
  //   cameraPos = vec3(-cos(time * 0.1) * 15.0, sin(time * 0.1) * 15.0,
  //                    sin(time * 0.1) * 15.0);
  // }

  vec3 target = (1.0 - fView) * vec3(0.0, 0.0, 0.0) + (1.0 - mControl) * fView * vec3(0.0, 1.0, 0.0);
  view = lookAt(cameraPos, target, radians(cRoll));

  vec2 uv = gl_FragCoord.xy / resolution.xy - vec2(0.5);
  uv.x *= resolution.x / resolution.y;

  vec3 dir = normalize(vec3(-uv.x * fovScale, uv.y * fovScale, 1.0));
  vec3 pos = cameraPos;
  dir = view * dir;

  fragColor.rgb = traceColor(pos, dir, uv);
  fragColor.a = 1.0;
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 输出红色
//   vec2 ndc = (gl_FragCoord.xy * 2.0 - resolution.xy) / resolution.y;
//   gl_FragColor = vec4(ndc, 0.0, 1.0);
//   vec3 direction = normalize(vec3(ndc, 1.0));
//   vec4 sampled = textureCube(galaxy, direction);
//   gl_FragColor = vec4(sampled.rgb * 2.0, 1.0);
}

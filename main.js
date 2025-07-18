// // 获取 canvas 元素
// const canvas = document.getElementById('glCanvas');
// const gl = canvas.getContext('webgl');

// if (!gl) {
//     alert('无法初始化 WebGL2，你的浏览器可能不支持。');
//     // return;
// }
const canvas = document.getElementById('canvas');
console.log('Canvas element:', canvas); // 检查是否为 null
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    console.error('无法初始化 WebGL，你的浏览器可能不支持。');
    // return;
}

// 设置 canvas 大小
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

// 从文件加载 shader 并编译
// async function loadShader(type, source) {
//     const shader = gl.createShader(type);
//     gl.shaderSource(shader, source);
//     gl.compileShader(shader);

//     if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
//         console.error('Shader 编译出错:', gl.getShaderInfoLog(shader));
//         gl.deleteShader(shader);
//         return null;
//     }

//     return shader;
// }
async function loadShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    console.log(`Shader compiled successfully: ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}`);
    return shader;
}

async function loadShaderFromFile(type, filePath) {
    try {
        const response = await fetch(filePath);
        const source = await response.text();
        return await loadShader(type, source);
    } catch (error) {
        console.error('加载 shader 文件出错:', error);
        return null;
    }
}

async function createProgram(vertexShaderPath, fragmentShaderPath) {
    const vertexShader = await loadShaderFromFile(gl.VERTEX_SHADER, vertexShaderPath);
    const fragmentShader = await loadShaderFromFile(gl.FRAGMENT_SHADER, fragmentShaderPath);

    if (!vertexShader || !fragmentShader) {
        console.error('着色器加载失败');
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('着色器程序链接失败:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    // 验证程序
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('着色器程序验证失败:', gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

// async function createProgram(vertexShaderPath, fragmentShaderPath) {
//     const vertexShader = await loadShaderFromFile(gl.VERTEX_SHADER, vertexShaderPath);
//     const fragmentShader = await loadShaderFromFile(gl.FRAGMENT_SHADER, fragmentShaderPath);

//     if (!vertexShader || !fragmentShader) {
//         return null;
//     }

//     const program = gl.createProgram();
//     gl.attachShader(program, vertexShader);
//     gl.attachShader(program, fragmentShader);
//     gl.linkProgram(program);

//     if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
//         console.error('Program 链接出错:', gl.getProgramInfoLog(program));
//         gl.deleteProgram(program);
//         return null;
//     }

//     return program;
// }

// 定义 uniform 变量和它们的默认值
const uniforms = {
    gravatationalLensing: 1.0,
    renderBlackHole: 1.0,
    mouseControl: 1.0,
    cameraRoll: 0.0,
    frontView: 0.0,
    topView: 0.0,
    adiskEnabled: 1.0,
    adiskParticle: 1.0,
    adiskDensityV: 2.0,
    adiskDensityH: 4.0,
    adiskHeight: 0.55,
    adiskLit: 0.25,
    // adiskNoiseLOD: 5.0,
    adiskNoiseScale: 0.8,
    adiskSpeed: 0.5,
    // bloomStrength: 0.1,
    // tonemappingEnabled: 1.0,
    // gamma: 2.5,
    mouseX: 0.0,
    mouseY: 0.0,
    fovScale: 1.0
};

// 获取 Wallpaper Engine 的配置
function getWallpaperConfig() {
    if (typeof window.wallpaperPropertyListener === 'object') {
        for (const key in uniforms) {
            if (typeof window.wallpaperPropertyListener[key] !== 'undefined') {
                uniforms[key] = window.wallpaperPropertyListener[key];
            }
        }
    }
}

// 创建纹理
function createColorTexture(width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

// 创建帧缓冲
function createFramebuffer(targetTexture) {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('帧缓冲不完整:', status);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return framebuffer;
}
// function createFramebuffer(texture) {
//     const framebuffer = gl.createFramebuffer();
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
//     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

//     // 检查帧缓冲状态
//     const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
//     if (status !== gl.FRAMEBUFFER_COMPLETE) {
//         console.error('帧缓冲创建失败:', status);
//         return null;
//     }

//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//     return framebuffer;
// }
// function createFramebuffer(texture) {
//     const framebuffer = gl.createFramebuffer();
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
//     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
//     if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
//         console.error('帧缓冲创建失败');
//         return null;
//     }
//     return framebuffer;
// }

// 创建四边形 VAO
// function createQuadVAO() {
//     const positions = [
//         -1.0, -1.0,
//         1.0, -1.0,
//         -1.0, 1.0,
//         -1.0, 1.0,
//         1.0, -1.0,
//         1.0, 1.0
//     ];

//     const positionBuffer = gl.createBuffer();
//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

//     const vao = gl.createVertexArray();
//     gl.bindVertexArray(vao);
//     gl.enableVertexAttribArray(0);
//     gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

//     return vao;
// }
function createQuadVAO() {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    let vao = null;
    if (gl.createVertexArray) {
        // WebGL 2.0: 使用 VAO
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null); // 解绑 VAO
    } else {
        // WebGL 1.0: 不使用 VAO，返回 null
        vao = null;
    }

    // 返回 VAO 和缓冲区对象（WebGL 1.0 需要手动绑定缓冲区）
    return {
        vao: vao,
        positionBuffer: positionBuffer
    };
}
// function createQuadVAO() {
//     const positions = [
//         -1.0, -1.0,
//         1.0, -1.0,
//         -1.0, 1.0,
//         -1.0, 1.0,
//         1.0, -1.0,
//         1.0, 1.0
//     ];

//     // 创建并绑定位置缓冲区
//     const positionBuffer = gl.createBuffer();
//     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

//     // 检查是否支持 VAO (WebGL 2.0)
//     let vao = null;
//     if (gl.createVertexArray) {
//         // WebGL 2.0: 使用 VAO
//         vao = gl.createVertexArray();
//         gl.bindVertexArray(vao);
//         gl.enableVertexAttribArray(0);
//         gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
//         gl.bindVertexArray(null); // 解绑 VAO
//     } else {
//         // WebGL 1.0: 不使用 VAO，返回 null
//         vao = null;
//     }

//     // 返回 VAO 和缓冲区对象（WebGL 1.0 需要手动绑定缓冲区）
//     return {
//         vao: vao,
//         positionBuffer: positionBuffer
//     };
// }

// 加载立方体贴图
async function loadTextureCubeMap(path) {
    const faces = [
        `${path}/right.png`,
        `${path}/left.png`,
        `${path}/top.png`,
        `${path}/bottom.png`,
        `${path}/front.png`,
        `${path}/back.png`
    ];

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    for (let i = 0; i < faces.length; i++) {
        try {
            const response = await fetch(faces[i]);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${faces[i]}`);
            }
            const blob = await response.blob();
            const image = await createImageBitmap(blob);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        } catch (error) {
            console.error(`Error loading cubemap face ${faces[i]}:`, error);
            return null;
        }
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (gl.TEXTURE_WRAP_R) {
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    } else {
        console.warn('TEXTURE_WRAP_R is not supported, ignoring this setting');
    }
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    console.log('立方体贴图加载成功:', path);

    return texture;
}

// async function loadTextureCubeMap(path) {
//     const faces = [
//         `${path}/right.png`,
//         `${path}/left.png`,
//         `${path}/top.png`,
//         `${path}/bottom.png`,
//         `${path}/front.png`,
//         `${path}/back.png`
//     ];

//     const texture = gl.createTexture();
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

//     for (let i = 0; i < faces.length; i++) {
//         const response = await fetch(faces[i]);
//         const blob = await response.blob();
//         const image = await createImageBitmap(blob);
//         gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
//     }

//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//     gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//     // gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
//     if (gl.TEXTURE_WRAP_R) {
//         gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
//     } else {
//         console.warn('TEXTURE_WRAP_R 不被支持，忽略此设置');
//     }

//     return texture;
// }

// 渲染到纹理
// async function renderToTexture(fragShaderPath, uniforms, inputTextures, targetTexture) {
//     const program = await createProgram('shader/simple.vert', fragShaderPath);
//     if (!program) {
//         return;
//     }

//     const framebuffer = createFramebuffer(targetTexture);
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

//     gl.clearColor(0.0, 0.0, 0.0, 1.0);
//     gl.clear(gl.COLOR_BUFFER_BIT);

//     gl.useProgram(program);

//     // 设置 uniform 变量
//     for (const key in uniforms) {
//         const location = gl.getUniformLocation(program, key);
//         if (typeof uniforms[key] === 'boolean') {
//             gl.uniform1i(location, uniforms[key] ? 1 : 0);
//         } else if (typeof uniforms[key] === 'number') {
//             gl.uniform1f(location, uniforms[key]);
//         }
//     }

//     // 设置纹理
//     for (const key in inputTextures) {
//         const unit = Object.keys(inputTextures).indexOf(key);
//         gl.activeTexture(gl.TEXTURE0 + unit);
//         gl.bindTexture(gl.TEXTURE_2D, inputTextures[key]);
//         gl.uniform1i(gl.getUniformLocation(program, key), unit);
//     }

//     const vao = createQuadVAO();
//     gl.bindVertexArray(vao);
//     gl.drawArrays(gl.TRIANGLES, 0, 6);

//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
// }
async function renderToTexture(fragShaderPath, uniforms, inputTextures, targetTexture) {
    const program = await createProgram('shader/simple.vert', fragShaderPath);
    console.log('当前使用的着色器程序:', fragShaderPath);
    if (!program) {
        console.error('着色器程序创建失败:', fragShaderPath);
        return;
    }

    const framebuffer = createFramebuffer(targetTexture);
    if (!framebuffer) {
        console.error('帧缓冲创建失败');
        return;
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    
    // 检查当前帧缓冲是否正确绑定
    const currentFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    if (currentFBO !== framebuffer) {
        console.error('帧缓冲绑定失败');
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    
    // 检查是否正确使用程序
    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    if (currentProgram !== program) {
        console.error('程序使用失败');
        return;
    }

    // 设置 uniform 变量
    for (const key in uniforms) {
        const location = gl.getUniformLocation(program, key);
        console.log(`Uniform ${key} 的位置:`, location);
        if (location === null) {
            console.warn(`Uniform ${key} 不存在于 ${fragShaderPath}`);
            continue;
        }
        
        if (typeof uniforms[key] === 'boolean') {
            gl.uniform1i(location, uniforms[key] ? 1 : 0);
        } else if (typeof uniforms[key] === 'number') {
            gl.uniform1f(location, uniforms[key]);
        }
    }

    // 设置纹理
    for (const key in inputTextures) {
        const unit = Object.keys(inputTextures).indexOf(key);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, inputTextures[key]);
        
        const location = gl.getUniformLocation(program, key);
        if (location === null) {
            console.warn(`Uniform ${key} 不存在`);
            continue;
        }
        
        gl.uniform1i(location, unit);
    }

    const quad = createQuadVAO();

    if (quad.vao) {
        gl.bindVertexArray(quad.vao);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, quad.positionBuffer);
        const positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    }
    gl.useProgram(program);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (quad.vao) {
        gl.bindVertexArray(null);
    }
    

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // 检查是否有 WebGL 错误
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
        console.error('渲染到纹理时出错:', error);
    }
}
// async function renderToTexture(fragShaderPath, uniforms, inputTextures, targetTexture) {
//     const program = await createProgram('shader/simple.vert', fragShaderPath);
//     if (!program) {
//         return;
//     }

//     const framebuffer = createFramebuffer(targetTexture);
//     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

//     gl.clearColor(0.0, 0.0, 0.0, 1.0);
//     gl.clear(gl.COLOR_BUFFER_BIT);

//     gl.useProgram(program);

//     // 设置 uniform 变量
//     for (const key in uniforms) {
//         const location = gl.getUniformLocation(program, key);
//         if (typeof uniforms[key] === 'boolean') {
//             gl.uniform1i(location, uniforms[key] ? 1 : 0);
//         } else if (typeof uniforms[key] === 'number') {
//             gl.uniform1f(location, uniforms[key]);
//         }
//     }

//     // 设置纹理
//     for (const key in inputTextures) {
//         const unit = Object.keys(inputTextures).indexOf(key);
//         gl.activeTexture(gl.TEXTURE0 + unit);
//         gl.bindTexture(gl.TEXTURE_2D, inputTextures[key]);
//         gl.uniform1i(gl.getUniformLocation(program, key), unit);
//     }

//     const quad = createQuadVAO();
//     if (quad.vao) {
//         // WebGL 2.0: 使用 VAO
//         gl.bindVertexArray(quad.vao);
//     } else {
//         // WebGL 1.0: 手动绑定缓冲区
//         gl.bindBuffer(gl.ARRAY_BUFFER, quad.positionBuffer);
//         gl.enableVertexAttribArray(0);
//         gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
//     }

//     gl.drawArrays(gl.TRIANGLES, 0, 6);

//     if (quad.vao) {
//         // 如果使用了 VAO，解绑 VAO
//         gl.bindVertexArray(null);
//     }

//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
// }

// 主渲染循环
async function main() {
    const galaxy = await loadTextureCubeMap('assets/skybox_nebula_dark');
    if (!galaxy) {
    console.error('立方体贴图加载失败');
    return;
    }

    const texBlackhole = createColorTexture(canvas.width, canvas.height);
    const texBrightness = createColorTexture(canvas.width, canvas.height);
    const MAX_BLOOM_ITER = 8;
    const texDownsampled = new Array(MAX_BLOOM_ITER).fill(0).map((_, i) =>
        createColorTexture(canvas.width >> (i + 1), canvas.height >> (i + 1))
    );
    const texUpsampled = new Array(MAX_BLOOM_ITER).fill(0).map((_, i) =>
        createColorTexture(canvas.width >> i, canvas.height >> i)
    );
    const texBloomFinal = createColorTexture(canvas.width, canvas.height);
    const texTonemapped = createColorTexture(canvas.width, canvas.height);

    const passthroughProgram = await createProgram('shader/simple.vert', 'shader/passthrough.frag');
    if (!passthroughProgram) {
        return;
    }

    const quad = createQuadVAO();

    function render() {
        gl.viewport(0, 0, canvas.width, canvas.height);
        getWallpaperConfig();

        // 渲染黑洞
        const blackholeUniforms = {
            ...uniforms,
            mouseX: uniforms.mouseX,
            mouseY: uniforms.mouseY,
            fovScale: uniforms.fovScale,
            galaxy: galaxy
        };
        // blackholeUniforms.galaxy = { galaxy };
        renderToTexture('shader/blackhole_main.frag', blackholeUniforms, {}, texBlackhole);

        // 亮度提取
        renderToTexture('shader/bloom_brightness_pass.frag', {}, { texture0: texBlackhole }, texBrightness);

        // 下采样
        let bloomIterations = 8;
        for (let level = 0; level < bloomIterations; level++) {
            const inputTexture = level === 0 ? texBrightness : texDownsampled[level - 1];
            renderToTexture('shader/bloom_downsample.frag', {}, { texture0: inputTexture }, texDownsampled[level]);
        }

        // 上采样
        for (let level = bloomIterations - 1; level >= 0; level--) {
            const inputTexture0 = level === bloomIterations - 1 ? texDownsampled[level] : texUpsampled[level + 1];
            const inputTexture1 = level === 0 ? texBrightness : texDownsampled[level - 1];
            renderToTexture('shader/bloom_upsample.frag', {}, { texture0: inputTexture0, texture1: inputTexture1 }, texUpsampled[level]);
        }

        // 合成
        const bloomUniforms = { bloomStrength: 0.1 };
        renderToTexture('shader/bloom_composite.frag', bloomUniforms, { texture0: texBlackhole, texture1: texUpsampled[0] }, texBloomFinal);

        // 色调映射
        const tonemappingUniforms = {
            tonemappingEnabled: 1.0,
            gamma: 2.5
        };
        renderToTexture('shader/tonemapping.frag', tonemappingUniforms, { texture0: texBloomFinal }, texTonemapped);

        // 最终渲染
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texTonemapped);
        // gl.bindTexture(gl.TEXTURE_2D, texBlackhole); 
        gl.uniform1i(gl.getUniformLocation(passthroughProgram, "texture0"), 0);

        if (quad.vao) {
            // WebGL 2.0: 使用 VAO
            gl.bindVertexArray(quad.vao);
        } else {
            // WebGL 1.0: 手动绑定缓冲区
            gl.bindBuffer(gl.ARRAY_BUFFER, quad.positionBuffer);
            const positionLocation = gl.getAttribLocation(passthroughProgram, "position");
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        }

        gl.useProgram(passthroughProgram);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (quad.vao) {
            // 如果使用了 VAO，解绑 VAO
            gl.bindVertexArray(null);
        }

        requestAnimationFrame(render);
    }

    render();
}
// async function main() {
//     const galaxy = await loadTextureCubeMap('assets/skybox_nebula_dark');

//     const texBlackhole = createColorTexture(canvas.width, canvas.height);
//     const texBrightness = createColorTexture(canvas.width, canvas.height);
//     const MAX_BLOOM_ITER = 8;
//     const texDownsampled = new Array(MAX_BLOOM_ITER).fill(0).map((_, i) =>
//         createColorTexture(canvas.width >> (i + 1), canvas.height >> (i + 1))
//     );
//     const texUpsampled = new Array(MAX_BLOOM_ITER).fill(0).map((_, i) =>
//         createColorTexture(canvas.width >> i, canvas.height >> i)
//     );
//     const texBloomFinal = createColorTexture(canvas.width, canvas.height);
//     const texTonemapped = createColorTexture(canvas.width, canvas.height);

//     const passthroughProgram = await createProgram('shader/simple.vert', 'shader/passthrough.frag');
//     if (!passthroughProgram) {
//         return;
//     }

//     // const vao = createQuadVAO();
//     const quad = createQuadVAO();

//     // function render() {
//     //     getWallpaperConfig();

//     //     // 渲染黑洞
//     //     const blackholeUniforms = {
//     //         ...uniforms,
//     //         mouseX: uniforms.mouseX,
//     //         mouseY: uniforms.mouseY,
//     //         fovScale: uniforms.fovScale
//     //     };
//     //     blackholeUniforms.cubemapUniforms = { galaxy };
//     //     renderToTexture('shader/blackhole_main.frag', blackholeUniforms, {}, texBlackhole);

//     //     // 亮度提取
//     //     renderToTexture('shader/bloom_brightness_pass.frag', {}, { texture0: texBlackhole }, texBrightness);

//     //     // 下采样
//     //     let bloomIterations = 8;
//     //     for (let level = 0; level < bloomIterations; level++) {
//     //         const inputTexture = level === 0 ? texBrightness : texDownsampled[level - 1];
//     //         renderToTexture('shader/bloom_downsample.frag', {}, { texture0: inputTexture }, texDownsampled[level]);
//     //     }

//     //     // 上采样
//     //     for (let level = bloomIterations - 1; level >= 0; level--) {
//     //         const inputTexture0 = level === bloomIterations - 1 ? texDownsampled[level] : texUpsampled[level + 1];
//     //         const inputTexture1 = level === 0 ? texBrightness : texDownsampled[level - 1];
//     //         renderToTexture('shader/bloom_upsample.frag', {}, { texture0: inputTexture0, texture1: inputTexture1 }, texUpsampled[level]);
//     //     }

//     //     // 合成
//     //     const bloomUniforms = { bloomStrength: uniforms.bloomStrength };
//     //     renderToTexture('shader/bloom_composite.frag', bloomUniforms, { texture0: texBlackhole, texture1: texUpsampled[0] }, texBloomFinal);

//     //     // 色调映射
//     //     const tonemappingUniforms = {
//     //         tonemappingEnabled: uniforms.tonemappingEnabled,
//     //         gamma: uniforms.gamma
//     //     };
//     //     renderToTexture('shader/tonemapping.frag', tonemappingUniforms, { texture0: texBloomFinal }, texTonemapped);

//     //     // 最终渲染
//     //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//     //     gl.clearColor(0.0, 0.0, 0.0, 1.0);
//     //     gl.clear(gl.COLOR_BUFFER_BIT);

//     //     gl.useProgram(passthroughProgram);
//     //     gl.activeTexture(gl.TEXTURE0);
//     //     gl.bindTexture(gl.TEXTURE_2D, texTonemapped);
//     //     gl.uniform1i(gl.getUniformLocation(passthroughProgram, "texture0"), 0);

//     //     gl.bindVertexArray(vao);
//     //     gl.drawArrays(gl.TRIANGLES, 0, 6);

//     //     requestAnimationFrame(render);
//     // }
//     function render() {
//     getWallpaperConfig();

//     // 渲染黑洞
//     const blackholeUniforms = {
//         ...uniforms,
//         mouseX: uniforms.mouseX,
//         mouseY: uniforms.mouseY,
//         fovScale: uniforms.fovScale
//     };
//     blackholeUniforms.cubemapUniforms = { galaxy };
//     renderToTexture('shader/blackhole_main.frag', blackholeUniforms, {}, texBlackhole);

//     // 亮度提取
//     renderToTexture('shader/bloom_brightness_pass.frag', {}, { texture0: texBlackhole }, texBrightness);

//     // 下采样
//     let bloomIterations = 8;
//     for (let level = 0; level < bloomIterations; level++) {
//         const inputTexture = level === 0 ? texBrightness : texDownsampled[level - 1];
//         renderToTexture('shader/bloom_downsample.frag', {}, { texture0: inputTexture }, texDownsampled[level]);
//     }

//     // 上采样
//     for (let level = bloomIterations - 1; level >= 0; level--) {
//         const inputTexture0 = level === bloomIterations - 1 ? texDownsampled[level] : texUpsampled[level + 1];
//         const inputTexture1 = level === 0 ? texBrightness : texDownsampled[level - 1];
//         renderToTexture('shader/bloom_upsample.frag', {}, { texture0: inputTexture0, texture1: inputTexture1 }, texUpsampled[level]);
//     }

//     // 合成
//     const bloomUniforms = { bloomStrength: uniforms.bloomStrength };
//     renderToTexture('shader/bloom_composite.frag', bloomUniforms, { texture0: texBlackhole, texture1: texUpsampled[0] }, texBloomFinal);

//     // 色调映射
//     const tonemappingUniforms = {
//         tonemappingEnabled: uniforms.tonemappingEnabled,
//         gamma: uniforms.gamma
//     };
//     renderToTexture('shader/tonemapping.frag', tonemappingUniforms, { texture0: texBloomFinal }, texTonemapped);

//     // 最终渲染
//     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
//     gl.clearColor(0.0, 0.0, 0.0, 1.0);
//     gl.clear(gl.COLOR_BUFFER_BIT);

//     gl.useProgram(passthroughProgram);
//     gl.activeTexture(gl.TEXTURE0);
//     gl.bindTexture(gl.TEXTURE_2D, texTonemapped);
//     gl.uniform1i(gl.getUniformLocation(passthroughProgram, "texture0"), 0);

//     // 根据是否支持 VAO 进行不同处理
//     if (quad.vao) {
//         // WebGL 2.0: 使用 VAO
//         gl.bindVertexArray(quad.vao);
//     } else {
//         // WebGL 1.0: 手动绑定缓冲区
//         gl.bindBuffer(gl.ARRAY_BUFFER, quad.positionBuffer);
//         gl.enableVertexAttribArray(0);
//         gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
//     }
//     gl.drawArrays(gl.TRIANGLES, 0, 6);

//     if (quad.vao) {
//         // 如果使用了 VAO，解绑 VAO
//         gl.bindVertexArray(null);
//     }

//     requestAnimationFrame(render);
//     }

//     render();
// }

main();

// 处理 Wallpaper Engine 的配置更新
window.wallpaperPropertyListener = {
    applyUserProperties: function (properties) {
        for (const key in properties) {
            if (typeof uniforms[key] !== 'undefined') {
                if (typeof properties[key].value === 'boolean') {
                    uniforms[key] = properties[key].value;
                } else if (typeof properties[key].value === 'number') {
                    uniforms[key] = properties[key].value;
                }
            }
        }
    }
};

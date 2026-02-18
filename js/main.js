// 获取 canvas 元素和 WebGL 上下文
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('无法初始化 WebGL2，你的浏览器可能不支持。');
    throw new Error('WebGL not supported');
}

const ext = gl.getExtension('EXT_color_buffer_float');
if (!ext) {
    console.error('EXT_color_buffer_float扩展不可用，无法实现HDR效果。');
    // return;
}

// 设置画布大小
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 加载着色器
async function loadShader(url) {
    const response = await fetch(url);
    return response.text();
}

// 编译着色器
function compileShader(gl, shaderSource, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        console.error('着色器编译错误:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    else 
    {
        console.log('着色器编译成功:', shaderType === gl.VERTEX_SHADER ? '顶点' : '片段');
    }
    return shader;
}

// 创建着色器程序
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        console.error('程序链接错误:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    else
    {
        console.log('程序链接成功');
    }
    return program;
}

// 创建顶点缓冲区
function createQuadBuffer(gl) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const positions = [
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    return buffer;
}

// 创建帧缓冲区和纹理
function createFramebuffer(gl, width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    
    // console.log(gl.RGBA32F);


    return { texture, framebuffer };
}

class Uniforms
{
    constructor()
    {
        this.settings = 
        {
            resolution: [window.innerWidth, window.innerHeight],
            time: 0,
            mouseX: 0.5,
            mouseY: 0.5,
            fovScale: 1.0,
            frontView: 0.0,
            topView: 0.0,
            cameraRoll: 0.0,
            gravitationalLensing: 1.0,
            renderBlackHole: 1.0,
            mouseControl: 1.0,
            adiskEnabled: 1.0,
            adiskParticle: 1.0,
            adiskHeight: 0.55,
            adiskLit: 0.25,
            adiskDensityH: 2.5,
            adiskDensityV: 2.0,
            adiskNoiseScale: 0.8,
            adiskSpeed: 0.5,
            bloomIterations: 8,
            bloomStrength: 0.1,
            tone: 1.0,
            tonemappingEnabled: 1.0,
            gamma: 2.5
        }
    }
    updateTime(startTime)
    {
        this.settings.time = (performance.now() - startTime) / 1000.0;
    }
    updateMouse(x, y)
    {
        this.settings.mouseX = x;
        this.settings.mouseY = y;
    }
    updateResolution(width, height)
    {
        this.settings.resolution = [width, height];
    }
}

// 加载立方体贴图
async function loadTextureCubeMap(path) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const faces = [
        `${path}/right.png`,
        `${path}/left.png`,
        `${path}/top.png`,
        `${path}/bottom.png`,
        `${path}/front.png`,
        `${path}/back.png`
    ];

    const faceTargets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X, // right
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // left
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // top
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // bottom
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // back
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z  // front
    ];

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (gl.TEXTURE_WRAP_R) {
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    } else {
        console.warn('TEXTURE_WRAP_R is not supported, ignoring this setting');
    }

    for (let i = 0; i < faces.length; i++) {
        try {
            const response = await fetch(faces[i]);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${faces[i]}`);
            }
            const blob = await response.blob();
            const image = await createImageBitmap(blob);
            gl.texImage2D(faceTargets[i], 0, gl.RGBA16F, gl.RGBA, gl.FLOAT, image);
        } catch (error) {
            console.error(`Error loading cubemap face ${faces[i]}:`, error);
            return null;
        }
    }

    // 检查纹理尺寸是否为2的幂次方
    const isPowerOfTwo = (image) => {
        return (image.width & (image.width - 1)) === 0 && 
               (image.height & (image.height - 1)) === 0;
    };
    
    // 如果纹理尺寸是2的幂次方，则生成mipmap
    if (isPowerOfTwo(await createImageBitmap(await (await fetch(faces[0])).blob()))) {
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    } else {
        // 非2的幂次方纹理不能使用mipmap
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        console.log('立方体贴图不是2的幂次方，禁用mipmap');
    }
    // gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    console.log('立方体贴图加载成功:', path);

    return texture;
}

function initControlPanel(uniforms) {
    const gravitationalLensing = document.getElementById('gravitationalLensing');
    const renderBlackHole = document.getElementById('renderBlackHole');
    const mouseControl = document.getElementById('mouseControl');
    const adiskEnabled = document.getElementById('adiskEnabled');
    const adiskHeight = document.getElementById('adiskHeight');
    const bloomStrength = document.getElementById('bloomStrength');
    const adiskParticle = document.getElementById('adiskParticle');
    const tonemappingEnabled = document.getElementById('tonemappingEnabled');
    const gamma = document.getElementById('gamma');
    const frontView = document.getElementById('frontView');
    const topView = document.getElementById('topView');
    const cameraRoll = document.getElementById('cameraRoll');
    const adiskDensityH = document.getElementById('adiskDensityH');
    const adiskDensityV = document.getElementById('adiskDensityV');
    const adiskNoiseScale = document.getElementById('adiskNoiseScale');
    const adiskSpeed = document.getElementById('adiskSpeed');
    const fovScale = document.getElementById('fovScale');
    const adiskLit = document.getElementById('adiskLit');
    const bloomIterations = document.getElementById('bloomIterations');

    const fovScaleValue = document.getElementById('fovScaleValue');
    const adiskDensityHValue = document.getElementById('adiskDensityHValue');
    const adiskDensityVValue = document.getElementById('adiskDensityVValue');
    const adiskNoiseScaleValue = document.getElementById('adiskNoiseScaleValue');
    const adiskSpeedValue = document.getElementById('adiskSpeedValue');
    const adiskLitValue = document.getElementById('adiskLitValue');
    const bloomIterationsValue = document.getElementById('bloomIterationsValue');
    const bloomStrengthValue = document.getElementById('bloomStrengthValue');
    const adiskHeightValue = document.getElementById('adiskHeightValue');
    const cameraRollValue = document.getElementById('cameraRollValue');
    const gammaValue = document.getElementById('gammaValue');



    // 设置初始值
    gravitationalLensing.checked = uniforms.settings.gravitationalLensing === 1.0;
    renderBlackHole.checked = uniforms.settings.renderBlackHole === 1.0;
    mouseControl.checked = uniforms.settings.mouseControl === 1.0;
    adiskEnabled.checked = uniforms.settings.adiskEnabled === 1.0;
    adiskHeight.value = uniforms.settings.adiskHeight;
    bloomStrength.value = uniforms.settings.bloomStrength;
    adiskParticle.checked = uniforms.settings.adiskParticle === 1.0;
    tonemappingEnabled.checked = uniforms.settings.tonemappingEnabled === 1.0;
    gamma.value = uniforms.settings.gamma;
    frontView.checked = uniforms.settings.frontView === 1.0;
    topView.checked = uniforms.settings.topView === 1.0;
    cameraRoll.value = uniforms.settings.cameraRoll;
    adiskDensityH.value = uniforms.settings.adiskDensityH;
    adiskDensityV.value = uniforms.settings.adiskDensityV;
    adiskNoiseScale.value = uniforms.settings.adiskNoiseScale;
    adiskSpeed.value = uniforms.settings.adiskSpeed;
    fovScale.value = uniforms.settings.fovScale;
    adiskLit.value = uniforms.settings.adiskLit;
    bloomIterations.value = Math.round(uniforms.settings.bloomIterations);

    // 事件监听器
    gravitationalLensing.addEventListener('change', () => {
        uniforms.settings.gravitationalLensing = gravitationalLensing.checked ? 1.0 : 0.0;
    });

    renderBlackHole.addEventListener('change', () => {
        uniforms.settings.renderBlackHole = renderBlackHole.checked ? 1.0 : 0.0;
    });

    mouseControl.addEventListener('change', () => {
        uniforms.settings.mouseControl = mouseControl.checked ? 1.0 : 0.0;
    });

    adiskEnabled.addEventListener('change', () => {
        uniforms.settings.adiskEnabled = adiskEnabled.checked ? 1.0 : 0.0;
    });

    adiskHeight.addEventListener('input', () => {
        uniforms.settings.adiskHeight = parseFloat(adiskHeight.value);
        adiskHeightValue.textContent = adiskHeight.value;
    });

    bloomStrength.addEventListener('input', () => {
        uniforms.settings.bloomStrength = parseFloat(bloomStrength.value);
        bloomStrengthValue.textContent = bloomStrength.value;
    });
    adiskParticle.addEventListener('change', () => {
        uniforms.settings.adiskParticle = adiskParticle.checked ? 1.0 : 0.0;
    });

    tonemappingEnabled.addEventListener('change', () => {
        uniforms.settings.tonemappingEnabled = tonemappingEnabled.checked ? 1.0 : 0.0;
    });

    gamma.addEventListener('input', () => {
        uniforms.settings.gamma = parseFloat(gamma.value);
        gammaValue.textContent = gamma.value;
    });

    frontView.addEventListener('change', () => {
        uniforms.settings.frontView = frontView.checked ? 1.0 : 0.0;
    });

    topView.addEventListener('change', () => {
        uniforms.settings.topView = topView.checked ? 1.0 : 0.0;
    });

    cameraRoll.addEventListener('input', () => {
        uniforms.settings.cameraRoll = parseFloat(cameraRoll.value);
        cameraRollValue.textContent = cameraRoll.value;
    });

    adiskDensityH.addEventListener('input', () => {
        uniforms.settings.adiskDensityH = parseFloat(adiskDensityH.value);
        adiskDensityHValue.textContent = adiskDensityH.value;
    });

    adiskDensityV.addEventListener('input', () => {
        uniforms.settings.adiskDensityV = parseFloat(adiskDensityV.value);
        adiskDensityVValue.textContent = adiskDensityV.value;
    });

    adiskNoiseScale.addEventListener('input', () => {
        uniforms.settings.adiskNoiseScale = parseFloat(adiskNoiseScale.value);
        adiskNoiseScaleValue.textContent = adiskNoiseScale.value;
    });

    adiskSpeed.addEventListener('input', () => {
        uniforms.settings.adiskSpeed = parseFloat(adiskSpeed.value);
        adiskSpeedValue.textContent = adiskSpeed.value;
    });

    fovScale.addEventListener('input', () => {
        uniforms.settings.fovScale = parseFloat(fovScale.value);
        fovScaleValue.textContent = fovScale.value;
    });

    adiskLit.addEventListener('input', () => {
        uniforms.settings.adiskLit = parseFloat(adiskLit.value);
        adiskLitValue.textContent = adiskLit.value;
    });

    bloomIterations.addEventListener('input', () => {
        uniforms.settings.bloomIterations = parseInt(bloomIterations.value, 10);
        bloomIterationsValue.textContent = bloomIterations.value;
    });

    // 侧边栏切换功能
    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const showSidebar = document.getElementById('show-sidebar');

    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    showSidebar.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
    });
}


// 主函数
async function main() {
    // 加载着色器代码
    const [vertexShaderSource, fragmentShaderSource, bloomPassSource, bloomDownSource, bloomUpSource, bloomCompSource, tonemapSource] = await Promise.all([
        loadShader('shader/simple.vert'),
        loadShader('shader/blackhole_main.frag'),
        loadShader('shader/bloom_brightness_pass.frag'),
        loadShader('shader/bloom_downsample.frag'),
        loadShader('shader/bloom_upsample.frag'),
        loadShader('shader/bloom_composite.frag'),
        loadShader('shader/tonemapping.frag')
    ]);
    // 加载贴图
    const galaxy = await loadTextureCubeMap('assets/skybox_nebula_dark');
    if (!galaxy) {
        console.error('立方体贴图加载失败');
        return;
    }
    // 编译着色器
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    console.log('vertexShader:', vertexShader);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    console.log('fragmentShader:', fragmentShader);
    const bloomPassShader = compileShader(gl, bloomPassSource, gl.FRAGMENT_SHADER);
    console.log('bloomPassShader:', bloomPassShader);
    const bloomDownShader = compileShader(gl, bloomDownSource, gl.FRAGMENT_SHADER);
    console.log('bloomDownShader:', bloomDownShader);
    const bloomUpShader = compileShader(gl, bloomUpSource, gl.FRAGMENT_SHADER);
    console.log('bloomUpShader:', bloomUpShader);
    const bloomCompShader = compileShader(gl, bloomCompSource, gl.FRAGMENT_SHADER);
    console.log('bloomCompShader:', bloomCompShader);
    const tonemapShader = compileShader(gl, tonemapSource, gl.FRAGMENT_SHADER);
    console.log('tonemapShader:', tonemapShader);
    if (!vertexShader || !fragmentShader || !bloomPassShader || !bloomDownShader || !bloomUpShader || !bloomCompShader || !tonemapShader) {
        return;
    }

    // 创建着色器程序
    const program = createProgram(gl, vertexShader, fragmentShader);
    const bloomPassProgram = createProgram(gl, vertexShader, bloomPassShader);
    const bloomDownProgram = createProgram(gl, vertexShader, bloomDownShader);
    const bloomUpProgram = createProgram(gl, vertexShader, bloomUpShader);
    const bloomCompProgram = createProgram(gl, vertexShader, bloomCompShader);
    const tonemapProgram = createProgram(gl, vertexShader, tonemapShader);
    if (!program || !bloomPassProgram || !bloomDownProgram || !bloomUpProgram || !bloomCompProgram || !tonemapProgram) {
        return;
    }
    // if (!program) return;

    // 创建顶点缓冲区
    const positionBuffer = createQuadBuffer(gl);
    console.log('positionBuffer:', positionBuffer);

    // 获取属性和uniform位置
    const positionAttributeLocation = gl.getAttribLocation(program, 'position');
    console.log('positionAttributeLocation:', positionAttributeLocation);
    const resolutionUniformLocation = gl.getUniformLocation(program, 'resolution');
    console.log('resolutionUniformLocation:', resolutionUniformLocation);
    const timeUniformLocation = gl.getUniformLocation(program, 'time');
    console.log('timeUniformLocation:', timeUniformLocation);
    const mouseXLocation = gl.getUniformLocation(program, 'mouseX');
    console.log('mouseXLocation:', mouseXLocation);
    const mouseYLocation = gl.getUniformLocation(program, 'mouseY');
    console.log('mouseYLocation:', mouseYLocation);
    const fovScaleLocation = gl.getUniformLocation(program, 'fovScale');
    console.log('fovScaleLocation:', fovScaleLocation);
    const frontViewLocation = gl.getUniformLocation(program, 'frontView');
    console.log('frontViewLocation:', frontViewLocation);
    const topViewLocation = gl.getUniformLocation(program, 'topView');
    console.log('topViewLocation:', topViewLocation);
    const cameraRollLocation = gl.getUniformLocation(program, 'cameraRoll');
    console.log('cameraRollLocation:', cameraRollLocation);

    const gravatationalLensingLocation = gl.getUniformLocation(program, 'gravatationalLensing');
    console.log('gravatationalLensingLocation:', gravatationalLensingLocation);
    const renderBlackHoleLocation = gl.getUniformLocation(program, 'renderBlackHole');
    console.log('renderBlackHoleLocation:', renderBlackHoleLocation);
    const mouseControlLocation = gl.getUniformLocation(program,'mouseControl');
    console.log('mouseControlLocation:', mouseControlLocation);

    const adiskEnabledLocation = gl.getUniformLocation(program, 'adiskEnabled');
    console.log('adiskEnabledLocation:', adiskEnabledLocation);
    const adiskParticleLocation = gl.getUniformLocation(program, 'adiskParticle');
    console.log('adiskParticleLocation:', adiskParticleLocation);
    const adiskHeightLocation = gl.getUniformLocation(program, 'adiskHeight');
    console.log('adiskHeightLocation:', adiskHeightLocation);
    const adiskLitLocation = gl.getUniformLocation(program, 'adiskLit');
    console.log('adiskLitLocation:', adiskLitLocation);
    const adiskDensityHLocation = gl.getUniformLocation(program, 'adiskDensityH');
    console.log('adiskDensityHLocation:', adiskDensityHLocation);
    const adiskDensityVLocation = gl.getUniformLocation(program, 'adiskDensityV');
    console.log('adiskDensityVLocation:', adiskDensityVLocation);
    const adiskNoiseScaleLocation = gl.getUniformLocation(program, 'adiskNoiseScale');
    console.log('adiskNoiseScaleLocation:', adiskNoiseScaleLocation);
    const adiskSpeedLocation = gl.getUniformLocation(program, 'adiskSpeed');
    console.log('adiskSpeedLocation:', adiskSpeedLocation);

    const galaxyLocation = gl.getUniformLocation(program, 'galaxy');
    console.log('galaxyLocation:', galaxyLocation);

    // 启用属性
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // 时间跟踪
    let startTime = performance.now();
    const uniforms = new Uniforms();
    window.uniforms = uniforms;

    // 注册鼠标位置
    window.addEventListener('mousemove', (event) => {
        const x = event.clientX / canvas.width;
        const y = event.clientY / canvas.height;
        uniforms.updateMouse(x, y);
    });

    window.addEventListener('resize', () => {
        // 获取新画布大小
        const newWidth = canvas.clientWidth;
        const newHeight = canvas.clientHeight;
        // 重置画布大小
        {
            canvas.width = newWidth;
            canvas.height = newHeight;
            uniforms.updateResolution(canvas.width, canvas.height);
            mainFramebuffer = createFramebuffer(gl, canvas.width, canvas.height);
            texBrightness = createFramebuffer(gl, canvas.width, canvas.height);
            compositeFramebuffer = createFramebuffer(gl, canvas.width, canvas.height);
            texDownsampled = [];
            texUpsampled = [];
            for (let i = 0; i < MAX_BLOOM_ITERATIONS; i++) {
                texDownsampled.push(createFramebuffer(gl, canvas.width, canvas.height));
                texUpsampled.push(createFramebuffer(gl, canvas.width, canvas.height));
            }
            console.log('Framebuffer resized to', canvas.width, canvas.height);
        }
    });

    initControlPanel(uniforms);
    
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    let mainFramebuffer = createFramebuffer(gl, canvas.width, canvas.height);

    let texBrightness = createFramebuffer(gl, canvas.width, canvas.height);

    let compositeFramebuffer = createFramebuffer(gl, canvas.width, canvas.height);

    // 增加最大迭代次数的缓冲区和纹理
    const MAX_BLOOM_ITERATIONS = 8;
    let texDownsampled = [];
    let texUpsampled = [];

    for (let i = 0; i < MAX_BLOOM_ITERATIONS; i++) {
        texDownsampled.push(createFramebuffer(gl, canvas.width, canvas.height));
        texUpsampled.push(createFramebuffer(gl, canvas.width, canvas.height));
    }

    // 渲染循环
    function render() {
        // const elapsedTime = (Date.now() - startTime) / 1000.0;
        uniforms.updateTime(startTime);

        gl.bindFramebuffer(gl.FRAMEBUFFER, mainFramebuffer.framebuffer);
        // 清除画布
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 使用着色器程序
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // 设置uniforms
        gl.uniform2f(resolutionUniformLocation, ...uniforms.settings.resolution);
        gl.uniform1f(timeUniformLocation, uniforms.settings.time);
        gl.uniform1f(mouseXLocation, uniforms.settings.mouseX);
        gl.uniform1f(mouseYLocation, uniforms.settings.mouseY);
        gl.uniform1f(fovScaleLocation, uniforms.settings.fovScale);
        gl.uniform1f(frontViewLocation, uniforms.settings.frontView);
        gl.uniform1f(topViewLocation, uniforms.settings.topView);
        gl.uniform1f(cameraRollLocation, uniforms.settings.cameraRoll);

        gl.uniform1f(gravatationalLensingLocation, uniforms.settings.gravitationalLensing);
        gl.uniform1f(renderBlackHoleLocation, uniforms.settings.renderBlackHole);
        gl.uniform1f(mouseControlLocation, uniforms.settings.mouseControl);

        gl.uniform1f(adiskEnabledLocation, uniforms.settings.adiskEnabled);
        gl.uniform1f(adiskParticleLocation, uniforms.settings.adiskParticle);
        gl.uniform1f(adiskHeightLocation, uniforms.settings.adiskHeight);
        gl.uniform1f(adiskLitLocation, uniforms.settings.adiskLit);
        gl.uniform1f(adiskDensityHLocation, uniforms.settings.adiskDensityH);
        gl.uniform1f(adiskDensityVLocation, uniforms.settings.adiskDensityV);
        gl.uniform1f(adiskNoiseScaleLocation, uniforms.settings.adiskNoiseScale);
        gl.uniform1f(adiskSpeedLocation, uniforms.settings.adiskSpeed);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, galaxy);
        gl.uniform1i(galaxyLocation, 0);

        // 绘制全屏四边形
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // console.log()

         // 提取高光
        gl.bindFramebuffer(gl.FRAMEBUFFER, texBrightness.framebuffer);
        gl.useProgram(bloomPassProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mainFramebuffer.texture);
        gl.uniform2f(gl.getUniformLocation(bloomPassProgram,'resolution'), ...uniforms.settings.resolution);
        gl.uniform1i(gl.getUniformLocation(bloomPassProgram, 'texture0'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 下采样
        for (let level = 0; level < uniforms.settings.bloomIterations; level++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, texDownsampled[level].framebuffer);
            gl.useProgram(bloomDownProgram);

            const resolution = [Math.max(1, Math.floor(canvas.width / Math.pow(2, level + 1))), Math.max(1, Math.floor(canvas.height / Math.pow(2, level + 1)))];
            gl.uniform2f(gl.getUniformLocation(bloomDownProgram,'resolution'), ...resolution);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, level === 0 ? texBrightness.texture : texDownsampled[level - 1].texture);
            gl.uniform1i(gl.getUniformLocation(bloomDownProgram, 'texture0'), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        // 上采样
        for (let level = uniforms.settings.bloomIterations - 1; level >= 0; level--) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, texUpsampled[level].framebuffer);
            gl.useProgram(bloomUpProgram);
            
            const resolution = [Math.max(1, Math.floor(canvas.width / Math.pow(2, level))), Math.max(1, Math.floor(canvas.height / Math.pow(2, level)))];
            gl.uniform2f(gl.getUniformLocation(bloomUpProgram,'resolution'), ...resolution);
            // 设置主纹理
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, level === uniforms.settings.bloomIterations - 1 
                ? texDownsampled[level].texture 
                : texUpsampled[level + 1].texture);
            gl.uniform1i(gl.getUniformLocation(bloomUpProgram, 'texture0'), 0);
            
            // 设置第二个纹理（用于组合）
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, level === 0 
                ? texBrightness.texture 
                : texDownsampled[level - 1].texture);
            gl.uniform1i(gl.getUniformLocation(bloomUpProgram, 'texture1'), 1);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        // 合成Bloom效果
        gl.bindFramebuffer(gl.FRAMEBUFFER, compositeFramebuffer.framebuffer);
        gl.useProgram(bloomCompProgram);
        gl.uniform1f(gl.getUniformLocation(bloomCompProgram, 'bloomStrength'), uniforms.settings.bloomStrength);
        gl.uniform1f(gl.getUniformLocation(bloomCompProgram, 'tone'), uniforms.settings.tone);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mainFramebuffer.texture);
        gl.uniform1i(gl.getUniformLocation(bloomCompProgram, 'texture0'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texUpsampled[0].texture);  // 使用最终的上采样结果
        gl.uniform1i(gl.getUniformLocation(bloomCompProgram, 'texture1'), 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 色彩校正
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(tonemapProgram);
        gl.uniform1f(gl.getUniformLocation(tonemapProgram, 'tonemappingEnabled'), uniforms.settings.tonemappingEnabled);
        gl.uniform1f(gl.getUniformLocation(tonemapProgram, 'gamma'), uniforms.settings.gamma);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, compositeFramebuffer.texture);
        gl.uniform1i(gl.getUniformLocation(tonemapProgram, 'texture0'), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 继续渲染循环
        requestAnimationFrame(render);
    }

    // 开始渲染
    render();
}

// 启动应用
main();

// 获取 canvas 元素和 WebGL 上下文
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('无法初始化 WebGL，你的浏览器可能不支持。');
    throw new Error('WebGL not supported');
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return { texture, framebuffer };
}

async function main()
{
    const [vertexShaderSource, fragmentShaderSource] = await Promise.all([
        loadShader('shader/verttest.vert'),
        loadShader('shader/fragtest.frag')
    ]);


    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    console.log('vertexShader:', vertexShader);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    console.log('fragmentShader:', fragmentShader);

    // 创建着色器程序
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const timeUniformLocation = gl.getUniformLocation(program, 'time');
    console.log('timeUniformLocation:', timeUniformLocation);

    // 创建顶点缓冲区
    const positionBuffer = createQuadBuffer(gl);
    console.log('positionBuffer:', positionBuffer);

    // 获取属性和uniform位置
    const positionAttributeLocation = gl.getAttribLocation(program, 'position');
    console.log('positionAttributeLocation:', positionAttributeLocation);

    // 启用属性
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const startTime = Date.now();

    function render() {
        const time = (Date.now() - startTime) / 1000.0;
        gl.uniform1f(timeUniformLocation, time);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // 使用着色器程序
        gl.useProgram(program);

        // 绘制全屏四边形
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        
        requestAnimationFrame(render);
    }

    render();

}

main();
var gl;
var programInfo;
var bufferInfo;
var skyboxProgramInfo;
var quadBufferInfo;
var v3 = twgl.v3;
var m4 = twgl.m4;
var mat4;
const loader = new THREE.OBJLoader();

var fov_Y = 50;
var cameraAngles = {
    y_angle: 0,
    x_angle: -10,
};

var near = 0.1;
var far = 2.5;
var canvasWidth = 1000;
var canvasHeight = 1000;
var aspect = canvasWidth / canvasHeight;
var radius = 1;
var modelObj;
var modelDim;
var cameraLookAt;

var texture;
var cubemap;

var mapping = "Texture";

let scene = [];

/** @type {WebGLRenderingContext} */
window.addEventListener("load", async function () {
    mat4 = importMat4();
    gl = document.getElementById("glcanvas").getContext("webgl2");
    const textures = twgl.createTextures(gl, {
        rayman: {
            src: 'assets/textures/Rayman.png',
            flipY: true
        },
        environment: {
            target: gl.TEXTURE_CUBE_MAP,
            src: await [
                "posx.jpg",
                "negx.jpg",
                "posy.jpg",
                "negy.jpg",
                "posz.jpg",
                "negz.jpg"
            ].map((url) => "https://twgljs.org/examples/images/niagarafalls2s/" + url),
            flipY: false,
            min: gl.LINEAR_MIPMAP_LINEAR
        }
    });

    const vs = `#version 300 es
        precision mediump float;

        uniform mat4 modelMatrix;
        uniform mat4 viewMatrix;
        uniform mat4 projectionMatrix;

        in vec3 position;
        in vec3 normal;
        in vec2 uv;

        out vec2 fragUV;
        out vec3 fragNormal;
        out vec3 fragPosition;

        void main () {
            vec4 newPosition = modelMatrix*vec4(position,1);
            fragPosition = newPosition.xyz;
            gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1);
            mat4 normalMatrix = transpose(inverse(modelMatrix));

            fragNormal = normalize((normalMatrix*vec4(normal,0)).xyz);
            fragUV = uv;
        }`;

    const fs = `#version 300 es
        precision mediump float;

        uniform sampler2D tex;
        uniform samplerCube cubeMapTex;
        uniform int mapping;
        uniform vec3 eyePosition;

        in vec2 fragUV;
        in vec3 fragNormal;
        in vec3 fragPosition;

        out vec4 outColor;

        void main () {
            vec3 V = normalize(eyePosition-fragPosition);
            vec3 N = normalize(fragNormal);
            vec3 R = reflect(-V, N);

            vec3 texColor = texture( tex, fragUV ).rgb;
            vec3 envColor = texture( cubeMapTex, R ).rgb;
            outColor = vec4(mapping == 1 ? texColor : envColor, 1);
            // outColor = vec4(abs(N), 1);
        }`;

    modelObj = createSCs(await loadOBJ('assets/models/raymanModel.obj'));
    modelDim = computeModelExtent(modelObj);

    cameraLookAt = modelDim.center;

    vertexAttributes = modelObj.map((d) => ({
        position: { numComponents: 3, data: d.sc.positions },
        normal: { numComponents: 3, data: d.sc.normals },
        uv: { numComponents: 2, data: d.sc.uvs },
    }))

    bufferInfoArray = vertexAttributes.map((vertexAttributes) =>
        twgl.createBufferInfoFromArrays(gl, vertexAttributes)
    )

    programInfo = twgl.createProgramInfo(gl, [vs, fs]);
    gl.useProgram(programInfo.program);

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.3, 0.4, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    texture = textures.rayman;
    cubemap = textures.environment;

    renderScene(
        programInfo,
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(cameraAngles.y_angle)
        ),
        getProjectionMatrix(fov_Y, near, far)
    );

    quadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
        position: {
            numComponents: 2,
            data: [-1, -1, 1, -1, 1, 1, 1, 1, -1, 1, -1, -1]
        }
    })

    var sbvs = `#version 300 es
        precision mediump float;
        in vec2 position;
        out vec2 fragPosition;
        void main() {
            fragPosition = position;
            gl_Position = vec4(position, 1, 1);
        }`;
    var sbfs = `#version 300 es
        precision mediump float;
        uniform samplerCube cubemap;
        in vec2 fragPosition;
        out vec4 outColor;
        uniform mat4 invViewProjectionMatrix;
        uniform vec3 eyePosition;

        void main () {
            vec4 farPlanePosition = invViewProjectionMatrix*vec4(fragPosition, 1, 1);
            vec3 direction = farPlanePosition.xyz/farPlanePosition.w - eyePosition;

            outColor = texture(cubemap, normalize(direction));
        }`;
    skyboxProgramInfo = twgl.createProgramInfo(gl, [sbvs, sbfs]);

    renderSkybox(
        skyboxProgramInfo,
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(cameraAngles.y_angle)
        ),
        getProjectionMatrix(fov_Y, near, far)
    );

    RLoop = new RenderLoop(onRender).start();
});

renderScene = (sceneProgramInfo, viewMatrix, projectionMatrix) => {
    gl.useProgram(programInfo.program);
    const eyePosition = m4.inverse(viewMatrix).slice(12, 15);
    const uniforms = ({
        eyePosition,
        modelMatrix: m4.identity(),
        viewMatrix: viewMatrix,
        projectionMatrix: getProjectionMatrix(fov_Y, near, far),
        tex: texture,
        cubeMapTex: cubemap,
        mapping: mapping == "Texture"
    })
    twgl.setUniforms(programInfo, uniforms);
    bufferInfoArray.forEach((bufferInfo) => {
        twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        twgl.drawBufferInfo(gl, bufferInfo);
    });
}

renderSkybox = (skyboxProgramInfo, viewMatrix, projectionMatrix) => {
    const invViewMatrix = m4.inverse(viewMatrix);
    const invProjectionMatrix = m4.inverse(projectionMatrix);
    const invViewProjectionMatrix = m4.multiply(
        invViewMatrix,
        invProjectionMatrix
    );
    const eyePosition = invViewMatrix.slice(12, 15);

    const uniforms = {
        cubemap,
        invViewProjectionMatrix,
        eyePosition
    };
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(skyboxProgramInfo.program);
    twgl.setUniforms(skyboxProgramInfo, uniforms);

    twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, quadBufferInfo);
    twgl.drawBufferInfo(gl, quadBufferInfo);
    gl.depthFunc(gl.LESS);
}



function getViewMatrix(r, x_angle, y_angle) {
    const gazeDirection = m4.transformDirection(
        m4.multiply(m4.rotationY(y_angle), m4.rotationX(x_angle)),
        [0, 0, 1]
    );
    const eye = v3.add(cameraLookAt, v3.mulScalar(gazeDirection, r * modelDim.dia));
    const cameraMatrix = m4.lookAt(eye, cameraLookAt, [0, 1, 0]);
    return m4.inverse(cameraMatrix);
}

function getProjectionMatrix(fov, near, far) {
    return m4.perspective(
        deg2rad(fov),
        aspect,
        near * modelDim.dia,
        far * modelDim.dia
    );
}



var time = 0;

function onRender(dt) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    time += dt;
    renderScene(
        programInfo,
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(time * 50)
        ),
        getProjectionMatrix(fov_Y, near, far)
    );
    renderSkybox(
        skyboxProgramInfo,
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(cameraAngles.y_angle)
        ),
        getProjectionMatrix(fov_Y, near, far)
    );
}
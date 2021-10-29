let gl;
let bufferInfo;
let skyboxProgramInfo;
let quadBufferInfo;
let v3 = twgl.v3;
let m4 = twgl.m4;
let mat4;
const loader = new THREE.OBJLoader();

let fov_Y = 50;
let cameraAngles = {
    y_angle: 0,
    x_angle: -10,
};

let near = 0.1;
let far = 2.5;
let canvasWidth = 1000;
let canvasHeight = 1000;
let aspect = canvasWidth / canvasHeight;
let radius = 1;
let modelObj;
let modelDim;
let cameraLookAt;

let texture;
let cubemap;

let mapping = "Texture";

let scene = [];
let time = 0;
let dt;

/** @type {WebGLRenderingContext} */
window.addEventListener("load", async function () {
    mat4 = importMat4();
    gl = document.getElementById("glcanvas").getContext("webgl2");
    const textures = twgl.createTextures(gl, {
        rayman: {
            src: 'assets/rayman/Rayman.png',
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

    const models = {
        rayman: createSCs(await loadOBJ('assets/rayman/raymanModel.obj'))
    };

    rayman = new GameObject(
        models.rayman,
        textures.rayman,
        raymanShaders,
        raymanScript
    );

    texture = textures.rayman;


    cameraLookAt = rayman.modelDim.center;

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.3, 0.4, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    cubemap = textures.environment;

    renderScene(
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(cameraAngles.y_angle),
            rayman
        ),
        getProjectionMatrix(fov_Y, near, far, rayman),
        rayman
    );

    quadBufferInfo = twgl.createBufferInfoFromArrays(gl, {
        position: {
            numComponents: 2,
            data: [-1, -1, 1, -1, 1, 1, 1, 1, -1, 1, -1, -1]
        }
    })

    let sbvs = `#version 300 es
        precision mediump float;
        in vec2 position;
        out vec2 fragPosition;
        void main() {
            fragPosition = position;
            gl_Position = vec4(position, 1, 1);
        }`;
    let sbfs = `#version 300 es
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
            deg2rad(cameraAngles.y_angle),
            rayman
        ),
        getProjectionMatrix(fov_Y, near, far, rayman)
    );

    RLoop = new RenderLoop(onRender).start();
});

renderScene = (viewMatrix, projectionMatrix, object) => {
    let programInfo = object.programInfo;
    gl.useProgram(programInfo.program);
    const eyePosition = m4.inverse(viewMatrix).slice(12, 15);
    const uniforms = ({
        eyePosition,
        modelMatrix: m4.identity(),
        viewMatrix: viewMatrix,
        projectionMatrix: projectionMatrix,
        tex: object.texture,
        cubeMapTex: cubemap,
        mapping: mapping == "Texture"
    })
    twgl.setUniforms(programInfo, uniforms);
    object.bufferInfoArray.forEach((bufferInfo) => {
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

function getViewMatrix(r, x_angle, y_angle, object) {
    const gazeDirection = m4.transformDirection(
        m4.multiply(m4.rotationY(y_angle), m4.rotationX(x_angle)),
        [0, 0, 1]
    );
    const eye = v3.add(cameraLookAt, v3.mulScalar(gazeDirection, r * object.modelDim.dia));
    const cameraMatrix = m4.lookAt(eye, cameraLookAt, [0, 1, 0]);
    return m4.inverse(cameraMatrix);
}

function getProjectionMatrix(fov, near, far, object) {
    return m4.perspective(
        deg2rad(fov),
        aspect,
        near * object.modelDim.dia,
        far * object.modelDim.dia
    );
}

function onRender() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    time += dt;

    scene.forEach(o => {
        renderScene(
            getViewMatrix(
                radius,
                deg2rad(cameraAngles.x_angle),
                deg2rad(time * 50),
                o
            ),
            getProjectionMatrix(fov_Y, near, far, o),
            o
        );
    });

    renderSkybox(
        skyboxProgramInfo,
        getViewMatrix(
            radius,
            deg2rad(cameraAngles.x_angle),
            deg2rad(cameraAngles.y_angle),
            rayman
        ),
        getProjectionMatrix(fov_Y, near, far, rayman)
    );
}
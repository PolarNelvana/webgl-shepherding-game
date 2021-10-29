class GameObject {
    constructor(modelPath, texturePath, shaders, start, update) {
        this.modelPath = modelPath;
        this.texturePath = texturePath;
        this.shaders == shaders;
        this.position = [0, 0, 0];

        if (modelPath !== undefined) {
            this.model = createSCs(await loadOBJ(modelPath));
            this.modelDim = computeModelExtent(modelObj);
            this.vertexAttributes = modelObj.map((d) => ({
                position: { numComponents: 3, data: d.sc.positions },
                normal: { numComponents: 3, data: d.sc.normals },
                uv: { numComponents: 2, data: d.sc.uvs },
            }))
            this.bufferInfoArray = this.vertexAttributes.map((vertexAttributes) =>
                twgl.createBufferInfoFromArrays(gl, vertexAttributes)
            );
        }

        if (texturePath !== undefined) {
            this.texture = twgl.createTexture(gl, {
                src: texturePath,
                flipY: true
            });
        }

        start();
        this.update = update;
    }
}
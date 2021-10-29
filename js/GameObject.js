class GameObject {
    constructor(model, texture, shaders, script) {
        this.model = model;
        this.texture = texture;
        this.shaders = shaders;
        this.position = [0, 0, 0];

        this.script = new script(this)
        this.update = this.script.update;

        this.modelDim = computeModelExtent(this.model);
        this.vertexAttributes = this.model.map((d) => ({
            position: { numComponents: 3, data: d.sc.positions },
            normal: { numComponents: 3, data: d.sc.normals },
            uv: { numComponents: 2, data: d.sc.uvs },
        }));
        this.bufferInfoArray = this.vertexAttributes.map((vertexAttributes) =>
            twgl.createBufferInfoFromArrays(gl, vertexAttributes)
        );
        this.programInfo = twgl.createProgramInfo(gl, [this.shaders.vs, this.shaders.fs]);

        scene.push(this);
        this.script.start;
    }
}
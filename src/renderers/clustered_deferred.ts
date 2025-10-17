import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';




export class ClusteredDeferredRenderer extends renderer.Renderer {
    // TODO-3: add layouts, pipelines, textures, etc. needed for Forward+ here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;

    fullScreenBindGroupLayout: GPUBindGroupLayout;
    fullScreenBindGroup: GPUBindGroup;

    
    

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    nomralTexture: GPUTexture;
    normalTextureView: GPUTextureView;

    colorTexture: GPUTexture;
    colorTextureView: GPUTextureView;

    worldPosTexture: GPUTexture;
    worldPosTextureView: GPUTextureView;


    pipelineGBuffer: GPURenderPipeline;
    pipelineFullscreen: GPURenderPipeline;


    constructor(stage: Stage) {
        super(stage);


        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "Deferred scene uniforms bind group layout",
            entries: [
                // TODO-1.2: add an entry for camera uniforms at binding 0, visible to only the vertex shader, and of type "uniform"
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {} //Should be uniform type?
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // LightsInClusterBuffer
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // tileSizePixels
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform"}
                },
                { // screenSize
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform"}
                }
                


            ]
        });

        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "Deferred scene uniforms bind group",
            layout: this.sceneUniformsBindGroupLayout,
            entries: [
                // TODO-1.2: add an entry for camera uniforms at binding 0
                // you can access the camera using `this.camera`
                // if you run into TypeScript errors, you're probably trying to upload the host buffer instead
                {
                    binding: 0,
                    resource: {buffer: this.camera.uniformsBuffer}
                },
                {
                    binding: 1,
                    resource: { buffer: this.lights.lightSetStorageBuffer }
                },
                { // LightsInClusterBuffer
                    binding: 2,
                    resource: { buffer: this.lights.lightsInClusterBuffer }
                },
                { // tileSizePixels
                    binding: 3,
                    resource: {buffer: this.lights.pixelSizeBuffer}
                },
                {// screenSize
                    binding: 4,
                    resource: {buffer: this.lights.screenDimBuffer}

                }
            ]
        });

        //Texture binding
        
        this.colorTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.colorTextureView = this.colorTexture.createView();


        this.nomralTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.normalTextureView = this.nomralTexture.createView();


        this.worldPosTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.worldPosTextureView = this.worldPosTexture.createView();

        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.depthTextureView = this.depthTexture.createView();


        
        
        this.fullScreenBindGroupLayout = renderer.device.createBindGroupLayout({
            entries: [
                {//Color
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {//Normal
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {//WorldPos
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}

                },
                {//Depth
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {sampleType: "depth"}
                },
                {//Sampler
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
                {//Depth Sampler
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {type: "non-filtering"}
                }
            ]
        });

        this.fullScreenBindGroup =  renderer.device.createBindGroup({
            layout: this.fullScreenBindGroupLayout,
            entries: [
                {//Color
                    binding: 0,
                    resource: this.colorTextureView
                },
                {//Normal
                    binding: 1,
                    resource: this.normalTextureView
                },
                {//World Pos
                    binding: 2,
                    resource: this.worldPosTextureView
                },
                {//Depth
                    binding: 3,
                    resource: this.depthTextureView
                },
                {//Sampler
                    binding: 4,
                    resource: renderer.device.createSampler()
                },
                {//Depth Sampler
                    binding: 5,
                    resource: renderer.device.createSampler()
                }
            ]
        });

        this.pipelineGBuffer = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    renderer.modelBindGroupLayout,
                    renderer.materialBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    code: shaders.naiveVertSrc,
                }),
                buffers: [ renderer.vertexBufferLayout ]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    code: shaders.clusteredDeferredFragSrc
                }),
                targets: [
                    {
                        format: "rgba8unorm",
                    },
                    {
                        format: "rgba16float",
                    },
                    {
                        format: "rgba16float",
                    }
                ]
            }
        });

        this.pipelineFullscreen = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                bindGroupLayouts: [this.sceneUniformsBindGroupLayout, this.fullScreenBindGroupLayout]
            }),
            vertex: {
                module: renderer.device.createShaderModule({
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    code: shaders.clusteredDeferredFullscreenFragSrc
                }),
                targets: [
                    {
                        format: renderer.canvasFormat,
                    }
                ]
            }
        });


        // TODO-3: initialize layouts, pipelines, textures, etc. needed for Forward+ here
        // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass
    }

    override draw() {
        // TODO-3: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
        const encoder = renderer.device.createCommandEncoder();
        
        const GBufferPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view:  this.colorTexture,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view:  this.normalTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                },
                                {
                    view:  this.worldPosTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        });
        GBufferPass.setPipeline(this.pipelineGBuffer);
        GBufferPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);
        this.scene.iterate(node => {
            GBufferPass.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            GBufferPass.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        },primitive => {
            GBufferPass.setVertexBuffer(0, primitive.vertexBuffer);
            GBufferPass.setIndexBuffer(primitive.indexBuffer, 'uint32');
            GBufferPass.drawIndexed(primitive.numIndices);
        });

        GBufferPass.end();


        this.lights.doLightClustering(encoder);
        const canvasTextureView = renderer.context.getCurrentTexture().createView();
        const FullscreenPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        });

        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
        FullscreenPass.setPipeline(this.pipelineFullscreen);
        FullscreenPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);
        FullscreenPass.setBindGroup(1, this.fullScreenBindGroup);
        FullscreenPass.draw(3, 1, 0, 0); 
        FullscreenPass.end();

        renderer.device.queue.submit([encoder.finish()]);

        
    }
}

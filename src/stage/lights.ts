import { Vec4, vec4, Vec3, vec3 } from "wgpu-matrix";
import { device } from "../renderer";
import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Camera } from "./camera";

// h in [0, 1]
function hueToRgb(h: number) {
    let f = (n: number, k = (n + h * 6) % 6) => 1 - Math.max(Math.min(k, 4 - k, 1), 0);
    return vec3.lerp(vec3.create(1, 1, 1), vec3.create(f(5), f(3), f(1)), 0.8);
}


class AABB{
    min: Vec4;
    max: Vec4;
    constructor(min: Vec4, max: Vec4) {
        this.min = min;
        this.max = max;
    }
}
class ClusterAABB {
    readonly buffer = new ArrayBuffer(shaders.constants.clusterX * shaders.constants.clusterY * shaders.constants.clusterZ * 8 * 4);
    private readonly floatView = new Float32Array(this.buffer);
    
    
    MAX_FLOAT32 = 3.4028235e38;
    MIN_FLOAT32 = -this.MAX_FLOAT32;


    //set the starting AABB to min and max just in case
    startingMin = vec4.create(this.MAX_FLOAT32, this.MAX_FLOAT32, this.MAX_FLOAT32, 1);
    startingMax = vec4.create(this.MIN_FLOAT32, this.MIN_FLOAT32, this.MIN_FLOAT32, 1);

    constructor() {
        for (let i = 0; i < shaders.constants.clusterX * shaders.constants.clusterY * shaders.constants.clusterZ; i++) {

            this.setClusterAABB(new AABB(this.startingMin, this.startingMax), i);
        }
    }
    public setClusterAABB(AABB: AABB, index: number) {
        this.floatView[index * 8 + 0] = AABB.min[0];
        this.floatView[index * 8 + 1] = AABB.min[1];
        this.floatView[index * 8 + 2] = AABB.min[2];
        this.floatView[index * 8 + 3] = AABB.min[3];
        this.floatView[index * 8 + 4] = AABB.max[0];
        this.floatView[index * 8 + 5] = AABB.max[1];
        this.floatView[index * 8 + 6] = AABB.max[2];
        this.floatView[index * 8 + 7] = AABB.max[3];
    }
}



export class Lights {
    private camera: Camera;

    numLights = 500;
    static readonly maxNumLights = 5000;
    static readonly numFloatsPerLight = 8; // vec3f is aligned at 16 byte boundaries

    static readonly lightIntensity = 0.1;

    lightsArray = new Float32Array(Lights.maxNumLights * Lights.numFloatsPerLight);
    lightSetStorageBuffer: GPUBuffer;

    timeUniformBuffer: GPUBuffer;

    moveLightsComputeBindGroupLayout: GPUBindGroupLayout;
    moveLightsComputeBindGroup: GPUBindGroup;
    moveLightsComputePipeline: GPUComputePipeline;

    // TODO-2: add layouts, pipelines, textures, etc. needed for light clustering here

    clusterBindGroupLayout: GPUBindGroupLayout;
    clusterBindGroup: GPUBindGroup;
    clustersAABB: ClusterAABB = new ClusterAABB();
    clustersAABBBuffer: GPUBuffer;

    screenDimBuffer: GPUBuffer;

    pixelSizeBuffer: GPUBuffer;

    clusterBoundsComputePipeline: GPUComputePipeline;

    clusterLightsComputePipeline: GPUComputePipeline;
    




    constructor(camera: Camera) {
        this.camera = camera;

        this.lightSetStorageBuffer = device.createBuffer({
            label: "lights",
            size: 16 + this.lightsArray.byteLength, // 16 for numLights + padding
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.populateLightsBuffer();
        this.updateLightSetUniformNumLights();

        this.timeUniformBuffer = device.createBuffer({
            label: "time uniform",
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.moveLightsComputeBindGroupLayout = device.createBindGroupLayout({
            label: "move lights compute bind group layout",
            entries: [
                { // lightSet
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" }
                },
                { // time
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" }
                }
            ]
        });

        this.moveLightsComputeBindGroup = device.createBindGroup({
            label: "move lights compute bind group",
            layout: this.moveLightsComputeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.lightSetStorageBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.timeUniformBuffer }
                }
            ]
        });

        this.moveLightsComputePipeline = device.createComputePipeline({
            label: "move lights compute pipeline",
            layout: device.createPipelineLayout({
                label: "move lights compute pipeline layout",
                bindGroupLayouts: [ this.moveLightsComputeBindGroupLayout ]
            }),
            compute: {
                module: device.createShaderModule({
                    label: "move lights compute shader",
                    code: shaders.moveLightsComputeSrc
                }),
                entryPoint: "main"
            }
        });

        // TODO-2: initialize layouts, pipelines, textures, etc. needed for light clustering here
        this.clustersAABBBuffer = device.createBuffer({
            label: "Cluster AABB Buffer",
            size: this.clustersAABB.buffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.clustersAABBBuffer, 0, this.clustersAABB.buffer);

        this.screenDimBuffer = device.createBuffer({
            label: "Screen Dim Buffer",
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        let screenDim = new Float32Array([renderer.canvas.width, renderer.canvas.height]);
        device.queue.writeBuffer(this.screenDimBuffer, 0, screenDim);

        this.pixelSizeBuffer = device.createBuffer({
            label: "Pixel Size Buffer",
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });



        let pixelSizeX = Math.ceil(renderer.canvas.width / shaders.constants.clusterX);
        let pixelSizeY = Math.ceil(renderer.canvas.height / shaders.constants.clusterY);
        let pixelSize = new Float32Array([pixelSizeX, pixelSizeY]);
        device.queue.writeBuffer(this.pixelSizeBuffer, 0, pixelSize);

        this.clusterBindGroupLayout = device.createBindGroupLayout({
            label: "Cluster bind group layout",
            entries: [
                { // lightSet
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {type: "read-only-storage"} //Should be uniform type?
                },
                { // clusterAABB
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {type: "storage"}
                },
                { // screenDim
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {type: "uniform"}
                },
                { // cameraMat
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {type: "uniform"}
                },
                { // tileSizePixels
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {type: "uniform"}
                }

            ]
        });
        this.clusterBindGroup = device.createBindGroup({
            label: "Cluster bind group",
            layout: this.clusterBindGroupLayout,
            entries: [
                { // lightSet
                    binding: 0,
                    resource: {buffer: this.lightSetStorageBuffer}
                },
                { // clusterAABB
                    binding: 1,
                    resource: {buffer: this.clustersAABBBuffer}
                },
                { // screenDim
                    binding: 2,
                    resource: {buffer: this.screenDimBuffer}
                },
                { // cameraMat
                    binding: 3,
                    resource: {buffer: this.camera.uniformsBuffer}
                },
                { // tileSizePixels
                    binding: 4,
                    resource: {buffer: this.pixelSizeBuffer}
                }

            ]
        });

        this.clusterBoundsComputePipeline = device.createComputePipeline({
            label: "Clustering compute pipeline",
            layout: device.createPipelineLayout({
                label: "Clustering compute pipeline layout",
                bindGroupLayouts: [ this.clusterBindGroupLayout ]
            }),
            compute: {
                module: device.createShaderModule({
                    label: "Clustering compute shader",
                    code: shaders.clusteringComputeSrc
                }),
                entryPoint: "clusterBounds"
            }
        });



    }

    private populateLightsBuffer() {
        for (let lightIdx = 0; lightIdx < Lights.maxNumLights; ++lightIdx) {
            // light pos is set by compute shader so no need to set it here
            const lightColor = vec3.scale(hueToRgb(Math.random()), Lights.lightIntensity);
            this.lightsArray.set(lightColor, (lightIdx * Lights.numFloatsPerLight) + 4);
        }

        device.queue.writeBuffer(this.lightSetStorageBuffer, 16, this.lightsArray);
    }

    updateLightSetUniformNumLights() {
        device.queue.writeBuffer(this.lightSetStorageBuffer, 0, new Uint32Array([this.numLights]));
    }

    doLightClustering(encoder: GPUCommandEncoder) {
        // TODO-2: run the light clustering compute pass(es) here
        // implementing clustering here allows for reusing the code in both Forward+ and Clustered Deferred

        //Rewrite screen dimensions and pixel sizes in case of resize
        let screenDim = new Float32Array([renderer.canvas.width, renderer.canvas.height]);
        device.queue.writeBuffer(this.screenDimBuffer, 0, screenDim);
        let pixelSizeX = Math.ceil(renderer.canvas.width / shaders.constants.clusterX);
        let pixelSizeY = Math.ceil(renderer.canvas.height / shaders.constants.clusterY);
        let pixelSize = new Float32Array([pixelSizeX, pixelSizeY]);
        device.queue.writeBuffer(this.pixelSizeBuffer, 0, pixelSize);

        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.clusterBoundsComputePipeline);
        computePass.setBindGroup(0, this.clusterBindGroup);
        const workgroupCountX = shaders.constants.clusterX;
        const workgroupCountY = shaders.constants.clusterY;
        const workgroupCountZ = shaders.constants.clusterZ;
        computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, workgroupCountZ);

        computePass.end();

        device.queue.submit([encoder.finish()]);




        
    }

    // CHECKITOUT: this is where the light movement compute shader is dispatched from the host
    onFrame(time: number) {
        device.queue.writeBuffer(this.timeUniformBuffer, 0, new Float32Array([time]));

        // not using same encoder as render pass so this doesn't interfere with measuring actual rendering performance
        const encoder = device.createCommandEncoder();

        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.moveLightsComputePipeline);

        computePass.setBindGroup(0, this.moveLightsComputeBindGroup);

        const workgroupCount = Math.ceil(this.numLights / shaders.constants.moveLightsWorkgroupSize);
        computePass.dispatchWorkgroups(workgroupCount);

        computePass.end();

        device.queue.submit([encoder.finish()]);

        const clusterEncoder = device.createCommandEncoder();

        this.doLightClustering(clusterEncoder);


    }
}

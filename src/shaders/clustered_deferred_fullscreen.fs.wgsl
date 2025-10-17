// TODO-3: implement the Clustered Deferred fullscreen fragment shader

// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.


@group(${bindGroup_scene}) @binding(0) var<uniform> cameraMat: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> LightsInClusterBuffer: array<LightsInCluster, ${clusterX} * ${clusterY} * ${clusterZ}>;
@group(${bindGroup_scene}) @binding(3) var<uniform> tileSizePixels: vec2u;
@group(${bindGroup_scene}) @binding(4) var<uniform> screenSize: vec2u;

@group(1) @binding(0) var gBufferColor: texture_2d<f32>;
@group(1) @binding(1) var gBufferNormal: texture_2d<f32>;
@group(1) @binding(2) var gBufferWorldPos: texture_2d<f32>;
@group(1) @binding(3) var gBufferDepth: texture_depth_2d;
@group(1) @binding(4) var gBufferSampler: sampler;
@group(1) @binding(5) var gBufferDepthSampler: sampler;


fn zSlice(z: f32) -> u32 {
    let logCam = log(f32(${cameraFar}) / f32(${cameraNear}));
    return u32(log(z) * f32(${clusterZ}) / logCam - log(f32(${cameraNear})) * f32(${clusterZ}) / logCam);
}
fn getClusterIndex(fragPos: vec3f) -> u32 {
    let clusterZ = zSlice(fragPos.z);
    let cluster = vec3u(vec2u(fragPos.xy) / tileSizePixels, clusterZ);
    return cluster.x + cluster.y * ${clusterX}u + cluster.z * ${clusterX}u * ${clusterY}u;

}

struct FragmentInput
{
    @builtin(position) fragCoord: vec4f,
    @location(0) uv: vec2f,
}
@fragment
fn main(in: FragmentInput) -> @location(0) vec4f {


    //Flip uv
    let flippedUv = vec2f(in.uv.x, 1.0 - in.uv.y);

    let diffuseColor = textureSample(gBufferColor, gBufferSampler, flippedUv).rgb;
    let normal = normalize(textureSample(gBufferNormal, gBufferSampler, flippedUv).xyz);

    let world = textureSample(gBufferWorldPos, gBufferSampler, flippedUv);


    let far = f32(${cameraFar});
    let near = f32(${cameraNear});

    var totalLightContrib = vec3f(0, 0, 0);

    let screenPos = cameraMat.viewProjMat * vec4<f32>(world.xyz, 1.0);
    let ndcPos = screenPos.xyz / screenPos.w;
    //let tileNear = zNear * pow(zFar / zNear, f32(globalIdx.z) / f32(${clusterZ}));
    let posView = cameraMat.viewMat * vec4<f32>(world.xyz, 1.0);
    let clusterZIdx = zSlice(-posView.z);
    let clusterXIdx = u32((ndcPos.x + 1.0) * 0.5 * f32(${clusterX}));
    let clusterYIdx = u32((ndcPos.y + 1.0) * 0.5 * f32(${clusterY}));
   
    let clusterIdx = clusterZIdx * u32(${clusterX}) * u32(${clusterY}) + clusterYIdx * u32(${clusterX}) + clusterXIdx;
    
    let lightsInCluster = LightsInClusterBuffer[clusterIdx];
    for (var lightIdx = 0u; lightIdx < lightsInCluster.lightCount; lightIdx++) {
        let light = lightSet.lights[lightsInCluster.lightIndices[lightIdx].x];
        totalLightContrib += calculateLightContrib(light, world.xyz, normal);
    }
    
    
    //var finalColor = diffuseColor;
    //var finalColor = normal;
    //var finalColor = vec3f(depth, depth, depth);
    //var finalColor = vec3f(f32(clusterXIdx), f32(clusterYIdx), f32(clusterZIdx)) / vec3f(f32(${clusterX}), f32(${clusterY}), f32(${clusterZ}));
    let finalColor = diffuseColor * totalLightContrib;

    return vec4f(finalColor, 1.0);
    
}
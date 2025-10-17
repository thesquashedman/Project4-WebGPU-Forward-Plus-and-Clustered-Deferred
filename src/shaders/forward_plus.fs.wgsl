// TODO-2: implement the Forward+ fragment shader

// See naive.fs.wgsl for basic fragment shader setup; this shader should use light clusters instead of looping over all lights

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).

@group(${bindGroup_scene}) @binding(0) var<uniform> cameraMat: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> LightsInClusterBuffer: array<LightsInCluster, ${clusterX} * ${clusterY} * ${clusterZ}>;
@group(${bindGroup_scene}) @binding(3) var<uniform> tileSizePixels: vec2u;
@group(${bindGroup_scene}) @binding(4) var<uniform> screenSize: vec2u;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;


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
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

@fragment
fn main(in: FragmentInput) -> @location(0) vec4f
{
    
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a < 0.5f) {
        discard;
    }

    let far = f32(${cameraFar});
    let near = f32(${cameraNear});

    var totalLightContrib = vec3f(0, 0, 0);

    let screenPos = cameraMat.viewProjMat * vec4<f32>(in.pos, 1.0);
    let ndcPos = screenPos.xyz / screenPos.w;
    //let tileNear = zNear * pow(zFar / zNear, f32(globalIdx.z) / f32(${clusterZ}));
    let posView = cameraMat.viewMat * vec4<f32>(in.pos, 1.0);
    let clusterZIdx = zSlice(-posView.z);
    let clusterXIdx = u32((ndcPos.x + 1.0) * 0.5 * f32(${clusterX}));
    let clusterYIdx = u32((ndcPos.y + 1.0) * 0.5 * f32(${clusterY}));
   
    let clusterIdx = clusterZIdx * u32(${clusterX}) * u32(${clusterY}) + clusterYIdx * u32(${clusterX}) + clusterXIdx;
    
    let lightsInCluster = LightsInClusterBuffer[clusterIdx];
    for (var lightIdx = 0u; lightIdx < lightsInCluster.lightCount; lightIdx++) {
        let light = lightSet.lights[lightsInCluster.lightIndices[lightIdx].x];
        totalLightContrib += calculateLightContrib(light, in.pos, in.nor);
    }
    
    var finalColor = diffuseColor.rgb * totalLightContrib;
    //var finalColor = vec3f(f32(clusterXIdx), f32(clusterYIdx), f32(clusterZIdx)) / vec3f(f32(${clusterX}), f32(${clusterY}), f32(${clusterZ}));
    //finalColor *= f32(lightsInCluster.lightCount);
    return vec4(finalColor, 1);
    

}
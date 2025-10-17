// TODO-2: implement the light clustering compute shader
@group(${bindGroup_scene}) @binding(0) var<storage, read_write> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(1) var<storage, read_write> clusterAABB: array<ClusterAABB, ${clusterX} * ${clusterY} * ${clusterZ}>;
@group(${bindGroup_scene}) @binding(2) var<uniform> screenDim: vec2f;
@group(${bindGroup_scene}) @binding(3) var<uniform> cameraMat: CameraUniforms;
@group(${bindGroup_scene}) @binding(4) var<uniform> tileSizePixels: vec2f;
@group(${bindGroup_scene}) @binding(5) var<storage, read_write> LightsInClusterBuffer: array<LightsInCluster, ${clusterX} * ${clusterY} * ${clusterZ}>;



// ------------------------------------
// Calculating cluster bounds:
// ------------------------------------
// For each cluster (X, Y, Z):
//     - Calculate the screen-space bounds for this cluster in 2D (XY).
//     - Calculate the depth bounds for this cluster in Z (near and far planes).
//     - Convert these screen and depth bounds into view-space coordinates.
//     - Store the computed bounding box (AABB) for the cluster.

fn clip2View(clip: vec4f) -> vec4f {
    let view = cameraMat.invProjMat * clip;
    return view / view.w;
}
fn screen2View(screen: vec4f) -> vec4f {
    let clip = vec4f((screen.xy / screenDim) * 2.f - vec2f(1, 1), screen.z, 1.f);
    return clip2View(clip);
}
fn lineIntersectionToZPlane(p0: vec3f, p1: vec3f, zDistance: f32) -> vec3f {
    let p1p0 = p1 - p0;
    let t = zDistance - dot(vec3f(0, 0, 1), p0) / dot(vec3f(0, 0, 1), p1p0);
    return p0 + normalize(p1p0) * t;

}
fn sqDistPointAABB(point: vec3f, tile: u32) -> f32 {
    var sqrDist = 0.0;
    let aabb = clusterAABB[tile];


    if (point.x < aabb.min.x) {
        sqrDist += (aabb.min.x - point.x) * (aabb.min.x - point.x);
    } else if (point.x > aabb.max.x) {
        sqrDist += (point.x - aabb.max.x) * (point.x - aabb.max.x);
    }
    if (point.y < aabb.min.y) {
        sqrDist += (aabb.min.y - point.y) * (aabb.min.y - point.y);
    } else if (point.y > aabb.max.y) {
        sqrDist += (point.y - aabb.max.y) * (point.y - aabb.max.y);
    }
    if (point.z < aabb.min.z) {
        sqrDist += (aabb.min.z - point.z) * (aabb.min.z - point.z);
    } else if (point.z > aabb.max.z) {
        sqrDist += (point.z - aabb.max.z) * (point.z - aabb.max.z);
    }
    return sqrDist;

}
fn testSphereAABB(lightIdx: u32, tileIdx: u32) -> bool {
    let radius = f32(${lightRadius});
    var center = (cameraMat.viewMat * vec4f(lightSet.lights[lightIdx].pos, 1.0)).xyz;
    
    let sqrDist = sqDistPointAABB(center, tileIdx);
    return sqrDist <= radius * radius;

}



@compute
@workgroup_size(${clusteringBoundsWorkgroupSizeX}, ${clusteringBoundsWorkgroupSizeY}, ${clusteringBoundsWorkgroupSizeZ})
fn clusterBounds(@builtin(global_invocation_id) globalIdx: vec3u) {



    if(globalIdx.x >= ${clusterX} || globalIdx.y >= ${clusterY} || globalIdx.z >= ${clusterZ}) {
        return;
    }
    let tileIdx = globalIdx.x + globalIdx.y * ${clusterX} + globalIdx.z * ${clusterX} * ${clusterY};
    
    
    let screenMin = vec2u(globalIdx.xy) * vec2u(tileSizePixels);
    let screenMax = vec2u(globalIdx.xy + vec2u(1, 1)) * vec2u(tileSizePixels);

    // Project to view space with proper clip-Z
    let viewMin = screen2View(vec4f(vec2f(screenMin), 1.0, 1.0)).xyz;
    let viewMax = screen2View(vec4f(vec2f(screenMax), 1.0, 1.0)).xyz;

    // Now scale to get real depth slices


    let zNear = f32(${cameraNear});
    let zFar = f32(${cameraFar});
    let sliceIdx = f32(globalIdx.z);
    let sliceCount = f32(${clusterZ});

    let tileNear = zNear * pow(zFar / zNear, sliceIdx / sliceCount);
    let tileFar  = zNear * pow(zFar / zNear, (sliceIdx + 1.0) / sliceCount);



    let nearMin = viewMin * (tileNear / -viewMin.z);
    let nearMax = viewMax * (tileNear / -viewMax.z);
    let farMin  = viewMin * (tileFar / -viewMin.z);
    let farMax  = viewMax * (tileFar / -viewMax.z);

    //let nearMin = lineIntersectionToZPlane(vec3f(0, 0, 0), viewMin, -tileNear);
    //let nearMax = lineIntersectionToZPlane(vec3f(0, 0, 0), viewMax, -tileNear);
    //let farMin  = lineIntersectionToZPlane(vec3f(0, 0, 0), viewMin, -tileFar);
    //let farMax  = lineIntersectionToZPlane(vec3f(0, 0, 0), viewMax, -tileFar);
    
    clusterAABB[tileIdx].min = vec4f(min(min(nearMin, nearMax), min(farMin, farMax)), 0);
    clusterAABB[tileIdx].max = vec4f(max(max(nearMin, nearMax), max(farMin, farMax)), 0);


    //For now, just go through each light source for each cluster.
    LightsInClusterBuffer[tileIdx].lightCount = 0u;
    for(var lightIdx: u32 = 0u; lightIdx < lightSet.numLights; lightIdx = lightIdx + 1u) {
        
        
        if(testSphereAABB(lightIdx, tileIdx)) {
            let count = LightsInClusterBuffer[tileIdx].lightCount;
            if(count < ${maxLightsPerCluster}u) {
                LightsInClusterBuffer[tileIdx].lightIndices[count] = vec2u(lightIdx, 0u);
                LightsInClusterBuffer[tileIdx].lightCount = count + 1u;
            }
        }
    }
    
    
}




// ------------------------------------
// Assigning lights to clusters:
// ------------------------------------
// For each cluster:
//     - Initialize a counter for the number of lights in this cluster.

//     For each light:
//         - Check if the light intersects with the cluster’s bounding box (AABB).
//         - If it does, add the light to the cluster's light list.
//         - Stop adding lights if the maximum number of lights is reached.

//     - Store the number of lights assigned to this cluster.

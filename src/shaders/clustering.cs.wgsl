// TODO-2: implement the light clustering compute shader
@group(${bindGroup_scene}) @binding(0) var<storage, read_write> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(1) var<storage, read_write> clusterAABB: array<ClusterAABB, ${clusterX} * ${clusterY} * ${clusterZ}>;
@group(${bindGroup_scene}) @binding(2) var<uniform> screenDim: vec2f;
@group(${bindGroup_scene}) @binding(3) var<uniform> cameraMat: CameraUniforms;
@group(${bindGroup_scene}) @binding(4) var<uniform> tileSizePixels: vec2u;
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
    let clip = vec4f((screen.xy / screenDim) * 2.f - 1.f, screen.z, 1.f);
    return clip2View(clip);
}
fn lineIntersectionToZPlane(p0: vec3f, p1: vec3f, zDistance: f32) -> vec3f {
    let p1p0 = p1 - p0;
    let t = zDistance - dot(vec3f(0, 0, 1), p0) / dot(vec3f(0, 0, 1), p1p0);
    return p0 + p1p0 * t;

}


@compute
@workgroup_size(${clusteringWorkgroupSize})
fn clusterBounds(@builtin(global_invocation_id) globalIdx: vec3u) {
    let tileIdx = globalIdx.x + globalIdx.y * ${clusterX} + globalIdx.z * ${clusterX} * ${clusterY};
    if (tileIdx >= u32(${clusterX} * ${clusterY} * ${clusterZ})) {
        return;
    }
    
    let aabbMax = vec4f(vec2f(f32(globalIdx.x + 1), f32(globalIdx.y + 1)) * vec2f(tileSizePixels), -1, 1);
    let aabbMin = vec4f(vec2f(globalIdx.xy) * vec2f(tileSizePixels), -1, 1);

    let aabbMinView = screen2View(aabbMin).xyz;
    let aabbMaxView = screen2View(aabbMax).xyz;

    let zNear = 0.1;
    let zFar = 100.0;
    let tileNear = -zNear * pow(zFar / zNear, f32(globalIdx.z) / f32(${clusterZ}));
    let tileFar = -zNear * pow(zFar / zNear, f32(globalIdx.z + 1) / f32(${clusterZ}));

    let nearPlaneMin = lineIntersectionToZPlane(vec3f(0.0), aabbMinView, tileNear);
    let nearPlaneMax = lineIntersectionToZPlane(vec3f(0.0), aabbMaxView, tileNear);
    let farPlaneMin = lineIntersectionToZPlane(vec3f(0.0), aabbMinView, tileFar);
    let farPlaneMax = lineIntersectionToZPlane(vec3f(0.0), aabbMaxView, tileFar);
    
    clusterAABB[tileIdx].min = vec4f(min(min(nearPlaneMin, nearPlaneMax), min(farPlaneMin, farPlaneMax)), 0);
    clusterAABB[tileIdx].max = vec4f(max(max(nearPlaneMin, nearPlaneMax), max(farPlaneMin, farPlaneMax)), 0);
    
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
@compute
@workgroup_size(${clusteringWorkgroupSize})
fn clusterLights(@builtin(global_invocation_id) globalIdx: vec3u) {
    
}
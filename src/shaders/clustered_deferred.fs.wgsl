// TODO-3: implement the Clustered Deferred G-buffer fragment shader

// This shader should only store G-buffer information and should not do any shading.
struct FragmentInput
{
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}
struct GBuffer
{
    @location(0) color: vec4f,
    @location(1) normal: vec4f,
    @location(2) worldPos: vec4f
}

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;
@fragment
fn main(in: FragmentInput) -> GBuffer
{
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a < 0.5f) {
        discard;
    }

    var out: GBuffer;
    out.color = diffuseColor;
    out.normal = vec4(normalize(in.nor), 1.0);
    out.worldPos = vec4f(in.pos, 1);
    return out;
}


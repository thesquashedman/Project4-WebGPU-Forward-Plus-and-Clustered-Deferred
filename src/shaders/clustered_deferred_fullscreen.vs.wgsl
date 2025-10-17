// TODO-3: implement the Clustered Deferred fullscreen vertex shader

// This shader should be very simple as it does not need all of the information passed by the the naive vertex shader.
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};



@vertex 
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput { 
    var out: VertexOutput; 
    var pos = array<vec2f, 3>(
        vec2f(-1.0, -3.0),
        vec2f(3.0, 1.0),
        vec2f(-1.0, 1.0) );
    let p = pos[vertexIndex];
    out.position = vec4f(p, 0.0, 1.0); 
    out.uv = (p + vec2f(1.0)) * 0.5; 
    return out; 
}
WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 4**

* Pavel Peev
* Tested on: Google Chrome Version 141.0.7390.77 on
  Windows 11, Intel Core Ultra 5 225f, NVIDIA GeForce RTX 5060

### Live Demo

[https://thesquashedman.github.io/Project4-WebGPU-Forward-Plus-and-Clustered-Deferred/](https://thesquashedman.github.io/Project4-WebGPU-Forward-Plus-and-Clustered-Deferred/)

### Demo GIF

![Showcase(2)](https://github.com/user-attachments/assets/69342323-ac99-47f4-ac9f-38a3a095f46f)


## Oveview

This project showcases 3 different renders built on WebGPU and showcases performance based on the number of lights within the scene. The 3 renders included are a naive renderer, which simply iterates over every light in the fragment shader. Next there's the forward+ renderer, which divides the scene into 3 dimensional clusters, which store which lights lay in their space, which are then mapped to each individual fragment, reducing the number of lights each fragment has to iterate through. Finally, it features a deferred renderer, which incorporates the clustered method from the forward+ shader and integrates it with a deferred pipeline, where the albedo, normals, and world positions of each fragment are first recorded into textures without the lighting. These shaders are subsequently passed on to the next render pass which performs the lighting checks using the data from the textures., therefor ensuring that the lighting calculations are only ever done on visible fragments.

### Screen divided into 3D clusters
<img width="1919" height="853" alt="cluster Screenshot" src="https://github.com/user-attachments/assets/bbee5f53-03a3-4619-889c-a4911a83a377" />

### Albedo, normal, and world positions textures within Deferred Renderer

<img width="1919" height="879" alt="Albedo screenshot" src="https://github.com/user-attachments/assets/d92b24ec-d46f-4e5b-940a-c931d026dea7" />
<img width="1919" height="892" alt="normal screenshot" src="https://github.com/user-attachments/assets/39fbe485-812c-4806-b749-0209d6e1e0f7" />
<img width="1919" height="891" alt="worldPos screenshot" src="https://github.com/user-attachments/assets/1c9faefc-3271-47b7-948a-1802fa59b63d" />

## Analysis

<img width="600" height="390" alt="line-graph" src="https://github.com/user-attachments/assets/8b0954d4-6f74-4e69-bc19-83e82e34270c" />

Taking look at the graph, we can see that the Naive renderer performs alright when lights are few, but decreases significantly in performance as light increases, making it really only suitable for scenes with a small amount of lights. In contrast, both the forward+ and deferred render hold steady frame rates for all light values, with Forward+ beating Naive past 1000 lights, and deferred holding strong at 60 fps (which my chrome browser was capped at). This suggests that for large scenes with many lights, the Forward+ and Deferred renderer scale better, with Deferred performing better.

### On Clusters and light limit
The forward+ and deferred renderer are rendered with 16x10x200 clusters on the x, y, and z axis respectfully. They also have a light limit of 350 lights per cluster, which can lead to artifacting when there are too many lights. This results in visible edges between the clusters, as certain lights are not considered for rendering. Light limit is also one of the main contribitors to performance loss, where doubling the light limit shows a 50% loss in performance for the Forward+ renderer and similiar losses for the deferred renderer. As such, careful consideration has to be taken when calculating the light limit. The combination of clusters and light limit has been chosen carefully to maximize performance and minimize artifacting, while also being within the maximum buffer limit. I've found that 16x10 on the x and y axis was good enough to get a good spread of lights in the scene, where further increases do little to decrease artifacting (although they do make the artifacting a bit smoother). In contrast, increasing clusters on the z axis significantly decreased artifacting, and came at virtually no performance cost (due to clusters being handled in parrelel within a compute shader). As such, increasing the number of clusters in the Z axis proved to be an efficient way to redu


### Naive vs Forward+ vs Deferred. Which to Use?

When the scenes are small, the overhead of creating and loading the data structs for the clusters is larger than the cost of simply iterating through each of the lights. As such, in scenes with less than 200 lights, Naive is the best approach. For larger scenes, Forward+ and Deferred are the preferred. In most cased, Deferred will be the way to go, because cutting down on the number of fragments that you need to compare all the lights in the clusters to will always improve performance. The only real downside to the Deferred pipeline is when the number of fragment attributes increase signifantly, resulting in giant textures that take up ton of memory. Not only is the GPU memory often a limited resource, but loading these giant textures into the fragment shader can be a bottleneck, even with the GPU's parralelism.







### Credits

- [Vite](https://vitejs.dev/)
- [loaders.gl](https://loaders.gl/)
- [dat.GUI](https://github.com/dataarts/dat.gui)
- [stats.js](https://github.com/mrdoob/stats.js)
- [wgpu-matrix](https://github.com/greggman/wgpu-matrix)

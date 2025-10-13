import { Vec4, vec4 } from 'wgpu-matrix';
import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Scene } from '../stage/scene';
import { Stage } from '../stage/stage';


export class ForwardPlusRenderer extends renderer.Renderer {





    constructor(stage: Stage) {
        super(stage);

        


    }

    override draw() {
        
        // TODO-2: run the Forward+ rendering pass:
        // - run the clustering compute shader
        // - run the main rendering pass, using the computed clusters for efficient lighting
    }
}

import { SGNode } from "./SGNode"
import { Scenegraph } from "./Scenegraph";
import { Material } from "%COMMON/Material";
import { Stack } from "%COMMON/Stack";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { mat4, vec3, vec4 } from "gl-matrix";
import { IVertexData } from "%COMMON/IVertexData";
import { Light } from "%COMMON/Light"


/**
 * This node represents the leaf of a scene graph. It is the only type of node that has
 * actual geometry to render.
 * @author Amit Shesh
 */

 enum LightCoordinateSystem { View, World, Object };

 class LightInfo {
     light: Light;
     coordinateSystem: LightCoordinateSystem;

     constructor(light: Light, coordinateSystem: LightCoordinateSystem) {
         this.light = light;
         this.coordinateSystem = coordinateSystem;
     }
}

export class LeafNode extends SGNode {

    /**
      * The name of the object instance that this leaf contains. All object instances are stored
      * in the scene graph itself, so that an instance can be reused in several leaves
      */
    protected meshName: string;
    /**
     * The material associated with the object instance at this leaf
     */
    protected material: Material;

    protected textureName: string;

    public constructor(instanceOf: string, graph: Scenegraph<IVertexData>, name: string) {
        super(graph, name);
        this.meshName = instanceOf;

        this.lights = new Array;
        this.lights = [];
    }



    /*
	 *Set the material of each vertex in this object
	 */
    public setMaterial(mat: Material): void {
        this.material = mat;
    }

    /**
     * Set texture ID of the texture to be used for this leaf
     * @param name
     */
    public setTextureName(name: string): void {
        this.textureName = name;
    }

    /*
     * gets the material
     */
    public getMaterial(): Material {
        return this.material;
    }

    public clone(): SGNode {
        let newclone: SGNode = new LeafNode(this.meshName, this.scenegraph, this.name);
        newclone.setMaterial(this.getMaterial());
        return newclone;
    }


    /**
     * Delegates to the scene graph for rendering. This has two advantages:
     * <ul>
     *     <li>It keeps the leaf light.</li>
     *     <li>It abstracts the actual drawing to the specific implementation of the scene graph renderer</li>
     * </ul>
     * @param context the generic renderer context {@link sgraph.IScenegraphRenderer}
     * @param modelView the stack of modelview matrices
     * @throws IllegalArgumentException
     */
    public draw(context: ScenegraphRenderer, modelView: Stack<mat4>): void {
        if (this.meshName.length > 0) {
            context.drawMesh(this.meshName, this.material, this.textureName, modelView.peek());
        }
    }

    public lightPass(context: ScenegraphRenderer, modelView: Stack<mat4>, lights: Array<LightInfo>, lightMap: Map<string, Array<LightInfo>>): void {
        if (this.meshName.length > 0) {

            // Loop through all the lights in the leaf node
            if(lightMap.has(this.name))
            {
                console.log("node: " + this.name);

                for (let i = 0; i < lightMap.get(this.name).length; i++) {
                    console.log("pos_before" + i + ": " + (lightMap.get(this.name))[i].light.getPosition());
    
                    let l: LightInfo = new LightInfo(lightMap.get(this.name)[i].light, lightMap.get(this.name)[i].coordinateSystem);
                    let result: vec4 = vec4.create();
                    vec4.transformMat4(result, lightMap.get(this.name)[i].light.getPosition(), modelView.peek());
                    l.light.setPosition(result);
                    // multiply the lights' direction with modelView 
                    result = vec4.create();
                    vec4.transformMat4(result, lightMap.get(this.name)[i].light.getSpotDirection(), modelView.peek());
                    l.light.setSpotDirection(result);
    
                    // Add those lights in view coordinates to the lights array                
                    lights.push(l);
                }
            }
        }
    }

    private setLight(ambient: vec3, diffuse: vec3, specular: vec3, position: vec3): void{
        let l: Light = new Light();
        l.setAmbient(ambient);
        l.setDiffuse(diffuse);
        l.setSpecular(specular);
        l.setPosition(position);
        this.lights.push(new LightInfo(l, LightCoordinateSystem.Object));
    }

    public addLight(l: Light)
    {
        this.lights.push(new LightInfo(l, LightCoordinateSystem.Object));
    }

}
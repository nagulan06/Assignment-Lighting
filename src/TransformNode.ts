import { SGNode } from "./SGNode"
import { mat4, vec3, vec4 } from "gl-matrix";
import { Scenegraph } from "./Scenegraph";
import { Stack } from "%COMMON/Stack";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { IVertexData } from "%COMMON/IVertexData";
import { Light } from "./Light"

/**
 * This node represents a transformation in the scene graph. It has only one child. The 
 * transformation can be viewed as changing from its child's coordinate system to its parent's 
 * coordinate system. This also stores an animation transform that can be tweaked at runtime
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

export class TransformNode extends SGNode {
    /**
         * Matrices storing the static and animation transformations separately, so that they can be
         * changed separately
         */
    protected transform: mat4;
    protected animationTransform: mat4;

    /**
     * A reference to its only child
     */
    protected child: SGNode;

    public constructor(graph: Scenegraph<IVertexData>, name: string) {
        super(graph, name);
        this.transform = mat4.create();
        this.animationTransform = mat4.create();
        this.child = null;

        this.lights = new Array;
        this.lights = [];
    }


    /**
     * Creates a deep copy of the subtree rooted at this node
     * @return a deep copy of the subtree rooted at this node
     */
    public clone(): SGNode {
        let newchild: SGNode;

        if (this.child != null) {
            newchild = this.child.clone();
        }
        else {
            newchild = null;
        }

        let newtransform: TransformNode = new TransformNode(this.scenegraph, this.name);
        newtransform.setTransform(this.transform);
        newtransform.setAnimationTransform(this.animationTransform);

        if (newchild != null) {
            try {
                newtransform.addChild(newchild);
            }
            catch (e) {

            }
        }
        return newtransform;
    }

    /**
     * Determines if this node has the specified name and returns itself if so. Otherwise it recurses
     * into its only child
     * @param name name of node to be searched
     * @return
     */
    public getNode(name: string): SGNode {
        let n: SGNode = super.getNode(name);
        if (n != null)
            return n;

        if (this.child != null) {
            return this.child.getNode(name);
        }

        return null;
    }

    /**
     * Since this node can have a child, it override this method and adds the child to itself
     * This will overwrite any children set for this node previously.
     * @param child the child of this node
     * @throws IllegalArgumentException this method does not throw this exception
     */
    public addChild(child: SGNode): void {
        if (this.child != null)
            throw new Error("Transform node already has a child");
        this.child = child;
        this.child.setParent(this);
    }

    /**
     * Draws the scene graph rooted at this node
     * After preserving the current top of the modelview stack, this "post-multiplies" its
     * animation transform and then its transform in that order to the top of the model view
     * stack, and then recurses to its child. When the child is drawn, it restores the modelview
     * matrix
     * @param context the generic renderer context {@link sgraph.IScenegraphRenderer}
     * @param modelView the stack of modelview matrices
     */

    public draw(context: ScenegraphRenderer, modelView: Stack<mat4>) {
        modelView.push(mat4.clone(modelView.peek()));
        mat4.multiply(modelView.peek(), modelView.peek(), this.animationTransform);
        mat4.multiply(modelView.peek(), modelView.peek(), this.transform);

        if(this.name == "topstem-transform")
        {
            //console.log("TFM: " + modelView.peek());
        }

        if (this.child != null)
            this.child.draw(context, modelView);
        modelView.pop();
    }

    public lightPass(context: ScenegraphRenderer, modelView: Stack<mat4>, lights: Array<LightInfo>, lightMap: Map<string, Array<LightInfo>>) {
        modelView.push(mat4.clone(modelView.peek()));
        mat4.multiply(modelView.peek(), modelView.peek(), this.animationTransform);
        mat4.multiply(modelView.peek(), modelView.peek(), this.transform);

        // Loop through all the lights in the transform nodes
        if(lightMap.has(this.name))
        {
            for (let i = 0; i < lightMap.get(this.name).length; i++) {
                let l: LightInfo = new LightInfo(lightMap.get(this.name)[i].light.clone(), lightMap.get(this.name)[i].coordinateSystem);
                //console.log("l_before"+ i + ": " + l.light.getPosition());
                let pos: vec4 = vec4.create();
                let dir: vec4 = vec4.create();
                vec4.transformMat4(pos, l.light.getPosition(), modelView.peek());
                //console.log("result: " + pos);
                l.light.setPosition([pos[0], pos[1], pos[2]]);
    
                //multiply the lights' direction with modelView 
                vec4.transformMat4(dir, l.light.getSpotDirection(), modelView.peek());
                l.light.setSpotDirection([dir[0], dir[1], dir[2]]);
                //l.light.setSpotDirection(result);

                // Add those lights in view coordinates to the lights array
                lights.push(l);
            }
        }

        if (this.child != null)
            this.child.lightPass(context, modelView, lights, lightMap);
        modelView.pop();
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


    /**
     * Sets the animation transform of this node
     * @param mat the animation transform of this node
     */
    public setAnimationTransform(mat: mat4): void {
        this.animationTransform = mat;
    }

    /**
     * Gets the transform at this node (not the animation transform)
     * @return
     */
    public getTransform(): mat4 {
        return this.transform;
    }

    /**
     * Sets the transformation of this node
     * @param t
     * @throws IllegalArgumentException
     */
    public setTransform(t: mat4): void {
        this.transform = mat4.clone(t);
    }

    /**
     * Gets the animation transform of this node
     * @return
     */
    public getAnimationTransform(): mat4 {
        return this.animationTransform;
    }

    /**
     * Sets the scene graph object of which this node is a part, and then recurses to its child
     * @param graph a reference to the scenegraph object of which this tree is a part
     */
    public setScenegraph(graph: Scenegraph<IVertexData>): void {
        super.setScenegraph(graph);
        if (this.child != null) {
            this.child.setScenegraph(graph);
        }
    }
}
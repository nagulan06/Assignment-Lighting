import { SGNode } from "./SGNode"
import { mat4 } from "gl-matrix";
import { Scenegraph } from "./Scenegraph";
import { Stack } from "%COMMON/Stack";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { IVertexData } from "%COMMON/IVertexData";

/**
 * This node represents a transformation in the scene graph. It has only one child. The 
 * transformation can be viewed as changing from its child's coordinate system to its parent's 
 * coordinate system. This also stores an animation transform that can be tweaked at runtime
 * @author Amit Shesh
 */
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

        if (this.child != null)
            this.child.draw(context, modelView);
        modelView.pop();
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
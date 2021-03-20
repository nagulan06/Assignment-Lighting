import { SGNode } from "SGNode"
import { IVertexData } from "%COMMON/IVertexData";
import { Mesh } from "%COMMON/PolygonMesh";
import { ScenegraphRenderer } from "ScenegraphRenderer";
import { mat4, glMatrix, vec3 } from "gl-matrix";
import { Stack } from "%COMMON/Stack";

/**
 * A specific implementation of this scene graph. This implementation is still independent
 * of the rendering technology (i.e. WebGL)
 * @author Amit Shesh
 */

export class Scenegraph<VertexType extends IVertexData> {
    /**
     * The root of the scene graph tree
     */
    protected root: SGNode;

    /**
     * A map to store the (name,mesh) pairs. A map is chosen for efficient search
     */
    protected meshes: Map<string, Mesh.PolygonMesh<VertexType>>;

    /**
     * A map to store the (name,node) pairs. A map is chosen for efficient search
     */
    protected nodes: Map<string, SGNode>;

    protected textures: Map<string, string>;

    /**
     * The associated renderer for this scene graph. This must be set before attempting to
     * render the scene graph
     */
    protected renderer: ScenegraphRenderer;


    public constructor() {
        this.root = null;
        this.meshes = new Map<string, Mesh.PolygonMesh<VertexType>>();
        this.nodes = new Map<string, SGNode>();
        this.textures = new Map<string, string>();
    }

    public dispose(): void {
        this.renderer.dispose();
    }

    /**
     * Sets the renderer, and then adds all the meshes to the renderer.
     * This function must be called when the scene graph is complete, otherwise not all of its
     * meshes will be known to the renderer
     * @param renderer The {@link ScenegraphRenderer} object that will act as its renderer
     * @throws Exception
     */
    public setRenderer(renderer: ScenegraphRenderer): void {
        this.renderer = renderer;

        //now add all the meshes
        for (let [meshName, mesh] of this.meshes) {
            this.renderer.addMesh(meshName, mesh);
        }

    }


    /**
     * Set the root of the scenegraph, and then pass a reference to this scene graph object
     * to all its node. This will enable any node to call functions of its associated scene graph
     * @param root
     */
    public makeScenegraph(root: SGNode): void {
        this.root = root;
        this.root.setScenegraph(this);
    }

    /**
     * Draw this scene graph. It delegates this operation to the renderer
     * @param modelView
     */
    public draw(modelView: Stack<mat4>): void {
        if ((this.root != null) && (this.renderer != null)) {
            this.renderer.draw(this.root, modelView);
        }
    }

    public addPolygonMesh(meshName: string, mesh: Mesh.PolygonMesh<VertexType>): void {
        this.meshes.set(meshName, mesh);
    }


    public animate(time: number): void {
    }

    public addNode(nodeName: string, node: SGNode): void {
        this.nodes.set(nodeName, node);
    }

    public getRoot(): SGNode {
        return this.root;
    }

    public getPolygonMeshes(): Map<string, Mesh.PolygonMesh<VertexType>> {
        return this.meshes;
    }

    public getNodes(): Map<string, SGNode> {
        return this.nodes;
    }

    public addTexture(textureName: string, path: string): void {
        this.textures.set(textureName, path);
    }
}
import { IVertexData, VertexProducer } from "%COMMON/IVertexData";
import { Scenegraph } from "./Scenegraph";
import { GroupNode } from "./GroupNode";
import { ObjImporter } from "%COMMON/ObjImporter";
import { Mesh } from "%COMMON/PolygonMesh";
import { SGNode } from "./SGNode";
import { TransformNode } from "./TransformNode";
import { mat4, vec3, glMatrix } from "gl-matrix";
import { LeafNode } from "./LeafNode";
import { Material } from "%COMMON/Material";

export namespace ScenegraphJSONImporter {

    /**
     * This function parses a scenegraph specified in JSON format, and produces a scene graph
     * @param producer the vertex producer to load all the meshes used in the scene graph
     * @param contents the JSON string
     * @return a promise of a scene graph. The caller waits for the promise
     */
    export function importJSON<VertexType extends IVertexData>
        (producer: VertexProducer<VertexType>, contents: string): Promise<Scenegraph<VertexType>> {
        return new Promise<Scenegraph<VertexType>>((resolve, reject) => {
            let jsonTree: Object = JSON.parse(contents);
            let scenegraph = new Scenegraph<VertexType>();
            let root: SGNode;
            let scaleInstances: boolean = true;

            if (!("instances" in jsonTree)) {
                throw new Error("No meshes in the scene graph!");
            }
            if ("scaleinstances" in jsonTree) {
                if (jsonTree["scaleinstances"] == "false")
                    scaleInstances = false;
            }
            handleInstances(scenegraph, jsonTree["instances"], scaleInstances, producer)
                .then((scenegraph: Scenegraph<VertexType>) => {
                    if (!("root" in jsonTree)) {
                        throw new Error("No root in the scene graph!");
                    }

                    root = handleNode(scenegraph, jsonTree["root"]);

                    scenegraph.makeScenegraph(root);

                    resolve(scenegraph);
                });

        });

    }

    export function handleNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: Object): SGNode {
        let result: SGNode = null;
        if (!("type" in obj)) {
            throw new Error("No type of node!");
        }

        if ("name" in obj) {
            console.log("Processing: " + obj["name"]);
        }
        switch (obj["type"]) {
            case "transform":
                result = handleTransformNode(scenegraph, obj);
                break;
            case "group":
                result = handleGroupNode(scenegraph, obj);
                break;
            case "object":
                result = handleLeafNode(scenegraph, obj);
                break;
            default:
                throw new Error("Unknown node type");

        }
        return result;
    }


    export function handleTransformNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: Object): SGNode {
        let result: TransformNode;
        let nodeName: string = "t";
        let transform: mat4 = mat4.create();

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        result = new TransformNode(scenegraph, nodeName);

        if (!("child" in obj)) {
            throw new Error("No child for a transform node");
        }

        if (!("transform" in obj)) {
            throw new Error("No transform property for a transform node");
        }

        for (let op of (Object)(obj["transform"])) {
            if ("translate" in op) {
                let values: number[] = convertToArray(op["translate"]);
                if (values.length != 3) {
                    throw new Error("3 values needed for translate")
                }
                let translateBy: vec3 = vec3.fromValues(values[0], values[1], values[2]);
                mat4.translate(transform, transform, translateBy);
            }
            else if ("scale" in op) {
                let values: number[] = convertToArray(op["scale"]);
                if (values.length != 3) {
                    throw new Error("3 values needed for scale")
                }
                console.log(values);
                let scaleBy: vec3 = vec3.fromValues(values[0], values[1], values[2]);
                mat4.scale(transform, transform, scaleBy);
            }
            else if ("rotate" in op) {
                let values: number[] = convertToArray(op["rotate"]);
                if (values.length != 4) {
                    throw new Error("4 values needed for rotate")
                }
                let rotateAngle: number = values[0];
                let rotateAxis: vec3 = vec3.fromValues(values[1], values[2], values[3]);
                mat4.rotate(transform, transform, glMatrix.toRadian(rotateAngle), rotateAxis);
            }
        }
        result.addChild(handleNode(scenegraph, obj["child"]));
        result.setTransform(transform);
        return result;
    }

    export function convertToArray(obj: Object): number[] {
        let result: number[] = [];
        for (let n in obj) {
            result.push(parseFloat(obj[n]));
        }
        return result;
    }

    export function handleGroupNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: Object): SGNode {
        let result: GroupNode;
        let nodeName: string = "g";

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        result = new GroupNode(scenegraph, nodeName);
        for (let child of obj["children"]) {
            let node: SGNode = handleNode(scenegraph, child);
            result.addChild(node);
        }
        return result;
    }

    export function handleLeafNode<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: Object): SGNode {
        let result: LeafNode;


        let nodeName: string = "g";

        if ("name" in obj) {
            nodeName = obj["name"];
        }
        let material: Material = new Material(); //all black by default
        result = new LeafNode(obj["instanceof"], scenegraph, nodeName);

        if ("material" in obj) {
            if ("color" in obj["material"]) {
                material.setAmbient([obj["material"]["color"][0], obj["material"]["color"][1], obj["material"]["color"][2]]);
            }
            result.setMaterial(material);
        }
        return result;
    }

    export function handleInstances<VertexType extends IVertexData>(scenegraph: Scenegraph<VertexType>, obj: Object, scaleAndCenter: boolean, producer: VertexProducer<VertexType>): Promise<Scenegraph<VertexType>> {
        return new Promise<Scenegraph<VertexType>>((resolve) => {
            let nameUrls: Map<string, string> = new Map<string, string>();
            for (let n of Object.keys(obj)) {
                let path: string = obj[n]["path"];
                nameUrls.set(obj[n]["name"], path);
            }

            //import them
            ObjImporter.batchDownloadMesh(nameUrls, producer, scaleAndCenter)
                .then((meshMap: Map<string, Mesh.PolygonMesh<VertexType>>) => {
                    for (let [n, mesh] of meshMap) {
                        scenegraph.addPolygonMesh(n, mesh);
                    }
                    resolve(scenegraph);
                });
        });
    }
}
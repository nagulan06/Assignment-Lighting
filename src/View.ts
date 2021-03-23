import { vec4, mat4, vec3, glMatrix } from "gl-matrix";
import * as WebGLUtils from "%COMMON/WebGLUtils";
import { Features } from "./Controller";
import { Stack } from "%COMMON/Stack"
import { Light } from "%COMMON/Light"
import { Scenegraph } from "./Scenegraph";
import { VertexPNT, VertexPNTProducer } from "./VertexPNT";
import { ShaderLocationsVault } from "%COMMON/ShaderLocationsVault";
import { ScenegraphRenderer } from "./ScenegraphRenderer";
import { Mesh } from "%COMMON/PolygonMesh";
import { ObjImporter } from "%COMMON/ObjImporter"
import { ScenegraphJSONImporter } from "./ScenegraphJSONImporter"
import { LeafNode } from "./LeafNode";
import { TransformNode } from "./TransformNode";
import { SGNode } from "SGNode";
import { Material } from "%COMMON/Material";
import { GroupNode } from "./GroupNode";
import { CameraMode } from "./Controller"


enum LightCoordinateSystem { View, World, Object };

class LightInfo {
    light: Light;
    coordinateSystem: LightCoordinateSystem;

    constructor(light: Light, coordinateSystem: LightCoordinateSystem) {
        this.light = light;
        this.coordinateSystem = coordinateSystem;
    }
}

class LightLocation {
    ambient: WebGLUniformLocation;
    diffuse: WebGLUniformLocation;
    specular: WebGLUniformLocation;
    position: WebGLUniformLocation;

}

class MaterialLocation {
    ambient: WebGLUniformLocation;
    diffuse: WebGLUniformLocation;
    specular: WebGLUniformLocation;
    shininess: WebGLUniformLocation;
}

/**
 * This class encapsulates the "view", where all of our WebGL code resides. This class, for now, also stores all the relevant data that is used to draw. This can be replaced with a more formal Model-View-Controller architecture with a bigger application.
 */


export class View {
    //the webgl rendering context. All WebGL functions will be called on this object
    private gl: WebGLRenderingContext;
    //an object that represents a WebGL shader
    private shaderProgram: WebGLProgram;

    //a projection matrix, that encapsulates how what we draw corresponds to what is seen
    private proj: mat4;

    //a modelview matrix, that encapsulates all the transformations applied to our object
    private modelview: Stack<mat4>;

    private scenegraph: Scenegraph<VertexPNT>;
    private shaderLocations: ShaderLocationsVault;
    private shaderVarsToAttributes: Map<string, string>;

    private time: number;
    private movement: number;
    private bvh: boolean;
    private sceneNode: GroupNode;

    private transformsHeli: Array<TransformNode>;
    private transformsHouse: Array<TransformNode>;

    private allGroups: Map<String, TransformNode>;

    private cameraMode: CameraMode;
    private cameraPos: vec4;
    private cameraMove: mat4;

    // Lights
    public lights: Array<LightInfo>;

    // colors
    private door: vec3 ;
    private wood: vec3 ;
    private stone: vec3;
    private darkStone: vec3;
    private slate: vec3 ;
    private glass: vec3 ;
    private grill: vec3; 
    private roof: vec3;
    private leaves: vec3;

    public node: TransformNode;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.movement = 0;
        this.time = 0;
        this.modelview = new Stack<mat4>();
        this.scenegraph = null;
        //set the clear color
        this.gl.clearColor(0.0, 0.0, 0.0, 1);
        
        // Setup the camera
        this.cameraMode = CameraMode.Global;
        this.cameraPos = vec4.fromValues(0,0,0,0);
        this.cameraMove = mat4.create();

        this.transformsHouse = new Array(0);
        this.transformsHeli = new Array(0);
        this.sceneNode = new GroupNode(this.scenegraph, "scene");

        this.allGroups = new Map();

        // Lights
        this.lights = new Array;

        // Bounding Boxes
        this.bvh = false;

        //Our quad is in the range (-100,100) in X and Y, in the "virtual world" that we are drawing. We must specify what part of this virtual world must be drawn. We do this via a projection matrix, set up as below. In this case, we are going to render the part of the virtual world that is inside a square from (-200,-200) to (200,200). Since we are drawing only 2D, the last two arguments are not useful. The default Z-value chosen is 0, which means we only specify the last two numbers such that 0 is within their range (in this case we have specified them as (-100,100))
        //this.proj = mat4.ortho(mat4.create(), -1000, 1000, -1000, 1000, -1000, 1000);
        this.proj = mat4.perspective(mat4.create(), glMatrix.toRadian(60), 1, 0.1, 10000);

        //We must also specify "where" the above part of the virtual world will be shown on the actual canvas on screen. This part of the screen where the above drawing gets pasted is called the "viewport", which we set here. The origin of the viewport is left,bottom. In this case we want it to span the entire canvas, so we start at (0,0) with a width and height of 400 each (matching the dimensions of the canvas specified in HTML)
        this.gl.viewport(0, 0, 800, 800);


        // init colors
        this.door = vec3.fromValues(0.1,0.1,0.1);
        this.wood = vec3.fromValues(0.59,0.29,0);
        this.stone = vec3.fromValues(0.75,0.75,0.75);
        this.darkStone = vec3.fromValues(0.65,0.65,0.65);
        this.slate = vec3.fromValues(0.35,0.35,0.35);
        this.glass = vec3.fromValues(0.85,1,1);
        this.grill = vec3.fromValues(0.5,0.5,0.95);
        this.roof = vec3.fromValues(0.75,0.65,0.75);
        this.leaves = vec3.fromValues(0.098, 0.345, 0.133);


    }

    /*private initLights(): void {
        let l: Light = new Light();
        l.setAmbient([1, 1, 1]);
        l.setDiffuse([0, 0, 0]);
        l.setSpecular([0, 0, 0]);
        l.setPosition([0, 0, 0]);
        this.lights.push(new LightInfo(l, LightCoordinateSystem.World));
    }*/

    private setLight(ambient: vec3, diffuse: vec3, specular: vec3, position: vec3): void{
        let l: Light = new Light();
        l.setAmbient(ambient);
        l.setDiffuse(diffuse);
        l.setSpecular(specular);
        l.setPosition(position);
        this.lights.push(new LightInfo(l, LightCoordinateSystem.View));
    }

    public initShaders(vShaderSource: string, fShaderSource: string) {
        console.log("Shaders");
        //create and set up the shader
        this.shaderProgram = WebGLUtils.createShaderProgram(this.gl, vShaderSource, fShaderSource);
        //enable the current program
        this.gl.useProgram(this.shaderProgram);

        this.shaderLocations = new ShaderLocationsVault(this.gl, this.shaderProgram);
        this.shaderVarsToAttributes = new Map<string, string>();
        this.shaderVarsToAttributes.set("vPosition", "position");
        this.shaderVarsToAttributes.set("vNormal", "normal");
        //this.shaderVarsToAttributes.set("vTexCoord", "texcoord");

    }


    // Easy way to have constant tranformation nodes
    public createSpheres(
        scale = vec3.fromValues(0,0,0), 
        rotate = 0, 
        axis = vec3.fromValues(0,0,0), 
        translate = vec3.fromValues(0,0,0),
        ambient = vec3.fromValues(0,0,0),
        diffuse = vec3.fromValues(0,0,0),
        specular = vec3.fromValues(0,0,0),
        shininess = 0,
        transformName: string,
        nodeName: string): TransformNode
    {
        let transformNode: TransformNode = new TransformNode(this.scenegraph, transformName);
        let transform: mat4 = mat4.create();
        mat4.translate(transform, transform, translate);
        mat4.rotate(transform, transform, glMatrix.toRadian(rotate), axis);
        mat4.scale(transform, transform, scale);
        transformNode.setTransform(transform);
        let child: LeafNode = new LeafNode("sphere", this.scenegraph, nodeName);
        let mat: Material = new Material();
        mat.setAmbient(ambient);
        mat.setDiffuse(diffuse);
        mat.setSpecular(specular);
        mat.setShininess(shininess);

        child.setMaterial(mat);
        transformNode.addChild(child);

        return transformNode;
    }



    // Easy way to have constant tranformation nodes
    public createTransformNodes(
        scale = vec3.fromValues(0,0,0), 
        rotate = 0, 
        axis = vec3.fromValues(0,0,0), 
        translate = vec3.fromValues(0,0,0),
        transformName: string,
        nodeName: string,
        ambient = vec3.fromValues(0,0,0),
        diffuse = vec3.fromValues(0,0,0),
        specular = vec3.fromValues(0,0,0),
        shininess = 0
        ): TransformNode
        
    {
        let transformNode: TransformNode = new TransformNode(this.scenegraph, transformName);
        let transform: mat4 = mat4.create();
        mat4.translate(transform, transform, translate);
        mat4.rotate(transform, transform, glMatrix.toRadian(rotate), axis);
        mat4.scale(transform, transform, scale);
        transformNode.setTransform(transform);
        let child: LeafNode = new LeafNode("box", this.scenegraph, nodeName);
        let mat: Material = new Material();
        mat.setAmbient(ambient);
        mat.setDiffuse(diffuse);
        mat.setSpecular(specular);
        mat.setShininess(shininess);

        //this.setLight([1, 1, 1], [0,0,0],[0,0,0], translate);
        child.setMaterial(mat);
        transformNode.addChild(child);

        return transformNode;
    }

    // Leaves of the tree
    public createLeaves(): GroupNode
    {
        let leavesNode: GroupNode = new GroupNode(this.scenegraph, "leaves");

        for(let i: number = -5; i <= 5; i += 1)
        {
            let transformNode: TransformNode = this.createTransformNodes(vec3.fromValues(5, 100, 15), 25 * i, vec3.fromValues(0,0,1), vec3.fromValues(-300, 110, 180), "treeLeaves-transform", "treeLeaves-Node", this.leaves, [1, 1, 1], [0.1, 0.1, 0.1], 100);
            leavesNode.addChild(transformNode);
            this.transformsHouse.push(transformNode);
        }

        return leavesNode;
    }

    
    public createTree() : GroupNode{
        let treeNode: GroupNode = new GroupNode(this.scenegraph, "tree");
        let leavesNode: GroupNode = new GroupNode(this.scenegraph, "leaves");

        let treeWood: TransformNode = this.createTransformNodes(vec3.fromValues(25, 160, 10), 0, vec3.fromValues(0,0,0), vec3.fromValues(-300, 25, 178), "treeWood-transform", "treeWood-Node", this.wood, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        this.transformsHouse.push(treeWood);
        treeNode.addChild(treeWood);
        leavesNode = this.createLeaves();
        treeNode.addChild(leavesNode);

        return treeNode;
    }

    public front(): GroupNode
    {
        let front: GroupNode = new GroupNode(this.scenegraph, "front");

        let frontWall: TransformNode = this.createTransformNodes(vec3.fromValues(60, 100, 200), 0, vec3.fromValues(0,0,0), vec3.fromValues(0,0,100), "frontWall-transform", "frontWall-Node", this.darkStone, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        front.addChild(frontWall);
        this.transformsHouse.push(frontWall);
        
        let frontDoor: TransformNode = this.createTransformNodes(vec3.fromValues(40, 80, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(0,-5, 200), "frontDoor-transform", "frontDoor-Node", this.door, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], 10);
        front.addChild(frontDoor);
        this.transformsHouse.push(frontDoor);

        return front;
    }

    public living(): GroupNode
    {
        let living: GroupNode = new GroupNode(this.scenegraph, "living");

        let wall: TransformNode = this.createTransformNodes(vec3.fromValues(200, 100, 200), 0, vec3.fromValues(0,0,0), vec3.fromValues(-130,0,100), "frontWall-transform", "frontWall-Node", this.darkStone, [1, 1, 1], [0.5, 0.5, 0.5], 100);
        let wood: TransformNode = this.createTransformNodes(vec3.fromValues(40, 80, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-50,-5, 200), "frontWood-transform", "frontWood-Node", this.wood, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        let glass: TransformNode = this.createTransformNodes(vec3.fromValues(100, 80, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-122,-5, 200), "frontGlass-transform", "frontGlass-Node", this.glass, [0.1, 0.1, 0.1], [0.5, 0.5, 0.5], 100);

        living.addChild(wall);
        living.addChild(wood);
        living.addChild(glass);
        this.transformsHouse.push(wall);
        this.transformsHouse.push(wood);
        this.transformsHouse.push(glass);

        return living;
    }

    public garage(): GroupNode
    {
        let garage: GroupNode = new GroupNode(this.scenegraph, "garage");
        //Garage Wall
        let wall: TransformNode = this.createTransformNodes(vec3.fromValues(200, 100, 180), 0, vec3.fromValues(0,0,0), vec3.fromValues(130,0,88), "garageWall-transform", "garageWall-node", this.stone, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        garage.addChild(wall);
        this.transformsHouse.push(wall);

        // Grills on Garage door
        for(let i: number = -2; i < 3; i += 1)
        {
            let grill: TransformNode = this.createTransformNodes(vec3.fromValues(5, 80, 2), 0, vec3.fromValues(0,0,1), vec3.fromValues(130 + (30*i), -5, 179), "garageGrill-transform", "garageGrill-node", this.grill, [0.4, 0.4, 0.4], [1, 1, 1], 10);
            garage.addChild(grill);
            this.transformsHouse.push(grill);
        }

        //Garage door
        let door: TransformNode = this.createTransformNodes(vec3.fromValues(160, 80, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(130,-5,178), "garageDoor-transform", "garageDoor-node", this.wood, [1, 1, 1], [0.5, 0.5, 0.5], 100);
        garage.addChild(door);
        this.transformsHouse.push(door);

        return garage;
    }

    public connectors(): GroupNode
    {
        let connectors: GroupNode = new GroupNode(this.scenegraph, "connectors");
        //connector HZ
        let HZ: TransformNode = this.createTransformNodes(vec3.fromValues(250, 20, 20), 0, vec3.fromValues(0,0,0), vec3.fromValues(-100,50, 210), "connectorHZ-transform", "connectorHZ-node", this.slate, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        let VT: TransformNode = this.createTransformNodes(vec3.fromValues(120, 30, 220), 90, vec3.fromValues(0,0,1), vec3.fromValues(35,100, 110), "connectorVT-transform", "connectorVT-node", this.slate, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        this.transformsHouse.push(HZ);
        this.transformsHouse.push(VT);
        connectors.addChild(HZ);
        connectors.addChild(VT);

        return connectors;
    }

    public firstFloor(): GroupNode{

        let firstFloor: GroupNode = new GroupNode(this.scenegraph, "firstFloor");

        let front: GroupNode = this.front();
        let living: GroupNode = this.living();
        let garage: GroupNode = this.garage();
        let connectors: GroupNode = this.connectors();
        firstFloor.addChild(front);
        firstFloor.addChild(living);
        firstFloor.addChild(garage);
        firstFloor.addChild(connectors);

        return firstFloor;
    }

    public createRoom1(): GroupNode
    {
        let room1: GroupNode = new GroupNode(this.scenegraph, "room1");

        let wall: TransformNode = this.createTransformNodes(vec3.fromValues(237, 93, 200), 0, vec3.fromValues(0,0,0), vec3.fromValues(-97,97,100), "roomWall1-transform", "roomWall1-node", this.wood, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        let window: TransformNode = this.createTransformNodes(vec3.fromValues(100, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-122,110, 200), "roomWindow1-transform", "roomWindow1-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);
        let back: TransformNode = this.createTransformNodes(vec3.fromValues(150, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-122,100, 0), "backWindow1-transform", "backWindow1-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);
        this.transformsHouse.push(wall);
        this.transformsHouse.push(window);
        this.transformsHouse.push(back);

        room1.addChild(wall);
        room1.addChild(window);
        room1.addChild(back);

        return room1;
    }

    public createRoom2(): GroupNode
    {
        let room2: GroupNode = new GroupNode(this.scenegraph, "room2");

        let wall: TransformNode = this.createTransformNodes(vec3.fromValues(100, 110, 160), 0, vec3.fromValues(0,0,0), vec3.fromValues(100,105,80), "roomWall2-transform", "roomWall2-node", this.wood, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        let window: TransformNode = this.createTransformNodes(vec3.fromValues(50, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(100,97, 160), "roomWindow2-transform", "roomWindow2-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);
        let back: TransformNode = this.createTransformNodes(vec3.fromValues(50, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(100,97, 0), "backWindow2-transform", "backWindow2-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);

        this.transformsHouse.push(wall);
        this.transformsHouse.push(window);
        this.transformsHouse.push(back);

        room2.addChild(wall);
        room2.addChild(window);
        room2.addChild(back);

        return room2;
    }

    public bedRooms(): GroupNode
    {
        let bedRooms: GroupNode = new GroupNode(this.scenegraph, "bedRooms");

        let room1: GroupNode = this.createRoom1();
        let room2: GroupNode = this.createRoom2();
        let aisleWindow: TransformNode = this.createTransformNodes(vec3.fromValues(52, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-12,110, 200), "aisleWindow-transform", "aisleWindow-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);
        this.transformsHouse.push(aisleWindow);
        
        bedRooms.addChild(room1);
        bedRooms.addChild(room2);
        bedRooms.addChild(aisleWindow);

        return bedRooms;
    }

    public secondFloor(): GroupNode
    {
        let secondFloor: GroupNode = new GroupNode(this.scenegraph, "secondFloor");

        let connectorHZ2: TransformNode = this.createTransformNodes(vec3.fromValues(250, 20, 20), 0, vec3.fromValues(0,0,0), vec3.fromValues(-90,152, 210), "connectorHZ2-transform", "connectorHZ2-node", this.slate, [1, 1, 1], [0.1, 0.1, 0.1], 100);
        let kitchenWindow: TransformNode = this.createTransformNodes(vec3.fromValues(200, 60, 2), 0, vec3.fromValues(0,0,0), vec3.fromValues(-100, 0, 0), "kitchenWindow-transform", "kitchenWindow-node", this.glass, [0.1, 0.1, 0.1], [1, 1, 1], 2);
        let bedRooms: GroupNode = this.bedRooms();

        this.transformsHouse.push(connectorHZ2);
        this.transformsHouse.push(kitchenWindow);

        secondFloor.addChild(connectorHZ2);
        secondFloor.addChild(bedRooms);
        secondFloor.addChild(kitchenWindow);

        return secondFloor;
    }

    public createRoof(): GroupNode
    {
        let roof: GroupNode = new GroupNode(this.scenegraph, "roof");

        let left: TransformNode = this.createTransformNodes(vec3.fromValues(250, 15, 220), 45, vec3.fromValues(0,0,1), vec3.fromValues(-118,250, 110), "roofLeft-transform", "roofLeft-node", this.roof, [0.5, 0, 0], [0.9, 0.9, 0.9], 100);
        let right: TransformNode = this.createTransformNodes(vec3.fromValues(250, 15, 220), -45, vec3.fromValues(0,0,1), vec3.fromValues(60, 250, 110), "roofRight-transform", "roofRgiht-node", this.roof, [0.5, 0, 0], [0.9, 0.9, 0.9], 100);

        this.transformsHouse.push(left);
        this.transformsHouse.push(right);

        roof.addChild(left);
        roof.addChild(right);

        return roof;
    }

    public House(): GroupNode
    {
        let houseNode: GroupNode = new GroupNode(this.scenegraph, "house");

        let firstFloor: GroupNode = this.firstFloor();     
        let secondFloor: GroupNode = this.secondFloor();     
        let roof: GroupNode = this.createRoof();

        houseNode.addChild(firstFloor);
        houseNode.addChild(secondFloor);
        houseNode.addChild(roof);


        return houseNode;
    }

    public initScenegraph(): void {

        //make scene graph programmatically
        let meshURLs: Map<string, string> = new Map<string, string>();
          meshURLs.set("box", "models/box.obj");
          meshURLs.set("cylinder", "models/cylinder.obj");
          meshURLs.set("cone", "models/cone.obj");
          meshURLs.set("sphere", "models/sphere.obj");
          meshURLs.set("aeroplane", "models/aeroplane.obj");
          meshURLs.set("sphere", "models/sphere.obj");
          ObjImporter.batchDownloadMesh(meshURLs, new VertexPNTProducer()).then((meshMap: Map<string, Mesh.PolygonMesh<VertexPNT>>) => {

            this.scenegraph = new Scenegraph<VertexPNT>();
            this.scenegraph.addPolygonMesh("box", meshMap.get("box"));
            
            let treeNode: GroupNode = this.createTree();    
            let houseNode: GroupNode = this.House(); 

            this.scenegraph.addPolygonMesh("box", meshMap.get("box"));
            this.scenegraph.addPolygonMesh("cylinder", meshMap.get("cylinder"));
            this.scenegraph.addPolygonMesh("sphere", meshMap.get("sphere"));
            this.scenegraph.addPolygonMesh("cone", meshMap.get("cone"));
            this.scenegraph.addPolygonMesh("boxwire", meshMap.get("box").convertToWireframe());

            this.sceneNode.addChild(treeNode);               
            this.sceneNode.addChild(houseNode);              
                
                 
            //let Heli: GroupNode = new GroupNode(this.scenegraph, "heli");
            let Heli: TransformNode = new TransformNode(this.scenegraph, "heli");
            Heli = this.placeHeli(this.helicopter());

            this.sceneNode.addChild(Heli);

            this.sceneNode.addChild(this.sceneBox());

            //spheres
            let spheres: GroupNode = new GroupNode(this.scenegraph, "shperes");
            let sphere1: TransformNode = this.createSpheres([50, 50, 50], 0, [0,0,1], [20, 0, 0], [0.5, 0, 0], [0.7, 0, 0], [0.7, 0, 0], 100,"sphere_1_trans", "sphere_1_node");
            let sphere2: TransformNode = this.createSpheres([50, 50, 50], 0, [0,0,1], [80, 0, 0], [0.5, 0.5, 0.5], [0.7, 0.7, 0.7], [0.7, 0.7, 0.7], 1,"sphere_2_trans", "sphere_2_node");
            spheres.addChild(sphere1);
            spheres.addChild(sphere2);
            //this.sceneNode.addChild(spheres);

            this.scenegraph.makeScenegraph(this.sceneNode);

            let shaderVarsToVertexAttribs: Map<string, string> = new Map<string, string>();
            shaderVarsToVertexAttribs.set("vPosition", "position");
            shaderVarsToVertexAttribs.set("vNormal", "normal");
            let renderer: ScenegraphRenderer = new ScenegraphRenderer(this.gl, this.shaderLocations, shaderVarsToVertexAttribs);

            this.scenegraph.setRenderer(renderer);
          }); 

    }

    private helicopter(): GroupNode{
        let groupNode: GroupNode = new GroupNode(this.scenegraph, "heli");
        
        // Cylinder Body
        let Body: TransformNode = new TransformNode(this.scenegraph, "cylinder-transform");
        let child: LeafNode = new LeafNode("cylinder", this.scenegraph, "bodynode");
        let mat: Material = new Material();
        let transform: mat4 = mat4.create();
        mat4.rotate(transform, transform, glMatrix.toRadian(90), vec3.fromValues(0, 0, 1));
        mat4.scale(transform, transform, vec3.fromValues(100, 200, 100));
        Body.setTransform(transform);
        this.transformsHeli.push(Body);
        mat.setAmbient(vec3.fromValues(1, 0, 0));
        child.setMaterial(mat);
        Body.addChild(child);
        //groupNode.addChild(this.getBVH(Body));
        groupNode.addChild(Body);

        // Sphere Front
        let Front = new TransformNode(this.scenegraph, "sphere-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(65,0,0));
        mat4.scale(transform, transform, vec3.fromValues(100, 100, 100));
        Front.setTransform(transform);
        child = new LeafNode("sphere", this.scenegraph, "spherenode");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 1, 0));
        child.setMaterial(mat);
        Front.addChild(child);
        this.transformsHeli.push(Front);
        //groupNode.addChild(this.getBVH(Front));
        groupNode.addChild(Front);

        

        // Back Cone
        let Back = new TransformNode(this.scenegraph, "cone-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(-85,0,0));
        mat4.rotate(transform, transform, glMatrix.toRadian(90), vec3.fromValues(0, 0, 1));
        mat4.scale(transform, transform, vec3.fromValues(100, 150, 100));
        Back.setTransform(transform);
        child = new LeafNode("cone", this.scenegraph, "conenode");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 1, 0));
        child.setMaterial(mat);
        Back.addChild(child);
        this.transformsHeli.push(Back);
        //groupNode.addChild(this.getBVH(Back));
        groupNode.addChild(Back);


        // Back Tail box
        let BackTail = new TransformNode(this.scenegraph, "boxtail-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(-115,35,0));
        mat4.scale(transform, transform, vec3.fromValues(10, 60, 10));
        BackTail.setTransform(transform);
        child = new LeafNode("box", this.scenegraph, "boxtailnode");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(0, 0, 1));
        child.setMaterial(mat);
        BackTail.addChild(child);
        this.transformsHeli.push(BackTail);
        //groupNode.addChild(this.getBVH(BackTail));
        groupNode.addChild(BackTail);

        // Back Prop box
        let BackPropeller: GroupNode = new GroupNode(this.scenegraph, "propeller");
        for(let i=0;i<4;i++)
        {
            let BackProp = new TransformNode(this.scenegraph, "boxprop-transform");
            transform = mat4.create();
            mat4.translate(transform, transform, vec3.fromValues(-115,65,10));
            mat4.rotate(transform, transform, glMatrix.toRadian(90*i), vec3.fromValues(0, 0, 1));
            mat4.scale(transform, transform, vec3.fromValues(5, 50, 5));
            BackProp.setTransform(transform);
            this.allGroups.set("BackProp"+i , BackProp);
            child = new LeafNode("box", this.scenegraph, "boxpropnode");
            mat = new Material();
            mat.setAmbient(vec3.fromValues(1, 0, 1));
            child.setMaterial(mat);
            BackProp.addChild(child);
            this.transformsHeli.push(BackProp);
            //BackPropeller.addChild(this.getBVH(BackProp));
            BackPropeller.addChild(BackProp);
        }

        groupNode.addChild(BackPropeller);


        // Top stem box
        let TopStem = new TransformNode(this.scenegraph, "topstem-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(0,50,0));
        mat4.scale(transform, transform, vec3.fromValues(5, 30, 5));
        TopStem.setTransform(transform);
        child = new LeafNode("box", this.scenegraph, "topstemnode");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(0, 0, 1));
        child.setMaterial(mat);
        TopStem.addChild(child);
        this.transformsHeli.push(TopStem);
        //groupNode.addChild(this.getBVH(TopStem));
        groupNode.addChild(TopStem);


        let l: Light = new Light();
        l.setAmbient([0.5, 0.5, 0.5]);
        l.setDiffuse([0.5, 0.5, 0.5]);
        l.setSpecular([0.5, 0.5, 0.5]);
        l.setPosition([1, 1, 1, 1]);
        //TopStem.lights
        this.scenegraph.addLight("topstem-transform", l);

        // Top Prop box
        let TopPropeller: GroupNode = new GroupNode(this.scenegraph, "propeller");
        for(let i=0;i<4;i++)
        {
            let TopProp = new TransformNode(this.scenegraph, "topprop-transform");
            transform = mat4.create();
            mat4.translate(transform, transform, vec3.fromValues(5,70,0));
            mat4.rotate(transform, transform, glMatrix.toRadian(90*i), vec3.fromValues(0, 1, 0));
            mat4.scale(transform, transform, vec3.fromValues(150, 5, 5));
            TopProp.setTransform(transform);
            this.allGroups.set("TopProp"+i , TopProp);
            child = new LeafNode("box", this.scenegraph, "toppropnode");
            mat = new Material();
            mat.setAmbient(vec3.fromValues(1, 0, 1));
            child.setMaterial(mat);
            TopProp.addChild(child);
            this.transformsHeli.push(TopProp);
            //TopPropeller.addChild(this.getBVH(TopProp));
            TopPropeller.addChild(TopProp);
        }

        groupNode.addChild(TopPropeller);        

        return groupNode;
        
    }

    // Create the Bouding boxes for all the objects
    private drawBVH():GroupNode{
        let boxes: GroupNode = new GroupNode(this.scenegraph, "Bounding Boxes");
        let HeliBoxes: GroupNode = new GroupNode(this.scenegraph, "Heli Bounding Boxes");
        let HouseBoxes: GroupNode = new GroupNode(this.scenegraph, "House Bounding Boxes");
        if(this.bvh){
            for(let i=0;i<this.transformsHeli.length;i++){
                HeliBoxes.addChild(this.getBVH(this.transformsHeli[i]));
            }
            for(let i=0;i<this.transformsHouse.length;i++){
                HouseBoxes.addChild(this.getBVH(this.transformsHouse[i]));
             }
        }
        boxes.addChild(this.sceneBox());
        boxes.addChild(HouseBoxes);
        boxes.addChild(this.placeHeli(HeliBoxes));
        return boxes;
    }

    // Change it to Wireframe
    private getBVH(BBNode: TransformNode): TransformNode{
        let Bvh = new TransformNode(this.scenegraph, "BB-transform");
        Bvh.setTransform(BBNode.getTransform());
        let child = new LeafNode("boxwire", this.scenegraph, "bvhnode");
        let mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 1, 1));
        child.setMaterial(mat);
        Bvh.addChild(child);
        
        return Bvh;
    }

    // Translate the helicopter
    private placeHeli(heli: GroupNode): TransformNode {
        let offsetHeli: GroupNode = new GroupNode(this.scenegraph, "OffsetHeli");
        let moveHeli = new TransformNode(this.scenegraph, "topprop-transform");
        let transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(350,0,0));
        mat4.rotate(transform, transform, glMatrix.toRadian(90), vec3.fromValues(0, 1, 0));
        moveHeli.setTransform(transform);
        moveHeli.addChild(heli);
        this.allGroups.set("heli", moveHeli);
        offsetHeli.addChild(moveHeli);

        return moveHeli;

    }


    // Create the outer box for the scene
    private sceneBox(): GroupNode{
        
        let sceneBox: GroupNode = new GroupNode(this.scenegraph, "sceneBox");

        // Bottom floor
        let floor = new TransformNode(this.scenegraph, "floor-transform");
        let transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(0,-200,0));
        mat4.scale(transform, transform, vec3.fromValues(2000, 2, 2000));
        floor.setTransform(transform);
        let child = new LeafNode("boxwire", this.scenegraph, "floor");
        let mat = new Material();
        mat.setAmbient(vec3.fromValues(0, 0, 1));
        child.setMaterial(mat);
        floor.addChild(child);
        sceneBox.addChild(floor);

        // Back wall
        let back = new TransformNode(this.scenegraph, "back-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(0, 400, -1000));
        mat4.scale(transform, transform, vec3.fromValues(2000, 1200, 2));
        back.setTransform(transform);
        child = new LeafNode("boxwire", this.scenegraph, "back");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 0, 1));
        child.setMaterial(mat);
        back.addChild(child);
        sceneBox.addChild(back);

        // Front wall
        let front = new TransformNode(this.scenegraph, "front-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(0, 400, 1000));
        mat4.scale(transform, transform, vec3.fromValues(2000, 1200, 2));
        front.setTransform(transform);
        child = new LeafNode("boxwire", this.scenegraph, "front");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 1, 0));
        child.setMaterial(mat);
        front.addChild(child);
        sceneBox.addChild(front);

        // Left wall
        let Left = new TransformNode(this.scenegraph, "Left-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(-1000, 400, 0));
        mat4.scale(transform, transform, vec3.fromValues(2 , 1200, 2000));
        Left.setTransform(transform);
        child = new LeafNode("boxwire", this.scenegraph, "Left");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 0.5, 1));
        child.setMaterial(mat);
        Left.addChild(child);
        sceneBox.addChild(Left);

        // Right wall
        let right = new TransformNode(this.scenegraph, "right-transform");
        transform = mat4.create();
        mat4.translate(transform, transform, vec3.fromValues(1000, 400, 0));
        mat4.scale(transform, transform, vec3.fromValues(2 , 1200, 2000));
        right.setTransform(transform);
        child = new LeafNode("boxwire", this.scenegraph, "right");
        mat = new Material();
        mat.setAmbient(vec3.fromValues(1, 0.5, 0.5));
        child.setMaterial(mat);
        right.addChild(child);
        sceneBox.addChild(right);

        return sceneBox;
    }

    // Predefined camera movement
    public cameraMovement(): mat4{
        this.cameraMove = mat4.create();

        // FORWARD
        if(this.cameraPos[0] < 300 && this.cameraPos[1] >= 200 && this.cameraPos[2] >= 200 && this.cameraPos[2] < 800){
            mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(0, this.cameraPos[1], -(200 + (this.cameraPos[2] % 800))));
            //this.cameraPos[1]++; 
            this.cameraPos[2]++;
        }
        else if (this.cameraPos[0] < 300 && this.cameraPos[1] < 200 && this.cameraPos[2] < 200){
        // UPWARD
        mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(0,this.cameraPos[1] % 200, -(this.cameraPos[2] % 200)));
        this.cameraPos[1]++; this.cameraPos[2]++;
        }

        // Rotate and move in X
        else if (this.cameraPos[2] >= 800 && this.cameraPos[0] < 300)
        {
            mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(this.cameraPos[0], this.cameraPos[1], -this.cameraPos[2]));
            if(this.cameraPos[3] < 180)
            {
                this.cameraPos[3] += 5;
            }
            else
            {
                this.cameraPos[0] += 5;
            }

            mat4.rotate(this.cameraMove, this.cameraMove, glMatrix.toRadian(this.cameraPos[3] % 181), vec3.fromValues(0,1,0));   

        }

        // Move front from behind the house
        else if(this.cameraPos[0] >= 300)
        {
            mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(this.cameraPos[0], this.cameraPos[1], -this.cameraPos[2]));
            mat4.rotate(this.cameraMove, this.cameraMove, glMatrix.toRadian(this.cameraPos[3] % 181), vec3.fromValues(0,1,0));   
            if(this.cameraPos[1] > 100)
            {
                this.cameraPos[1] -= 10;
            }
            
            if(this.cameraPos[2] > -1000) {
                this.cameraPos[2] -= 5;
            }
            else {
                if(this.cameraPos[3] > 0){
                    this.cameraPos[3] -= 5;
                }
            }
        }
        /*else if (this.cameraPos[0] >= 300  && this.cameraPos[2] > -1300)
        {
            if(this.cameraPos[3] < 300)
            {
                this.cameraPos[3] += 5;
            }
            mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(this.cameraPos[0], this.cameraPos[1], -this.cameraPos[2]));
            mat4.rotate(this.cameraMove, this.cameraMove, glMatrix.toRadian(this.cameraPos[3] % 300), vec3.fromValues(0,1,0));   
        }*/
        /*else if (this.cameraPos[4] > 0 &&  this.cameraPos[2] > -1000)
        {
            mat4.translate(this.cameraMove, this.cameraMove, vec3.fromValues(this.cameraPos[0], this.cameraPos[1], -this.cameraPos[2]));
            mat4.rotate(this.cameraMove, this.cameraMove, glMatrix.toRadian(this.cameraPos[3] % 181), vec3.fromValues(0,1,0));   

        }*/
        
        

        return this.cameraMove;
    }

    public drawAnimations(): void{
        let animationTransform = mat4.create();
        mat4.rotate(animationTransform, animationTransform, glMatrix.toRadian((this.time/2)%360), [0,1,0]);
        mat4.translate(animationTransform, animationTransform, vec3.fromValues(150, 0, 0));
        this.allGroups.get("heli").setAnimationTransform(animationTransform);

        animationTransform = mat4.create();
        mat4.rotate(animationTransform, animationTransform, glMatrix.toRadian((this.time*5)%360), [0,1,0]);
        this.allGroups.get("TopProp0").setAnimationTransform(animationTransform);
        this.allGroups.get("TopProp1").setAnimationTransform(animationTransform);
        this.allGroups.get("TopProp2").setAnimationTransform(animationTransform);
        this.allGroups.get("TopProp3").setAnimationTransform(animationTransform);

        animationTransform = mat4.create();
        mat4.translate(animationTransform, animationTransform, vec3.fromValues(-115, 65, 0));
        mat4.rotate(animationTransform, animationTransform, glMatrix.toRadian((this.time*5)%360), [0,0,1]);
        mat4.translate(animationTransform, animationTransform, vec3.fromValues(115, -65, 0));
        this.allGroups.get("BackProp0").setAnimationTransform(animationTransform);
        this.allGroups.get("BackProp1").setAnimationTransform(animationTransform);
        this.allGroups.get("BackProp2").setAnimationTransform(animationTransform);
        this.allGroups.get("BackProp3").setAnimationTransform(animationTransform);
    }


    public animate(): void {
        this.time += 1;
        this.movement += 5;
        if (this.scenegraph != null) {
            this.scenegraph.animate(this.time);
        }
        this.draw();
    }


    public initLights(): void {

        this.lights = [];
        let l: Light = new Light();
        l.setAmbient([0.5, 0.5, 0.5]);
        l.setDiffuse([0.5, 0.5, 0.5]);
        l.setSpecular([0.5, 0.5, 0.5]);
        l.setPosition([300, 300, 100, 1]);
        this.lights.push(new LightInfo(l, LightCoordinateSystem.World));

        l = new Light();
        l.setAmbient([0.5, 0.5, 0.5]);
        l.setDiffuse([0.5, 0.5, 0.5]);
        l.setSpecular([0.5, 0.5, 0.5]);
        l.setPosition([0, 0, 500, 1]);
        l.setSpotDirection([0, 0, -1]);
        l.setSpotAngle(glMatrix.toRadian(120));
        l.isSpot = true;

        
        //this.lights.push(new LightInfo(l, LightCoordinateSystem.World));
    }

    public draw(): void {

        //this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.enable(this.gl.DEPTH_TEST);

        
        this.initLights();

        //send all the View-space lights to the GPU
        for (let i = 0; i < this.lights.length; i++) {

            if (this.lights[i].coordinateSystem == LightCoordinateSystem.View) {
                let lightPositionLocation: string = "light[" + i + "].position";
                let directionLocation: string = "light[" + i + "].spotDirection";
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(lightPositionLocation), this.lights[i].light.getPosition());
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(directionLocation), this.lights[i].light.getSpotDirection());
            }
        }

        if (this.scenegraph == null) {
            return;
        }

        this.gl.useProgram(this.shaderProgram)

        while (!this.modelview.isEmpty())
            this.modelview.pop();

        /*
         *In order to change the shape of this triangle, we can either move the vertex positions above, or "transform" them
         * We use a modelview matrix to store the transformations to be applied to our triangle.
         * Right now this matrix is identity, which means "no transformations"
         */
        this.modelview.push(mat4.create());
        this.modelview.push(mat4.clone(this.modelview.peek()));

        this.drawAnimations();

        if(this.cameraMode == CameraMode.Global){
            mat4.lookAt(this.modelview.peek(), vec3.fromValues(0, 600, 1000), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
            //mat4.lookAt(this.modelview.peek(), vec3.fromValues(0, 0, 300), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
            this.cameraPos[0] = 0;
            this.cameraPos[1] = 0;
            this.cameraPos[2] = 0;
            this.cameraPos[3] = 0;
        }
        else if(this.cameraMode == CameraMode.FirstPerson){
            mat4.lookAt(this.modelview.peek()
                , vec3.fromValues(0, 0, 1000)
                , vec3.fromValues(0, 0, 0)
                , vec3.fromValues(0, 1, 0));
            let cameraInverse: mat4 = mat4.create();
            mat4.invert(cameraInverse, this.cameraMovement());
            mat4.multiply(this.modelview.peek(), this.modelview.peek(), cameraInverse);
        }
        else{
            mat4.lookAt(this.modelview.peek()
                , vec3.fromValues(0, 0, -0.5)
                , vec3.fromValues(0, 0, 0)
                , vec3.fromValues(0, 1, 0));
            let heliInverse: mat4 = mat4.create();
            let heliPos: mat4 = mat4.create();
            mat4.invert(heliInverse, this.allGroups.get("heli").getAnimationTransform());
            mat4.multiply(this.modelview.peek(), this.modelview.peek(), this.allGroups.get("heli").getTransform());
            mat4.multiply(this.modelview.peek(), this.modelview.peek(), heliInverse);
            
            
        }
        
        // Descend through the scene graph, collect all the lights defined in the nodes, convert them to view coordinates
        // and push them into this.lights
        //console.log("before lightPass: " + this.lights.length);
        this.scenegraph.lightPass(this.modelview, this.lights);

        //console.log("after lightPass: " + this.lights.length);
        
        //send all the World-space lights to the GPU
        for (let i = 0; i < this.lights.length; i++) {
            if (this.lights[i].coordinateSystem == LightCoordinateSystem.World) {
                let lightPositionLocation: string = "light[" + i + "].position";
                let directionLocation: string = "light[" + i + "].spotDirection";
                let result: vec4 = vec4.create();
                vec4.transformMat4(result, this.lights[i].light.getPosition(), this.modelview.peek());
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(lightPositionLocation), result);

                result = vec4.create();
                vec4.transformMat4(result, this.lights[i].light.getSpotDirection(), this.modelview.peek());
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(directionLocation), result);
            }
        }

        
        this.gl.uniformMatrix4fv(this.shaderLocations.getUniformLocation("projection"), false, this.proj);

        // Send all the object space light to the GPU
        // The object space will be already converted into view space during the light pass. So, directly send them to GPU
        for (let i = 0; i < this.lights.length; i++) {

            if (this.lights[i].coordinateSystem == LightCoordinateSystem.Object) {
                let lightPositionLocation: string = "light[" + i + "].position";
                let directionLocation: string = "light[" + i + "].spotDirection";
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(lightPositionLocation), this.lights[i].light.getPosition());
                this.gl.uniform4fv(this.shaderLocations.getUniformLocation(directionLocation), this.lights[i].light.getSpotDirection());
            }
        }

        //send all the light colors
        for (let i = 0; i < this.lights.length; i++) {
            let ambientLocation: string = "light[" + i + "].ambient";
            let diffuseLocation: string = "light[" + i + "].diffuse";
            let specularLocation: string = "light[" + i + "].specular";
            let cutoffLocation: string = "light[" + i + "].cos_Cutoff";
            let spotLocation: string = "light[" + i + "].isSpot";
            this.gl.uniform3fv(this.shaderLocations.getUniformLocation(ambientLocation), this.lights[i].light.getAmbient());
            this.gl.uniform3fv(this.shaderLocations.getUniformLocation(diffuseLocation), this.lights[i].light.getDiffuse());
            this.gl.uniform3fv(this.shaderLocations.getUniformLocation(specularLocation), this.lights[i].light.getSpecular());
            this.gl.uniform1f(this.shaderLocations.getUniformLocation(cutoffLocation), Math.cos(this.lights[i].light.getSpotCutoff()));
            if(this.lights[i].light.isSpot)
            {
                this.gl.uniform1i(this.shaderLocations.getUniformLocation(spotLocation), 1);
            }
            else
            {
                this.gl.uniform1i(this.shaderLocations.getUniformLocation(spotLocation), 0);
            }
        }

        this.scenegraph.draw(this.modelview);
    }

    public freeMeshes(): void {
        this.scenegraph.dispose();
    }

    public setFeatures(features: Features): void {
        window.addEventListener("keydown", ev => features.keyPress(ev.code));
    }

    public setGlobal(): void {
        this.cameraMode = CameraMode.Global;
    }

    public setFirstPerson(): void {
        this.cameraMode = CameraMode.FirstPerson;
    }

    public setHeliCamera(): void {
        this.cameraMode = CameraMode.Helicopter;
    }

    // Draw the Bounding Boxes
    public callBVH(): void{
        this.bvh = !this.bvh;
        if(this.bvh){
            this.scenegraph.makeScenegraph(this.drawBVH());
            this.draw();
        }
        else{
            this.scenegraph.makeScenegraph(this.sceneNode);
            this.draw();
        }
    }

    public getNumberOfLights(): number {
        return this.lights.length;
    }

}
import { vec3, vec4 } from "gl-matrix"

/**
 * This class represents a single light source. The light source has various
 * properties: position (location or direction), colors (ambient, diffuse,
 * specular) direction in which it is pointing (if a spotlight), angle of the
 * cone (if a spotlight)
 */
export class Light {
    private ambient: vec3;
    private diffuse: vec3;
    private specular: vec3;
    private position: vec4;
    private spotDirection: vec4;
    private spotCutoff: number;

    public isSpot: boolean;

    constructor() {
        this.ambient = vec3.fromValues(0, 0, 0);
        this.diffuse = vec3.fromValues(0, 0, 0);
        this.specular = vec3.fromValues(0, 0, 0);

        this.position = vec4.fromValues(0, 0, 0, 1);
        this.spotDirection = vec4.fromValues(0, 0, 0, 0);
        this.spotCutoff = 0.0;
        this.isSpot = false;
    }

    public setAmbient(ambient: vec3 | number[]): void {
        this.ambient = vec3.fromValues(ambient[0], ambient[1], ambient[2]);
    }


    public setDirection(dir: vec3 | number[]): void {
        this.position = vec4.fromValues(dir[0], dir[1], dir[2], 0.0);
    }

    public setSpotDirection(sDir: vec3 | number[]) {
        this.spotDirection = vec4.fromValues(sDir[0], sDir[1], sDir[2], 0);
    }


    public setDiffuse(diff: vec3 | number[]): void {
        this.diffuse = vec3.fromValues(diff[0], diff[1], diff[2]);
    }

    public setSpecular(spec: vec3 | number[]): void {
        this.specular = vec3.fromValues(spec[0], spec[1], spec[2]);
    }

    public setSpotAngle(angle: number) {
        this.spotCutoff = angle;
    }

    public setPosition(pos: vec3 | number[]): void {
        this.position = vec4.fromValues(pos[0], pos[1], pos[2], 1);
    }

    public getAmbient(): vec3 {
        return vec3.fromValues(this.ambient[0], this.ambient[1], this.ambient[2]);
    }

    public getDiffuse(): vec3 {
        return vec3.fromValues(this.diffuse[0], this.diffuse[1], this.diffuse[2]);
    }

    public getSpecular(): vec3 {
        return vec3.fromValues(this.specular[0], this.specular[1], this.specular[2]);
    }

    public getPosition(): vec4 {
        return vec4.fromValues(this.position[0], this.position[1], this.position[2], this.position[3]);
    }

    public getSpotDirection(): vec4 {
        return vec4.fromValues(this.spotDirection[0], this.spotDirection[1], this.spotDirection[2], this.spotDirection[3]);
    }

    public getSpotCutoff(): number {
        return this.spotCutoff;
    }

    public clone(): Light
    {
        let L: Light = new Light();
        L.ambient = this.ambient;
        L.diffuse = this.diffuse;
        L.specular = this.specular;
        L.spotCutoff = this.spotCutoff;
        L.spotDirection = this.spotDirection;
        L.isSpot = this.isSpot;
        L.position = this.position;

        return L;
    }
}


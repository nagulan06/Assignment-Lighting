import { View } from "View"
//import * as OBJ from "webgl-obj-loader"
import { mat4 } from "gl-matrix"
import { Material } from "%COMMON/Material"

export enum CameraMode { Global, FirstPerson, Helicopter };

/**
 * This interface represents all the functions that the view can call. All callback functions for various UI elements go here
 */
export interface Features {
    keyPress(keyEvent: string): void;
}

export class Controller implements Features {
    private view: View;

    constructor(view: View) {
        this.view = view;
        this.view.setFeatures(this);
    }

    public go(): void {
        this.view.initScenegraph();

        let numLights: number = this.view.lights.length;
        console.log("Lights: "+numLights);
        this.view.initShaders(this.getGouraudVShader(numLights), this.getGouraudFShader());
        
        this.view.draw();
    }
    
    public keyPress(keyEvent: string): void {
        console.log("KEY PRESS: " + keyEvent);
        switch (keyEvent) {
            case "Digit1":
                this.view.setGlobal();
                break;
            case "Digit2":
                this.view.setFirstPerson();
                break;
            case "Digit3":
                this.view.setHeliCamera();
                break;
            case "KeyB":
                this.view.callBVH();
                break;
        }
    }





    public getGouraudFShader(): string {
        return `precision mediump float;

        //varying vec4 fTexCoord;
        varying vec4 fColor;
        /* texture */
        //uniform sampler2D image;
        
        void main()
        {            
            gl_FragColor = fColor ;//* texture2D(image,fTexCoord.st);
        }
        
    `;
    }


    public getGouraudVShader(numLights: number): string {
        return `

        struct MaterialProperties
        {
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
            float shininess;
        };
        
        struct LightProperties
        {
            vec3 ambient;
            vec3 diffuse;

            vec3 specular;
            vec4 position;
        };
        
        attribute vec4 vPosition;
        attribute vec4 vNormal;
        //attribute vec2 vTexCoord;
        varying vec4 fColor;
        //varying vec4 fTexCoord;
        
        uniform mat4 projection;
        uniform mat4 modelview;
        uniform mat4 normalmatrix;
        //uniform mat4 texturematrix;
        
        
        uniform MaterialProperties material;
        uniform LightProperties light[`+ numLights + `];
        
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
            float nDotL,rDotV;
            vec4 result;
        
        
            
            vec4 fPosition = modelview * vPosition;
            gl_Position = projection * fPosition;

            vec4 transformedNormal = normalmatrix * vNormal;
            normalView = normalize(transformedNormal.xyz);
            result = vec4(0,0,0,1);
        `
            + `for (int i=0;i<` + numLights + `;i++)
            {
                if (light[i].position.w!=0.0)
                    lightVec = normalize(light[i].position.xyz - fPosition.xyz);
                else
                    lightVec = normalize(-light[i].position.xyz);
        
                nDotL = dot(normalView,lightVec);
        
                viewVec = -fPosition.xyz;
                viewVec = normalize(viewVec);
        
                reflectVec = reflect(-lightVec,normalView);
                reflectVec = normalize(reflectVec);
        
                rDotV = max(dot(reflectVec,viewVec),0.0);
        
                ambient = material.ambient * light[i].ambient;
                diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);
                if (nDotL>0.0)
                    specular = material.specular * light[i].specular * pow(rDotV,material.shininess);
                else
                    specular = vec3(0,0,0);
                result = result + vec4(ambient+diffuse+specular,1.0);    
            }
            fColor = result;
            //fTexCoord = texturematrix * vec4(vTexCoord.s,vTexCoord.t,0,1);
        }
        
    `;
    }




    public getPhongVShader(): string {
        return `
        attribute vec4 vPosition;
        attribute vec4 vNormal;
        //attribute vec2 vTexCoord;
        
        uniform mat4 projection;
        uniform mat4 modelview;
        uniform mat4 normalmatrix;
        //uniform mat4 texturematrix;
        varying vec3 fNormal;
        varying vec4 fPosition;
        //varying vec4 fTexCoord;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
        
            fPosition = modelview * vPosition;
            gl_Position = projection * fPosition;
        
        
            vec4 tNormal = normalmatrix * vNormal;
            fNormal = normalize(tNormal.xyz);
        
          //  fTexCoord = texturematrix * vec4(vTexCoord.s,vTexCoord.t,0,1);
        
        }
        
    `;
    }

    public getPhongFShader(numLights: number): string {
        return `precision mediump float;

        struct MaterialProperties
        {
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
            float shininess;
        };
        
        struct LightProperties
        {
            vec3 ambient;
            vec3 diffuse;

            vec3 specular;
            vec4 position;
        };
        
        
        varying vec3 fNormal;
        varying vec4 fPosition;
        //varying vec4 fTexCoord;
        
        
        uniform MaterialProperties material;
        uniform LightProperties light[`+ numLights + `];
        
        /* texture */
        //uniform sampler2D image;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
            float nDotL,rDotV;
            vec4 result;
        
        
            result = vec4(0,0,0,1);
        `
            + `for (int i=0;i<` + numLights + `;i++)
            {
                if (light[i].position.w!=0.0)
                    lightVec = normalize(light[i].position.xyz - fPosition.xyz);
                else
                    lightVec = normalize(-light[i].position.xyz);
        
                vec3 tNormal = fNormal;
                normalView = normalize(tNormal.xyz);
                nDotL = dot(normalView,lightVec);
        
                viewVec = -fPosition.xyz;
                viewVec = normalize(viewVec);
        
                reflectVec = reflect(-lightVec,normalView);
                reflectVec = normalize(reflectVec);
        
                rDotV = max(dot(reflectVec,viewVec),0.0);
        
                ambient = material.ambient * light[i].ambient;
                diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);
                //if (nDotL>0.0)
                  //  specular = material.specular * light[i].specular * pow(rDotV,material.shininess);
                //else
                    specular = vec3(0,0,0);
                result = result + vec4(ambient+diffuse+specular,1.0);    
            }
            //result = result * texture2D(image,fTexCoord.st);
           // result = vec4(0.5*(fTexCoord.st+vec2(1,1)),0.0,1.0);
            gl_FragColor = result;
        }
        
    `;
    }


    private getVShader(): string {
        return`
        attribute vec4 vPosition;
        attribute vec4 vNormal;
        // attribute vec2 vTexCoord;
        
        uniform mat4 projection;
        uniform mat4 modelview;
        uniform mat4 normalmatrix;
        // uniform mat4 texturematrix;
        varying vec3 fNormal;
        varying vec4 fPosition;
        // varying vec4 fTexCoord;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
        
            fPosition = modelview * vPosition;
            gl_Position = projection * fPosition;
        
        
            vec4 tNormal = normalmatrix * vNormal;
            fNormal = normalize(tNormal.xyz);
        
            // fTexCoord = texturematrix * vec4(vTexCoord.s,vTexCoord.t,0,1);
        
        }
        
    `;

    }

    private getFShader(numLights: number): string {
        return `precision mediump float;

        struct MaterialProperties
        {
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
            float shininess;
        };
        
        struct LightProperties
        {
            vec3 ambient;
            vec3 diffuse;

            vec3 specular;
            vec4 position;
        };
        
        
        varying vec3 fNormal;
        varying vec4 fPosition;
        // varying vec4 fTexCoord;
        
        
        uniform MaterialProperties material;
        uniform LightProperties light[`+ numLights + `];
        
        /* texture */
        // uniform sampler2D image;
        
        void main()
        {
            vec3 lightVec,viewVec,reflectVec;
            vec3 normalView;
            vec3 ambient,diffuse,specular;
            float nDotL,rDotV;
            vec4 result;
        
        
            result = vec4(0,0,0,1);
        `
            + `for (int i=0;i<` + numLights + `;i++)
            {
                if (light[i].position.w!=0.0)
                    lightVec = normalize(light[i].position.xyz - fPosition.xyz);
                else
                    lightVec = normalize(-light[i].position.xyz);
        
                vec3 tNormal = fNormal;
                normalView = normalize(tNormal.xyz);
                nDotL = dot(normalView,lightVec);
        
                viewVec = -fPosition.xyz;
                viewVec = normalize(viewVec);
        
                reflectVec = reflect(-lightVec,normalView);
                reflectVec = normalize(reflectVec);
        
                rDotV = max(dot(reflectVec,viewVec),0.0);
        
                ambient = material.ambient * light[i].ambient;
                diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);
                //diffuse = light[i].diffuse * max(nDotL,0.0);
                if (nDotL>0.0)
                {
                    specular = material.specular * light[i].specular * pow(rDotV,material.shininess);
                    //specular = light[i].specular;// * pow(rDotV,material.shininess);
                }
                else
                {
                    specular = vec3(0,0,0);
                }
                result = result + vec4(ambient+diffuse+specular,1.0);    
            }
            // result = result * texture2D(image,fTexCoord.st);
           // result = vec4(0.5*(fTexCoord.st+vec2(1,1)),0.0,1.0);
            gl_FragColor = result;
        }
        
        `;
    }

}
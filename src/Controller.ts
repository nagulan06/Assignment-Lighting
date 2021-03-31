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
        this.view.initShaders(this.getPhongVShader(), this.getPhongFShader(4));
        
        //this.view.initLights_1();
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
            case "KeyS":
                this.view.spot();
                break;
        }
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

            vec4 offset = 1.2 * vec4(fNormal.x, fNormal.y, fNormal.z, 0);
            //gl_Position = gl_Position + offset;
        
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

            int isSpot;
            float cos_Cutoff;
            vec4 spotDirection;
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
            float nDotL,rDotV, nDotV;
            vec4 result;
            int NUM_BINS = 2;
            //float bins[2] = float[2](0.3, 0.8);
            //float shades[2] = float[2](0.25, 0.5);
        
        
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
                nDotV = dot(normalView, viewVec);
        
                // ambient
                ambient = material.ambient * light[i].ambient;

                // diffuse
                /*if (nDotV < 0.3)
                    diffuse = vec3(0,0,0);              
                else if (t < 0.0)
                    diffuse = 0.25 * diffuse;  
                else if (t < 0.2)   
                    diffuse = 0.4 * diffuse;
                else if (t < 0.5)
                    diffuse = 0.55 * diffuse;
                else if (t < 0.8)
                    diffuse = 0.85 * diffuse;
                else
                    diffuse = diffuse;*/

                diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);

                float dotFromDirection = dot(lightVec, -(light[i].spotDirection.xyz));
                    /*if (nDotL>0.0)
                        specular = material.specular * light[i].specular * pow(rDotV,material.shininess);
                    else*/
                        specular = vec3(0,0,0);

                float t = nDotL; //(nDotL * 0.5) + 0.5;
                vec3 totalColor = ambient+diffuse+specular;

                //result = result + mix(vec4(0,0,0,1), totalColor, smoothstep(0.3, 1.0, t));

                if (nDotV < 0.3)
                    result = result + vec4(0,0,0,1);      
                else if (t < 0.0)          
                result = result + vec4((0.25 * totalColor),1);
                else if (t < 0.2)
                    result = result + vec4((0.4 * totalColor),1);
                else if (t < 0.5)
                    result = result + vec4((0.55 * totalColor),1);
                else if (t < 0.8)
                    result = result + vec4((0.85 * totalColor),1);
                else
                    result = result + vec4(totalColor,1);

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

            int isSpot;
            float cos_Cutoff;
            vec4 spotDirection;
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
            float nDotL,rDotV, nDotV;
            vec4 result;
            int NUM_BINS = 2;
            float bins[2] = {0.3, 0.8};
            float shades[2] = {0.25, 0.5};
        
        
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
                nDotV = dot(normalView, viewVec);
        
                ambient = material.ambient * light[i].ambient;
                diffuse = material.diffuse * light[i].diffuse * max(nDotL,0.0);

                float dotFromDirection = dot(lightVec, -(light[i].spotDirection.xyz));
                    if (nDotL>0.0)
                        specular = material.specular * light[i].specular * pow(rDotV,material.shininess);
                    else
                        specular = vec3(0,0,0);

                /*if((light[i].isSpot == 0)|| (dotFromDirection >= light[i].cos_Cutoff)){
                    result = result + vec4(ambient+diffuse+specular,1.0);    
                }
                else
                {
                    result = vec4(0, 0, 0, 1);
                }*/

                float t = (nDotV > 0.0) ? nDotV : 0.0; 
                vec4 colorA = t * vec4(ambient+diffuse+specular,1.0);
                vec4 colorB = (1.0 - t) * vec4(0,0,0,1);
                //result = result + colorA + colorB;
                vec4 totalColor = vec4(ambient+diffuse+specular,1.0);

                for(int i = 0; i < NUM_BINS; i = i+1)
                {
                    if(t < arr[i])
                    {
                        totalColor = shades[i] * totalColor;
                        break;
                    }
                }
                 
                result = result + mix(vec4(0,0,0,1), totalColor, smoothstep(0.5, 1.0, t));
                //result = result + vec4(ambient+diffuse+specular,1.0);
            }
            //result = result * texture2D(image,fTexCoord.st);
           // result = vec4(0.5*(fTexCoord.st+vec2(1,1)),0.0,1.0);
            gl_FragColor = result;
        }
        
    `;
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

}


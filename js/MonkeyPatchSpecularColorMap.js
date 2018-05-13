// This is evil but I'm lazy

THREE.ShaderChunk.specularmap_fragment = THREE.ShaderChunk.specularmap_fragment.replace(
    `float specularStrength;`,
    `
    float specularStrength;

    #ifdef USE_EMISSIVEMAP
        vec3 sampledSpecularColor = emissiveMapTexelToLinear(texture2D(emissiveMap, vUv)).rgb;
    #endif
    `
);

THREE.ShaderChunk.lights_phong_fragment = THREE.ShaderChunk.lights_phong_fragment.replace(
    `material.specularColor = specular;`,
    `
    #ifdef USE_EMISSIVEMAP
        material.specularColor = sampledSpecularColor;
    #else
        material.specularColor = specular;
    #endif
    `
);

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

THREE.ShaderChunk.lights_phong_pars_fragment = `
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
    varying vec3 vNormal;
#endif
struct BlinnPhongMaterial {
    vec3    diffuseColor;
    vec3    specularColor;
    float   specularShininess;
    float   specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
    float FALLOFF_POWER = 0.8;
    float maskParam = material.specularStrength;
    float ambientalpha = 0.9; // TODO => uniform

    float scaledDiffDot = 0.5*dot(geometry.normal, directLight.direction) + 0.5;

    vec4 toonFalloffGradInput;
    toonFalloffGradInput.x = scaledDiffDot;
    toonFalloffGradInput.y = scaledDiffDot;

    float normDotEye = 1.0 - dot(geometry.normal, geometry.viewDir);
    toonFalloffGradInput.z = scaledDiffDot * normDotEye;
    toonFalloffGradInput.w = scaledDiffDot * normDotEye;

    vec4 g_ToonFalloffGradVals = vec4(0.546875, 0.421875, 0.468750, 0.281250);
    vec4 g_ToonFalloffGradScale = vec4(10.66667, 10.66667, 32.0, 32.0);

    vec4 g_ToonFalloffGradDarkVals = vec4(0.59375, 0.484375, 0.609375, 0.453125);
    vec4 g_ToonFalloffGradDarkMax = vec4(0.79, 0.79, 0.61, 0.61);

    #if 1 // TODO => uniform
        vec4 toonFalloffGradParam = saturate((toonFalloffGradInput - g_ToonFalloffGradVals) * g_ToonFalloffGradScale);
    #else
        vec4 toonFalloffGradParam = step(g_ToonFalloffGradDarkVals, toonFalloffGradInput) * g_ToonFalloffGradDarkMax;
    #endif

    vec2 toonFalloffInterpParam = toonFalloffGradParam.xz + maskParam * (toonFalloffGradParam.yw - toonFalloffGradParam.xz);

    vec3 shadowColor = max(material.diffuseColor, vec3(0.5)) * material.diffuseColor;
    vec3 toonColor = shadowColor + toonFalloffInterpParam.x*(material.diffuseColor - shadowColor);

    vec3 baseAmbientColor = toonColor * ambientLightColor;
    toonColor = toonColor + ambientalpha*(baseAmbientColor - toonColor);

    vec3 falloffColor = FALLOFF_POWER * toonFalloffInterpParam.y * material.diffuseColor;
    toonColor += falloffColor * (1.0 - toonColor);

    reflectedLight.directDiffuse += toonColor;

    vec3 halfDir = normalize( directLight.direction + geometry.viewDir );
    float specularLighting = saturate(dot(geometry.normal, halfDir));
    specularLighting = pow(specularLighting, 20.0);
    reflectedLight.directSpecular += specularLighting * material.specularColor;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
    // nope
}
#define RE_Direct               RE_Direct_BlinnPhong
#define RE_IndirectDiffuse      RE_IndirectDiffuse_BlinnPhong
#define Material_LightProbeLOD( material )  (0)
`
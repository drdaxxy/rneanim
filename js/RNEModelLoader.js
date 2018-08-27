RNEModelLoader = function(manager) {
    this.manager = (manager !== undefined ? manager : THREE.DefaultLoadingManager);
};

RNEModelLoader.prototype = {
    constructor: RNEModelLoader,

    load: function(url, onLoad, onProgress, onError) {
        var scope = this;

        var loader = new THREE.FileLoader( this.manager );
        loader.setResponseType( 'arraybuffer' );
        loader.load( url, function ( buffer ) {

            onLoad( scope.parse( buffer ) );

        }, onProgress, onError );
    },

    parse: function(buffer) {
        // Reference: http://zenhax.com/viewtopic.php?f=5&t=2745

        var reader = new DataView(buffer);
        var pos = 0;

        var container = new THREE.Group();
        var meshGroups = {};

        pos = 9 * 4;
        var meshCount = reader.getUint32(pos, true); pos += 4;
        var boneCount = reader.getUint32(pos, true); pos += 4;
        var textureCount = reader.getUint32(pos, true); pos += 4;
        var morphTargetCount = reader.getUint32(pos, true); pos += 4;

        var meshInfoOffset = reader.getUint32(pos, true); pos += 4;
        var bonesOffset = reader.getUint32(pos, true); pos += 4;
        var texturesOffset = reader.getUint32(pos, true); pos += 4;
        var morphTargetDataOffset = reader.getUint32(pos, true); pos += 4;
        var morphTargetInfoOffset = reader.getUint32(pos, true); pos += 4;

        var textures = [];

        pos = texturesOffset;
        for (var i = 0; i < textureCount; i++) {
            var gxtSize = reader.getUint32(pos, true); pos += 4;
            var gxtBuffer = buffer.slice(pos, pos + gxtSize);
            var gxtLoader = new GXTLoader();
            var subtextures = gxtLoader.parse(gxtBuffer);
            for (var j = 0; j < subtextures.length; j++) textures.push(subtextures[j]);
            pos += gxtSize;
        }

        var tmpSkeleton = {};
        var boneList = [];
        var bindMatrices = [];

        for (var i = 0; i < boneCount; i++) {
            var bone = new THREE.Bone();

            pos = bonesOffset + (0x1D0 * i);
            var bonepar = {};
            bone.id = reader.getUint16(pos, true); pos += 2;
            bonepar.unk1 = reader.getUint16(pos, true); pos += 2;
            bonepar.parent = reader.getUint16(pos, true); pos += 2;
            bonepar.unk2 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk3 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk4 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk5 = reader.getUint16(pos, true); pos += 2;
            bonepar.childrenCount = reader.getUint16(pos, true); pos += 2;
            pos += 0x10C; // children

            // for some reason, these seem to differ from what's provided in the bindpose matrices (or I'm dumb)
            // so we need to apply these after building the skeleton, then recalculate inverses
            // TODO understand this better, this probably isn't the right way to do it...
            bone.userData.basePosition = new THREE.Vector3(reader.getFloat32(pos, true), reader.getFloat32(pos+4, true), reader.getFloat32(pos+8, true)); pos += 0xC;
            bone.userData.baseRotation = new THREE.Euler(reader.getFloat32(pos, true), reader.getFloat32(pos+4, true), reader.getFloat32(pos+8, true), 'ZYX'); pos += 0xC;
            var baseScale = new THREE.Vector3(reader.getFloat32(pos, true), reader.getFloat32(pos+4, true), reader.getFloat32(pos+8, true)); pos += 0xC;
            if (baseScale.length() == 0) baseScale = new THREE.Vector3(1,1,1);
            bone.userData.baseScale = baseScale;

            pos += 0x40; // skip over the bindpose, its inverse follows, and we need that anyway

            var m00 = reader.getFloat32(pos, true); pos += 4;
            var m10 = reader.getFloat32(pos, true); pos += 4;
            var m20 = reader.getFloat32(pos, true); pos += 4;
            var m30 = reader.getFloat32(pos, true); pos += 4;

            var m01 = reader.getFloat32(pos, true); pos += 4;
            var m11 = reader.getFloat32(pos, true); pos += 4;
            var m21 = reader.getFloat32(pos, true); pos += 4;
            var m31 = reader.getFloat32(pos, true); pos += 4;
             
            var m02 = reader.getFloat32(pos, true); pos += 4;
            var m12 = reader.getFloat32(pos, true); pos += 4;
            var m22 = reader.getFloat32(pos, true); pos += 4;
            var m32 = reader.getFloat32(pos, true); pos += 4;
             
            var m03 = reader.getFloat32(pos, true); pos += 4;
            var m13 = reader.getFloat32(pos, true); pos += 4;
            var m23 = reader.getFloat32(pos, true); pos += 4;
            var m33 = reader.getFloat32(pos, true); pos += 4;

            // IMPORTANT!
            // The animation format expects rotations to be applied in the order Z-Y-X
            // Also, we need to set this before setting the bone's transform
            // (could probably just use .reorder() later too)
            bone.rotation.order = 'ZYX';
            
            var boneMatrix = new THREE.Matrix4().set(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
            bindMatrices.push(boneMatrix);

            boneList.push(bone);
            if (bonepar.parent != 0xFFFF) {
                if (tmpSkeleton[bonepar.parent] == null) tmpSkeleton[bonepar.parent] = [];
                tmpSkeleton[bonepar.parent].push(bone);
            }
        }
        for (var i in tmpSkeleton) {
            for (var j = 0; j < tmpSkeleton[i].length; j++) {
                boneList[i].add(tmpSkeleton[i][j]);
            }
        }

        var skeleton = new THREE.Skeleton(boneList, bindMatrices);
        skeleton.pose();

        var morphTargets = [];
        for (var i = 0; i < morphTargetCount; i++) {
            pos = morphTargetInfoOffset + (0x10 * i);
            var morphTarget = {};
            morphTarget.idInSeries = reader.getUint32(pos, true); pos += 4;
            morphTarget.vertices = [];
            morphTarget.normals = [];
            var vertCount = reader.getUint32(pos, true); pos += 4;
            pos += 4;
            var vertOffset = reader.getUint32(pos, true); pos += 4;

            pos = morphTargetDataOffset + vertOffset;
            for (var j = 0; j < vertCount; j++) {
                morphTarget.vertices.push(reader.getFloat32(pos, true), reader.getFloat32(pos + 4, true), reader.getFloat32(pos + 8, true));
                morphTarget.normals.push(reader.getFloat32(pos + 12, true), reader.getFloat32(pos + 16, true), reader.getFloat32(pos + 20, true));
                pos += 24;
            }
            morphTargets.push(morphTarget);
        }

        for (var i = 0; i < meshCount; i++) {
            pos = meshInfoOffset + (0x18C * i);
            var meshInfo = {};
            meshInfo.groupId = reader.getUint32(pos, true); pos += 4;
            meshInfo.defaultParent = reader.getUint16(pos, true); pos += 2;
            pos += 9;
            meshInfo.morphTargetCount = reader.getUint8(pos); pos += 1;
            meshInfo.morphTargetIds = [];
            for (var j = 0; j < 80; j++) {
                meshInfo.morphTargetIds.push(reader.getUint8(pos));
                pos += 1;
            }
            pos += 0x80; // matrices of unknown use
            meshInfo.vertCount = reader.getInt32(pos, true); pos += 4;
            meshInfo.faceCount = reader.getInt32(pos, true); pos += 4;
            meshInfo.unk1 = reader.getInt32(pos, true); pos += 4;
            meshInfo.unk2 = reader.getInt32(pos, true); pos += 4;
            meshInfo.vertOffset = reader.getInt32(pos, true); pos += 4;
            meshInfo.faceOffset = reader.getInt32(pos, true); pos += 4;

            meshInfo.vertStride = (meshInfo.faceOffset - meshInfo.vertOffset) / meshInfo.vertCount;

            meshInfo.boneMapCount = reader.getUint32(pos, true); pos += 4;
            var boneMap = [];
            for (var j = 0; j < 32; j++)
            {
                boneMap.push(reader.getUint16(pos, true));
                pos += 2;
            }
            pos += 0x18; // floats of unknown use
            meshInfo.opacity = reader.getFloat32(pos, true); pos += 4;
            pos += 0x14; // floats of unknown use

            // TODO other passes
            var colorMapId = reader.getInt16(pos, true); pos += 2;
            var secondMapId = reader.getInt16(pos, true); pos += 2;
            var specularMapId = reader.getInt16(pos, true); pos += 2;
            var fourthMapId = reader.getInt16(pos, true); pos += 2;
            var specularColorMapId = reader.getInt16(pos, true); pos += 2;
            var sixthMapId = reader.getInt16(pos, true); pos += 2;
            pos += 4;
            var outline = reader.getInt32(pos, true); pos += 4;

            var vertices = [];
            var normals = [];
            var uvs = [];
            var indices = [];

            var boneIndices = [];
            var boneWeights = [];

            var buffergeometry = new THREE.BufferGeometry();

            pos = 0x54 + meshInfo.vertOffset;
            for (var j = 0; j < meshInfo.vertCount; j++) {
                vertices.push(reader.getFloat32(pos, true), reader.getFloat32(pos + 4, true), reader.getFloat32(pos + 8, true));
                normals.push(reader.getFloat32(pos + 12, true), reader.getFloat32(pos + 16, true), reader.getFloat32(pos + 20, true));
                uvs.push(reader.getFloat32(pos + 24, true), 1.0 - reader.getFloat32(pos + 28, true));
                if (meshInfo.boneMapCount > 0) {
                    boneIndices.push(boneMap[reader.getUint8(pos + 32)], boneMap[reader.getUint8(pos + 33)], boneMap[reader.getUint8(pos + 34)], boneMap[reader.getUint8(pos + 35)]);
                    boneWeights.push(reader.getFloat32(pos + 36, true), reader.getFloat32(pos + 40, true), reader.getFloat32(pos + 44, true), reader.getFloat32(pos + 48, true));
                } else {
                    for (var k = 0; k < 4; k++) {
                        boneIndices.push(meshInfo.defaultParent);
                        boneWeights.push(1);
                    }
                }
                pos += meshInfo.vertStride;
            }

            pos = 0x54 + meshInfo.faceOffset;
            for (var j = 0; j < meshInfo.faceCount; j++) {
                indices.push(reader.getUint16(pos, true)); pos += 2;
            }

            buffergeometry.setIndex(indices);
            buffergeometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            buffergeometry.addAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            buffergeometry.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

            buffergeometry.addAttribute('skinIndex', new THREE.Uint16BufferAttribute(boneIndices, 4));
            buffergeometry.addAttribute('skinWeight', new THREE.Float32BufferAttribute(boneWeights, 4));

            var mesh = new THREE.SkinnedMesh(buffergeometry, new THREE.MeshToonMaterial({wireframe: false, skinning: true, morphTargets: true}));
            for (var j = 0; j < boneList.length; j++)
            {
                if (boneList[j].parent == null) mesh.add(boneList[j]);
            }
            mesh.bind(skeleton);

            // TODO necessary?
            buffergeometry.morphAttributes.position = [];
            buffergeometry.morphAttributes.normal = [];
            
            for (var j = 0; j < meshInfo.morphTargetCount; j++) {
                var rawMorphTarget = morphTargets[meshInfo.morphTargetIds[j]];
                var positionAttribute = new THREE.Float32BufferAttribute(rawMorphTarget.vertices, 3);
                positionAttribute.name = "morphTarget" + j;
                var normalAttribute = new THREE.Float32BufferAttribute(rawMorphTarget.normals, 3);
                normalAttribute.name = "morphTarget" + j;
                buffergeometry.morphAttributes.position.push(positionAttribute);
                buffergeometry.morphAttributes.normal.push(normalAttribute);
            }

            mesh.updateMorphTargets();


            if (meshGroups[meshInfo.groupId] == null) meshGroups[meshInfo.groupId] = [];

            // Enable setting nonstandard lighting params
            mesh.material.onBeforeCompile = extraUniformBinder(mesh.material);
            // TODO turn backface culling on when we have outline color right
            // (outline works by drawing backfaces first, a little larger than front faces)
            mesh.material.side = THREE.DoubleSide;
            mesh.material.transparent = true;
            // workaround for no OIT in THREE - https://github.com/mrdoob/three.js/issues/9977
            mesh.material.depthWrite = meshInfo.opacity > 0.9;
            mesh.material.opacity = meshInfo.opacity;
            // TODO do we need to manually copy this for decals?
            mesh.material.outlineParameters = {};
            // TODO is this more than binary?
            if (outline > 0) {
                mesh.material.outlineParameters.alpha = 0.6;
            } else {
                mesh.material.outlineParameters.visible = false;
            }
            if (colorMapId > -1) {
                mesh.material.map = textures[colorMapId];
            }
            if (specularMapId > -1) {
                // not *exactly* a specular map
                // - it's actually for rim lighting
                // but that's pretty similar
                mesh.material.specular = new THREE.Color(0xFFFFFF);
                mesh.material.specularMap = textures[specularMapId];
            }
            if (specularColorMapId > -1) {
                // We hijack emissiveMap because I'm too lazy to add another texture properly
                // see MonkeyPatchLightingModel.js
                mesh.material.emissive = new THREE.Color(0);
                mesh.material.emissiveMap = textures[specularColorMapId];
            }
            if (secondMapId > -1) {
                // colormap is a decal
                // TODO airi
                var frontMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material.clone());
                for (var j = 0; j < boneList.length; j++)
                {
                    if (boneList[j].parent == null) frontMesh.add(boneList[j]);
                }
                frontMesh.bind(skeleton);
                frontMesh.material.onBeforeCompile = extraUniformBinder(frontMesh.material);
                mesh.polygonOffset = true;
                mesh.polygonOffsetFactor = -1;
                mesh.material.map = textures[secondMapId];
                meshGroups[meshInfo.groupId].push(mesh);
                container.add(frontMesh);
            }

            meshGroups[meshInfo.groupId].push(mesh);
            container.add(mesh);
        }

        container.skeleton = skeleton;

        return {
            model: container,
            skeleton: skeleton,
            boneList: boneList,
            meshGroups: meshGroups
        };
    }
};
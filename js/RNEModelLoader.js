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

        pos = 9 * 4;
        var meshCount = reader.getUint32(pos, true); pos += 4;
        var boneCount = reader.getUint32(pos, true); pos += 4;
        var textureCount = reader.getUint32(pos, true); pos += 4;

        pos = 14 * 4;
        var bonesOffset = reader.getUint32(pos, true); pos += 4;

        pos = 15 * 4;
        var texturesOffset = reader.getUint32(pos, true); pos += 4;

        var textures = [];

        pos = texturesOffset;
        for (var i = 0; i < textureCount; i++) {
            var gxtSize = reader.getUint32(pos, true); pos += 4;
            var gxtBuffer = buffer.slice(pos, pos + gxtSize);
            var gxtLoader = new GXTLoader();
            var subtextures = gxtLoader.parse(gxtBuffer);
            for (j = 0; j < subtextures.length; j++) textures.push(subtextures[j]);
            pos += gxtSize;
        }

        var tmpSkeleton = {};
        var boneList = [];
        var bindMatrices = [];

        for (var i = 0; i < boneCount; i++) {
            pos = bonesOffset + (0x1D0 * i);
            var bonepar = {};
            bonepar.id = reader.getUint16(pos, true); pos += 2;
            bonepar.unk1 = reader.getUint16(pos, true); pos += 2;
            bonepar.parent = reader.getUint16(pos, true); pos += 2;
            bonepar.unk2 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk3 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk4 = reader.getUint16(pos, true); pos += 2;
            bonepar.unk5 = reader.getUint16(pos, true); pos += 2;
            bonepar.childrenCount = reader.getUint16(pos, true); pos += 2;
            pos += 0x130; // children and bind position/rotation vectors
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

            var bone = new THREE.Bone();

            // IMPORTANT!
            // The animation format expects rotations to be applied in the order Y-Z-X
            // Also, we need to set this before setting the bone's transform
            // (could probably just use .reorder() later too)
            bone.rotation.order = 'ZYX';
            
            var boneMatrix = new THREE.Matrix4().set(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
            bindMatrices.push(boneMatrix);

            bone.name = bonepar.id;
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

        pos = 13 * 4;
        var meshInfoOffset = reader.getInt32(pos, true); pos += 4;

        for (var i = 0; i < meshCount; i++) {
            pos = meshInfoOffset + (0x18C * i);
            var meshInfo = {};
            pos += 4;
            meshInfo.defaultParent = reader.getUint16(pos, true); pos += 2;
            pos += 0xDA;
            meshInfo.vertCount = reader.getInt32(pos, true); pos += 4;
            meshInfo.faceCount = reader.getInt32(pos, true); pos += 4;
            meshInfo.unk1 = reader.getInt32(pos, true); pos += 4;
            meshInfo.unk2 = reader.getInt32(pos, true); pos += 4;
            meshInfo.vertOffset = reader.getInt32(pos, true); pos += 4;
            meshInfo.faceOffset = reader.getInt32(pos, true); pos += 4;

            meshInfo.vertStride = (meshInfo.faceOffset - meshInfo.vertOffset) / meshInfo.vertCount;

            meshInfo.boneMapCount = reader.getUint32(pos, true); pos += 4;
            var beforeBoneMap = pos;
            var boneMap = [];
            for (j = 0; j < meshInfo.boneMapCount; j++)
            {
                boneMap.push(reader.getUint16(pos, true));
                pos += 2;
            }

            pos = beforeBoneMap + 0x70;
            // TODO second pass
            var colorMapId = reader.getInt16(pos, true); pos += 2;
            var secondMapId = reader.getInt16(pos, true); pos += 2;

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

            var mesh = new THREE.SkinnedMesh(buffergeometry, new THREE.MeshLambertMaterial({wireframe: false, skinning: true}));
            for (j = 0; j < boneList.length; j++)
            {
                if (boneList[j].parent == null) mesh.add(boneList[j]);
            }
            mesh.bind(skeleton);


            mesh.material.side = THREE.DoubleSide;
            mesh.material.transparent = true;
            if (colorMapId > -1) {
                mesh.material.map = textures[colorMapId];
            }


            container.add(mesh);
        }

        container.skeleton = skeleton;

        return {
            model: container,
            skeleton: skeleton,
            boneList: boneList
        };
    }
};
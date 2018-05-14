// TODO: Now that we're not rotating around world-Z, just use THREE's normal animation system

RNEAnimLoader = function(manager) {
    this.manager = (manager !== undefined ? manager : THREE.DefaultLoadingManager);
};

RNEAnimLoader.prototype = {
    constructor: RNEAnimLoader,

    load: function(url, onLoad, onProgress, onError) {
        var scope = this;

        var loader = new THREE.FileLoader( this.manager );
        loader.setResponseType( 'arraybuffer' );
        loader.load( url, function ( buffer ) {

            onLoad( scope.parse( buffer ) );

        }, onProgress, onError );
    },

    parse: function(buffer) {
        var reader = new DataView(buffer);
        var pos = 0;

        pos += 9 * 4;
        var duration = reader.getFloat32(pos, true); pos += 4;
        // TODO check framerate
        var frametime = 30.0;
        var msDuration = duration * frametime;

        var trackCount = reader.getUint32(pos, true); pos += 4;
        var tracksOffset = reader.getUint32(pos, true); pos += 4;

        var bonesFound = {};
        var meshGroupsFound = {};

        var boneTracks = [];
        var meshGroupTracks = [];
        for (i = 0; i < trackCount; i++) {
            pos = tracksOffset + i * 0xE8;
            trackStruct = pos;

            var track = {
                visibility: {},
                position: {},
                rotation: {},
                scale: {},
                morphs: []
            };

            track.id = reader.getUint16(pos, true); pos += 2;
            var flag = reader.getUint16(pos, true); pos += 2;
            var isMeshGroup = flag == 0x8000;
            if (isMeshGroup) {
                if (meshGroupsFound[track.id] === true) continue;
                meshGroupsFound[track.id] = true;
            } else {
                if (bonesFound[track.id] === true) continue;
                bonesFound[track.id] = true;
            }

            var subTracks = [];

            pos += 2;
            for (var j = 0; j < 10; j++) {
                var count = reader.getUint16(pos, true); pos += 2;
                var offset = reader.getUint32(trackStruct + 0x68 + 4*j, true);
                var times = [];
                var values = [];
                if (count > 0) {
                    var trackPos = pos;
                    pos = offset + 0x30;
                    for (var k = 0; k < count; k++) {
                        times.push(reader.getFloat32(pos, true) * frametime); pos += 4;
                        rawValue = reader.getFloat32(pos, true); pos += 4;
                        values.push(rawValue);
                    }
                    pos = trackPos;
                }
                subTracks.push({times: times, values: values});
            }

            pos += 12;
            var morphCount = reader.getUint16(pos, true); pos += 2;
            for (var j = 0; j < morphCount; j++) {
                var morph = {};
                morph.id = reader.getUint16(pos, true); pos += 2;
                var influenceCountPos = trackStruct + 0x48 + 2*j;
                var influenceCount = reader.getUint16(influenceCountPos, true);
                var influenceOffsetPos = trackStruct + 0xA8 + 4*j;
                var influenceOffset = reader.getUint32(influenceOffsetPos, true);
                if (influenceCount > 0) {
                    var trackPos = pos;
                    pos = influenceOffset + 0x30;
                    morph.times = [];
                    morph.values = [];
                    for (var k = 0; k < influenceCount; k++) {
                        morph.times.push(reader.getFloat32(pos, true) * frametime); pos += 4;
                        morph.values.push(reader.getFloat32(pos, true) / 100.0); pos += 4;
                    }
                    pos = trackPos;
                }
                track.morphs.push(morph);
            }

            if (subTracks[0].times.length) track.visibility = subTracks[0];
            if (subTracks[1].times.length) track.position.x = subTracks[1];
            if (subTracks[2].times.length) track.position.y = subTracks[2];
            if (subTracks[3].times.length) track.position.z = subTracks[3];
            if (subTracks[4].times.length) track.rotation.x = subTracks[4];
            if (subTracks[5].times.length) track.rotation.y = subTracks[5];
            if (subTracks[6].times.length) track.rotation.z = subTracks[6];
            if (subTracks[7].times.length) track.scale.x = subTracks[7];
            if (subTracks[8].times.length) track.scale.y = subTracks[8];
            if (subTracks[9].times.length) track.scale.z = subTracks[9];

            if (isMeshGroup) {
                meshGroupTracks.push(track);
            } else {
                boneTracks.push(track);
            }
        }

        return {boneTracks: boneTracks, meshGroupTracks: meshGroupTracks, duration: msDuration};
    }
};
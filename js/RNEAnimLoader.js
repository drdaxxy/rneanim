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
        var secondsDuration = duration * frametime;

        var trackCount = reader.getUint32(pos, true); pos += 4;
        var tracksOffset = reader.getUint32(pos, true); pos += 4;

        var bonesFound = {};

        var tracks = [];
        for (i = 0; i < trackCount; i++) {
            pos = tracksOffset + i * 0xE8;
            trackStruct = pos;

            var track = {
                position: {},
                rotation: {},
                scale: {}
            };

            track.bone = reader.getUint16(pos, true); pos += 2;
            var flag = reader.getUint16(pos, true); pos += 2;
            // TODO figure out what this flag is for
            if (flag == 0x8000) continue;
            if (bonesFound[track.bone] === true) continue;
            bonesFound[track.bone] = true;

            var subTracks = [];

            pos += 4;
            for (var j = 0; j < 9; j++) {
                var count = reader.getUint16(pos + 2*j, true);
                var offset = reader.getUint32(trackStruct + 0x6C + 4*j, true);
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

            // These need to be added in the right order
            // (so that rotation.worldOut will be applied after scales and rotation.x/y and before translates)
            // TODO don't depend on object iteration order for that
            if (subTracks[0].times.length) track.position.x = subTracks[0];
            if (subTracks[1].times.length) track.position.y = subTracks[1];
            if (subTracks[2].times.length) track.position.z = subTracks[2];
            if (subTracks[3].times.length) track.rotation.yaw = subTracks[3];
            if (subTracks[4].times.length) track.rotation.roll = subTracks[4];
            // "worldOut" = world out-of-screen (+Z in our case)
            if (subTracks[5].times.length) track.rotation.worldOut = subTracks[5];
            if (subTracks[6].times.length) track.scale.x = subTracks[6];
            if (subTracks[7].times.length) track.scale.y = subTracks[7];
            if (subTracks[8].times.length) track.scale.z = subTracks[8];

            tracks.push(track);
        }

        return {tracks: tracks, duration: secondsDuration};
    }
};
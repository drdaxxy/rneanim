RNEAnimPlayer = function(mesh, meshGroups, clip, repeatOffset, introOffset, tweening)
{
    this.mesh = mesh;
    this.meshGroups = meshGroups;
    this.clip = clip;
    this.repeatOffset = repeatOffset ? repeatOffset : 0;
    this.introOffset = introOffset ? introOffset : 0;
    this.tweening = tweening !== undefined ? tweening : true;

    this.reset(this.introOffset);
};

RNEAnimPlayer.prototype = {
    constructor: RNEAnimPlayer,

    reset: function(offset) {
        this.boneTrackIndexes = [];
        this.meshGroupTrackIndexes = [];
        for (var i = 0; i < this.clip.boneTracks.length; i++) {
            this.boneTrackIndexes.push({
                position: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                rotation: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                scale: {
                    x: 0,
                    y: 0,
                    z: 0
                }
            });
        }
        for (var i = 0; i < this.clip.meshGroupTracks.length; i++) {
            this.meshGroupTrackIndexes.push({
                visibility: 0,
                morphs: new Array(16).fill(0)
            });
        }
        this.currentTime = offset;
    },

    update: function(delta) {
        this.currentTime += delta;
        if (this.currentTime > this.clip.duration) {
            var repeatDelta = this.currentTime - this.clip.duration;
            this.reset(this.repeatOffset);
            this.currentTime += repeatDelta;
        }

        // reset bones to default
        // TODO figure out why I have to do this ;_;
        for (var i = 0; i < this.mesh.skeleton.bones.length; i++) {
            var bone = this.mesh.skeleton.bones[i];
            if (bone.userData.basePosition) bone.position.copy(bone.userData.basePosition);
            if (bone.userData.baseRotation) bone.rotation.copy(bone.userData.baseRotation);
            if (bone.userData.baseScale) bone.scale.copy(bone.userData.baseScale);
        }

        // reset meshgroup params to default
        for (var i in this.meshGroups) {
            for (var j = 0; j < this.meshGroups[i].length; j++) {
                this.meshGroups[i][j].visible = true;
                for (var k = 0; k < this.meshGroups[i][j].morphTargetInfluences.length; k++) {
                    this.meshGroups[i][j].morphTargetInfluences[k] = 0;
                }
            }
        }
        
        for (var i = 0; i < this.clip.boneTracks.length; i++) {
            if (this.mesh.skeleton.bones.length <= this.clip.boneTracks[i].id) continue;

            for (var axis in this.clip.boneTracks[i].scale) {
                this._updateBoneSubTrack(i, "scale", axis);
            }

            for (var axis in this.clip.boneTracks[i].rotation) {
                this._updateBoneSubTrack(i, "rotation", axis);
            }

            for (var axis in this.clip.boneTracks[i].position) {
                this._updateBoneSubTrack(i, "position", axis);
            }
        }

        for (var i = 0; i < this.clip.meshGroupTracks.length; i++) {
            var track = this.clip.meshGroupTracks[i];
            var meshGroup = this.meshGroups[track.id];
            if (!Array.isArray(meshGroup)) continue;

            var typeIndexes = this.meshGroupTrackIndexes[i];

            if (Array.isArray(track.visibility.times)) {
                var times = track.visibility.times;
                var values = track.visibility.values;

                while (typeIndexes.visibility+1 < times.length
                    && this.currentTime >= times[typeIndexes.visibility+1]) {
                    typeIndexes.visibility += 1;
                }

                for (var j = 0; j < meshGroup.length; j++) {
                    meshGroup[j].visible = values[typeIndexes.visibility] > 0;
                }
            }

            for (var j = 0; j < track.morphs.length; j++) {
                var id = track.morphs[j].id;
                var times = track.morphs[j].times;
                var values = track.morphs[j].values;
                if (times.length == 0) continue;

                while (typeIndexes.morphs[j]+1 < times.length
                    && this.currentTime >= times[typeIndexes.morphs[j]+1]) {
                    typeIndexes.morphs[j] += 1;
                }

                var index = typeIndexes.morphs[j];
                var nextIndex = typeIndexes.morphs[j] + 1;
                var time = times[index];
                var value = values[index];
                if (nextIndex < times.length && this.tweening) {
                    var nextTime = times[nextIndex];
                    var nextValue = values[nextIndex];
                    var transitionDuration = nextTime - time;
                    value = this._lerpTween(this.currentTime - time, transitionDuration, value, nextValue);
                }

                for (var k = 0; k < meshGroup.length; k++) {
                    meshGroup[k].morphTargetInfluences[id] = value;
                }
            }
        }
    },

    _updateBoneSubTrack: function(i, type, axis) {
        var typeIndexes = this.boneTrackIndexes[i][type];
        var times = this.clip.boneTracks[i][type][axis].times;
        var values = this.clip.boneTracks[i][type][axis].values;
        var bone = this.mesh.skeleton.bones[this.clip.boneTracks[i].id];

        while (typeIndexes[axis]+1 < times.length
            && this.currentTime >= times[typeIndexes[axis]+1]) {
            typeIndexes[axis] += 1;
        }

        var index = typeIndexes[axis];
        var nextIndex = typeIndexes[axis] + 1;
        var time = times[index];
        var value = values[index];
        if (nextIndex < times.length && this.tweening) {
            var nextTime = times[nextIndex];
            var nextValue = values[nextIndex];
            var transitionDuration = nextTime - time;
            if (type == "rotation") {
                value = this._angleLerpTween(this.currentTime - time, transitionDuration, value, nextValue);   
            } else {
                value = this._lerpTween(this.currentTime - time, transitionDuration, value, nextValue);
            }
        }
        
        bone[type][axis] = value;
    },

    // TODO other easing functions?

    _lerpTween: function(dt, dur, a, b) {
        return a + (dt / dur) * (b - a);
    },

    _angleLerpTween: function(dt, dur, a, b) {
        // https://gist.github.com/shaunlebron/8832585
        var dRad = (b - a) % (Math.PI/2);
        return a + (dt / dur) * ((2*dRad % (Math.PI/2)) - dRad);
    }
};
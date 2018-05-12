RNEAnimPlayer = function(mesh, clip, repeatOffset, introOffset, tweening)
{
    this.mesh = mesh;
    this.clip = clip;
    this.repeatOffset = repeatOffset ? repeatOffset : 0;
    this.introOffset = introOffset ? introOffset : 0;
    this.tweening = tweening !== undefined ? tweening : true;

    this.reset(this.introOffset);
};

RNEAnimPlayer.prototype = {
    constructor: RNEAnimPlayer,

    reset: function(offset) {
        this.trackIndexes = [];
        for (var i = 0; i < this.clip.tracks.length; i++) {
            this.trackIndexes.push({
                position: {
                    x: 0,
                    y: 0,
                    z: 0
                },
                rotation: {
                    yaw: 0,
                    roll: 0,
                    worldOut: 0
                },
                scale: {
                    x: 0,
                    y: 0,
                    z: 0
                }
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

        mesh.skeleton.pose();

        for (var i = 0; i < this.clip.tracks.length; i++) {
            if (this.mesh.skeleton.bones.length <= this.clip.tracks[i].bone) continue;

            for (var axis in this.clip.tracks[i].scale) {
                this._updateSubTrack(i, "scale", axis);
            }

            for (var axis in this.clip.tracks[i].rotation) {
                this._updateSubTrack(i, "rotation", axis);
            }

            for (var axis in this.clip.tracks[i].position) {
                this._updateSubTrack(i, "position", axis);
            }
        }
    },

    _updateSubTrack: function(i, type, axis) {
        var typeIndexes = this.trackIndexes[i][type];
        var times = this.clip.tracks[i][type][axis].times;
        var values = this.clip.tracks[i][type][axis].values;
        var bone = this.mesh.skeleton.bones[this.clip.tracks[i].bone];

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

        if (type == "rotation") {
            if (axis == "yaw") axis = "x";
            if (axis == "roll") axis = "y";
            if (axis == "worldOut") axis = "z";
            bone[type][axis] = value;
        } else {
            bone[type][axis] = value;
        }
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

/**
 * @param {number} min
 * @param {number} max
 * @param {number} value
 * @returns {number}
 */
function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

/**
 * @param {Float32Array} signal
 * @param {number} value
 */
function clamper(signal, value) {
    return clamp(0, signal?.length ?? 0, Math.round(value))
}


const State = {
    Initial: 0,
    Started: 1,
    Stopped: 2,
    Paused: 3,
}

class SBufferSourceProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'playbackRate',
            rate: 'a-rate',
            defaultValue: 1.0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        }, {
            name: 'detune',
            rate: 'a-rate',
            defaultValue: 0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        }, {

        }];
    }

    constructor() {
        super();
        /** @type {Float32Array} */
        this.signal;
        this.playhead = 0;

        this.loop = false;
        /** @type {number} */
        this.loopStart = 0; // In samples

        /** @type {number} */
        this.loopEnd; // In samples
        /** @type {number} */
        this.duration; // Duration of the buffer in seconds
        /** @param {number} value */

        this.startwhen = 0;
        this.stopwhen = 0;
        this.pausewhen = 0;
        this.resumewhen = 0;

        /** @type {0 | 1 | 2 | 3} */
        this.state = State.Initial

        this.playbackRate = 1.0; // Default playback rate is normal speed

        this.port.onmessage = event => {
            const { type, data } = event.data;
            switch (type) {
                case 'buffer':
                    this.signal = data;
                break;
                case 'start':
                    this.loopStart ??= 0
                    this.loopEnd ??= this.signal.length
                    this.duration ??= this.loop ? Number.MAX_SAFE_INTEGER : this.signal.length
                    this.playhead = 0
                    this.state = State.Started
                    console.log('start', this)
                    this.port.postMessage({ type: "started" })
                break;
                case 'stop':
                    this.state = State.Stopped
                    this.stopwhen = data
                    this.port.postMessage({ type: "stopped" })
                break;
                case 'pause':
                    this.state = State.Paused
                    this.pausewhen = data
                    this.port.postMessage({ type: "paused" })
                break;
                case 'resume':
                    this.state = State.Started
                    this.resumewhen = data
                    this.port.postMessage({ type: 'resume' })
                case 'loop':
                    this.loop = Boolean(data);
                break;
                case 'loopStart':
                    this.loopStart = clamper(this.signal, data * sampleRate);
                break;
                case 'loopEnd':
                    this.loopEnd = clamper(this.signal, data * sampleRate);
                break;
                case 'playhead':
                    this.port.postMessage( { type: "playhead", data: this.playhead })
                break;
                case 'playbackRate':
                    this.playbackRate = data;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (this.state === State.Stopped) {
            return true
        }
        if (this.state === State.Started && this.signal) {
            for (let channel = 0; channel < output.length; ++channel) {
                const outputChannel = output[channel];
                for (let i = 0; i < outputChannel.length; ++i) {
                    if (this.playhead >= this.loopEnd && this.loop) {
                        this.playhead = this.loopStart;
                        this.port.postMessage({ type: "looped" })
                    } else if (this.playhead >= this.signal.length) {
                        this.state = State.Stopped
                        this.port.postMessage({ type: 'ended' });
                        return true;
                    }
                    outputChannel[i] = this.signal[this.playhead++];
                }
            }
        } else {
            this.fillWithSilence(output);
        }
        return true;
    }

    fillWithSilence(output) {
        for (let channel = 0; channel < output.length; ++channel) {
            const outputChannel = output[channel];
            for (let i = 0; i < outputChannel.length; ++i) {
                outputChannel[i] = 0;
            }
        }
    }
}

registerProcessor('sbuffer-source-processor', SBufferSourceProcessor);

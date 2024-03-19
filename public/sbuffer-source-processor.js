
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
        }]
    }

    constructor() {
        super();
        /** @type {Float32Array[]} */
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

        this.timesLooped = 0;

        /** @type {0 | 1 | 2 | 3} */
        this.state = State.Initial

        this.playbackRate = 1.0; // Default playback rate is normal speed

        this.port.onmessage = event => {
            const { type, data } = event.data;
            console.log('processor message recieved', {type, data})
            switch (type) {
                case 'buffer':
                    this.signal = data;
                break;
                case 'start':
                    this.loopStart ??= 0
                    this.loopEnd ??= this.signal[0].length
                    this.duration ??= this.loop ? Number.MAX_SAFE_INTEGER : (this.signal[0].length * sampleRate)
                    this.playhead = 0
                    this.state = State.Started
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
                    this.loopStart = clamper(this.signal[0], data * sampleRate);
                break;
                case 'loopEnd':
                    this.loopEnd = clamper(this.signal[0], data * sampleRate);
                break;
                case 'playhead':
                    if (data) {
                        this.playhead = data;
                    } else {
                        this.port.postMessage({ type: "playhead", data: this.playhead })
                    }
                break;
                case 'duration':
                    this.duration = data;
                break;
                case 'playbackRate':
                    this.playbackRate = data;
                break;
            }
        };
    }

    /**
     * @param {Float32Array[]} inputs
     * @param {Float32Array[]} outputs
     * @param {Record<string, Float32Array>} parameters
     */
    process(inputs, outputs, parameters) {
        if (this.state !== State.Started || !this.signal) {
            return true; // Process only when in the Started state and signal is available
        }
        const output = outputs[0];
        // Retrieve parameter arrays for playbackRate and detune
        const playbackRates = parameters.playbackRate;
        const detunes = parameters.detune;
        const bufferLength = this.signal[0].length;

        for (let i = 0; i < output[0]?.length; ++i) {
            // Calculate the final playback rate for each sample
            const playbackRate = playbackRates.length > 1 ? playbackRates[i] : playbackRates[0];
            const detune = detunes.length > 1 ? detunes[i] : detunes[0];
            const finalRate = playbackRate * Math.pow(2, detune / 1200);

            // Update playhead position
            this.playhead += finalRate;

            // Handle looping
            if (this.loop) {
                if (finalRate > 0 && this.playhead >= this.loopEnd) {
                    this.playhead = this.loopStart + (this.playhead - this.loopEnd);
                    this.port.postMessage({ type: 'looped', data: this.timesLooped });
                    this.timesLooped++;
                } else if (finalRate < 0 && this.playhead < this.loopStart) {
                    this.playhead = this.loopEnd + (this.playhead - this.loopStart);
                    this.port.postMessage({ type: 'looped', data: this.timesLooped });
                    this.timesLooped++;
                }
            }

            // Handle stopping at the buffer's ends
            if ((finalRate > 0 && this.playhead >= bufferLength) || (finalRate < 0 && this.playhead < 0)) {
                this.port.postMessage({ type: 'ended' });
                this.state = State.Stopped;
                return true
            }

            for (let channel = 0; channel < output.length; ++channel) {
                const outputChannel = output[channel];
                const signal = this.signal[channel];
                if (signal === undefined) {
                    continue
                }

                if (finalRate >= -1 || finalRate <= 1) {
                    outputChannel[i] = signal[Math.floor(this.playhead)];
                } else {
                    // Fetch the four samples around the playhead position
                    // const y0 = signal[Math.floor(this.playhead) - 1];
                    // const y1 = signal[Math.floor(this.playhead)];
                    // const y2 = signal[Math.floor(this.playhead) + 1];
                    // const y3 = signal[Math.floor(this.playhead) + 2];
                    // const mu = this.playhead - Math.floor(this.playhead);

                    // // Interpolate the sample
                    // outputChannel[i] = cubicInterpolate(y0, y1, y2, y3, mu);

                    // Linear interpolation for sample output
                    const index = Math.floor(this.playhead);
                    const nextIndex = finalRate > 0 ? Math.min(index + 1, bufferLength - 1) : Math.max(index - 1, 0);
                    const frac = this.playhead - index;
                    outputChannel[i] = (1 - frac) * signal[index] + frac * signal[nextIndex];
                }
            }

        }

        return true; // Keep processing
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

/**
 * @param {number} y0
 * @param {number} y1
 * @param {number} y2
 * @param {number} y3
 * @param {number} mu
 * @returns {number}
 */
function cubicInterpolate(y0, y1, y2, y3, mu) {
    const mu2 = mu * mu;
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;
    const a3 = y1;

    return (a0 * mu * mu2 + a1 * mu2 + a2 * mu + a3);
 }


registerProcessor('sbuffer-source-processor', SBufferSourceProcessor);

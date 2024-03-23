// these are globally existing variables in the AudioWorkletGlobalScope and just here for type reference
/** @type {number} */
// var sampleRate
/** @type {number} */
// var currentFrame
/** @type {number} */
// var currentTime
/** @type {(name: string, processor: AudioWorkletProcessor) => void} */
// var registerProcessor


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
    Scheduled: 4
}

console.log('global scope', globalThis)

class ClipProcessor extends AudioWorkletProcessor {
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
            name: 'gain',
            rate: 'a-rate',
            defaultValue: 1,
            minValue: 0,
            maxValue: 3.4028234663852886e+38
        }, {
            name: 'pan',
            rate: 'a-rate',
            defaultValue: 0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        }, {
            name: 'highpass',
            rate: 'a-rate',
            defaultValue: 0,
            minValue: 20,
            maxValue: 20000
        }, {
            name: 'lowpass',
            rate: 'a-rate',
            defaultValue: 20000,
            minValue: 20,
            maxValue: 20000
        }]
    }

    constructor(options) {
        super(options);
        this.fps = currentTime

        console.log('this', this, globalThis)

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

        this.startWhen = 0;
        this.stopWhen = 0;
        this.pauseWhen = 0;
        this.resumeWhen = 0;

        this.timesLooped = 0;
        this.playedSamples = 0;

        this.offset = 0;

        /** @type {0 | 1 | 2 | 3} */
        this.state = State.Initial

        this.playbackRate = 1.0; // Default playback rate is normal speed

        /** @type {number} */
        this.duration
        /** @type {number} */
        this.durationSamples

        this.port.onmessage = event => {
            const { type, data } = event.data;
            if (type !== 'playhead') {
                console.log('proc', type, data)
            }
            switch (type) {
                case 'buffer':
                    this.signal = data;
                break;
                case 'start':
                    this.loopStart ??= 0
                    this.loopEnd ??= this.signal[0].length
                    if (data.duration) {
                        this.duration = Number(data.duration)
                    } else {
                        this.duration = this.loop ? Number.MAX_SAFE_INTEGER : (this.signal[0].length / sampleRate)
                    }
                    if (this.duration === -1) {
                        if (this.loop) {
                            this.duration = Number.MAX_SAFE_INTEGER
                        } else {
                            this.duration = this.signal[0].length / sampleRate
                        }
                    }
                    this.durationSamples = Math.min(this.duration * sampleRate, Number.MAX_SAFE_INTEGER)
                    this.offset = Math.floor(Number(data.offset ?? 0) * sampleRate)
                    if (this.offset < 0) {
                        this.offset = this.signal[0].length + this.offset
                    }
                    if (this.offset > this.signal[0].length) {
                        this.offset = this.signal[0].length % this.offset
                    }

                    this.playhead = Math.floor(Number(this.offset))
                    this.startWhen = Number(data.when ?? currentTime)
                    this.stopWhen = this.startWhen + this.duration
                    this.playedSamples = 0
                    // this.port.postMessage({ type: "started" })
                    this.state = State.Scheduled

                    this.port.postMessage({ type: "scheduled" })
                    console.log(this)

                break;
                case 'stop':
                    // this.state = State.Stopped
                    this.stopWhen = data ?? this.stopWhen
                    // this.playedSamples = 0
                    // console.log(currentTime, this.stopWhen)
                break;
                case 'pause':
                    this.state = State.Paused
                    this.pauseWhen = data ?? currentTime
                    this.port.postMessage({ type: "paused" })
                break;
                case 'resume':
                    this.state = State.Started
                    this.startWhen = data ?? currentTime
                    this.port.postMessage({ type: 'resume' })
                case 'loop':
                    this.loop = Boolean(data);
                    if (this.loop) {
                        if (this.state === State.Scheduled || this.state === State.Started) {
                            this.stopWhen = Number.MAX_SAFE_INTEGER
                            this.duration = Number.MAX_SAFE_INTEGER
                            this.durationSamples = Number.MAX_SAFE_INTEGER
                        }
                    }
                break;
                case 'loopStart':
                    this.loopStart = clamper(this.signal[0], data * sampleRate);
                break;
                case 'loopEnd':
                    this.loopEnd = clamper(this.signal[0], data * sampleRate);
                break;
                case 'playhead':
                    if (data) {
                        const value = Number(data)
                        this.playhead = value;
                        console.log('set playhead', value)
                    } else {
                        this.port.postMessage({ type: "playhead", data: Math.floor(this.playhead) })
                    }
                break;
                case 'playbackRate':
                    this.playbackRate = data;
                break;
                case 'offset':
                    this.offset = data.offset
                break
            }
        };

        // this.filterState = Array.from({ length: 2 }, () => ({ lp_y1: 0, lp_y2: 0, hp_y1: 0, hp_y2: 0 }));
        this.filterStates = [
            { x_1: 0, x_2: 0, y_1: 0, y_2: 0 },
            { x_1: 0, x_2: 0, y_1: 0, y_2: 0 }
        ];
    }

    /**
     * @param {Float32Array[][]} inputs
     * @param {Float32Array[][]} outputs
     * @param {Record<string, Float32Array>} parameters
     */
    process(_inputs, outputs, parameters) {
        const d = new Date().getMilliseconds()
        const start = currentTime
        const ondone = () => {
            this.fps = 1 / Math.max(currentTime - start, 0.0000001)
            const end = new Date().getMilliseconds()
            const timePerProcess = end - d
            this.port.postMessage({ type: 'frame', data: [currentTime, currentFrame, Math.floor(this.playhead), timePerProcess] })
            return true
        }
        if (this.signal === undefined) {
            return ondone()
        }
        if (this.state === State.Initial) {
            return ondone()
        } else if (this.state === State.Scheduled && currentTime >= this.startWhen) {
            this.state = State.Started
            this.port.postMessage({ type: "started" })
        } else if (this.state === State.Stopped) {
            return ondone();
        } else if (this.state === State.Paused && currentTime > this.pauseWhen) {
            return ondone();
        } else if (currentTime > this.stopWhen) {
            this.state = State.Stopped
            this.port.postMessage({ type: "stopped" })
            this.playedSamples = 0
            return ondone()
        }
        if (this.state !== State.Started) {
            return ondone()
        }

        const channels = outputs[0];
        // Retrieve parameter arrays for playbackRate and detune
        const playbackRates = parameters.playbackRate;
        const detunes = parameters.detune;
        const lowpass = parameters.lowpass;
        const highpass = parameters.highpass;
        const gains = parameters.gain;
        const pans = parameters.pan;
        const bufferLength = this.signal[0].length;
        const nc = Math.min(this.signal.length, channels.length)
        const nsamples = channels[0]?.length

        for (let i = 0; i < nsamples; ++i) {
            this.playedSamples += 1;
            if (this.playedSamples > this.durationSamples) {
                this.state = State.Stopped
                this.port.postMessage({ type: 'ended' });
                return ondone()
            }
            // Calculate the final playback rate for each sample
            const playbackRate = playbackRates.length > 1 ? playbackRates[i] : playbackRates[0];
            const detune = detunes.length > 1 ? detunes[i] : detunes[0];
            const rate = playbackRate * Math.pow(2, detune / 1200);

            // Update playhead position
            this.playhead += rate;

            // Handle looping
            if (this.loop) {
                if (rate > 0 && this.playhead >= this.loopEnd) {
                    this.playhead = this.loopStart + (this.playhead - this.loopEnd);
                    this.port.postMessage({ type: 'looped', data: this.timesLooped });
                    this.timesLooped++;
                } else if (rate < 0 && this.playhead < this.loopStart) {
                    this.playhead = this.loopEnd + (this.playhead - this.loopStart);
                    this.port.postMessage({ type: 'looped', data: this.timesLooped });
                    this.timesLooped++;
                }
            }

            // Handle stopping at the buffer's ends
            if ((rate > 0 && this.playhead >= bufferLength) || (rate < 0 && this.playhead < 0)) {
                this.port.postMessage({ type: 'ended' });
                this.state = State.Stopped;
                this.stopWhen > currentTime
                return ondone()
            }

            const index = Math.floor(this.playhead)

            // Apply playback rate and detune
            // No interpolation needed at lower speeds
            if (rate >= -1 || rate <=1) {
                for (let ch = 0; ch < nc; ++ch) {
                    const out = channels[ch];
                    out[i] = this.signal[ch][index]
                }
            } else {
                // Linear interpolation for sample output
                const nextIndex = rate > 0 ? Math.min(index + 1, bufferLength - 1) : Math.max(index - 1, 0);
                const frac = this.playhead - index;
                for (let ch = 0; ch < nc; ++ch) {
                    const out = channels[ch]
                    out[i] = (1 - frac) * out[index] + frac * out[nextIndex];
                }
            }
        }
        for (let channel = 0; channel < nc; ++channel) {
            const signal = channels[channel];
            lowpassFilter(signal, lowpass, channel)
            highpassFilter(signal, highpass, channel)
            gainFilter(signal, gains, channel)
        }
        if (nc === 2) {
            panStereoFilterLinear(channels[0], channels[1], pans)
        }
        return ondone()
    }

    /** @param {Float32Array[]} output */
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
 *
 * @example
 * // Fetch the four samples around the playhead position
 * const y0 = signal[Math.floor(this.playhead) - 1];
 * const y1 = signal[Math.floor(this.playhead)];
 * const y2 = signal[Math.floor(this.playhead) + 1];
 * const y3 = signal[Math.floor(this.playhead) + 2];
 * const mu = this.playhead - Math.floor(this.playhe
 * // Interpolate the sample
 * outputChannel[i] = cubicInterpolate(y0, y1, y2, y3, mu);
 */
function cubicInterpolate(y0, y1, y2, y3, mu) {
    const mu2 = mu * mu;
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;
    const a3 = y1;

    return (a0 * mu * mu2 + a1 * mu2 + a2 * mu + a3);
}


/**
 * @param {Float32Array} arr
 * @param {number[]} gains
 * @param {number} channel
 */
function gainFilter(arr, gains) {
    let previousGain = gains[0];
    if (gains.length === 1) {
        const gain = gains[0];
        if (gain === 1) return;
        for (let i = 0; i < arr.length; i++) {
            arr[i] *= gain;
        }
    } else {
        for (let i = 0; i < arr.length; i++) {
            const gain = previousGain = gains[i] ?? previousGain;
            if (gain === 1) continue;
            arr[i] *= gain
        }
    }
    return arr
}

// Pre-filtering state
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}} */
const lowpassStates = [];
/**
 * @param {Float32Array} arr
 * @param {number[]} cutoff
 * @param {number} sampleRate
 */
function lowpassFilter(arr, cutoffs, channel) {
    let { x_1, x_2, y_1, y_2 } = lowpassStates[channel] ?? { x_1: 0, x_2: 0, y_1: 0, y_2: 0 }
    if (cutoffs.length === 1) {
        const cutoff = cutoffs[0];
        if (cutoff >= 20000) return;
        // Constants for a simple lowpass filter (not specifically Butterworth)
        const w0 = 2 * Math.PI * cutoff / sampleRate;
        const alpha = Math.sin(w0) / 2;
        // Coefficients for a generic lowpass filter
        const b0 = (1 - Math.cos(w0)) / 2;
        const b1 = 1 - Math.cos(w0);
        const b2 = (1 - Math.cos(w0)) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;
        for (let i = 0; i < arr.length; i++) {
            const x = arr[i]; // Current sample
            // IIR filter equation
            const y = (b0/a0)*x + (b1/a0)*x_1 + (b2/a0)*x_2 - (a1/a0)*y_1 - (a2/a0)*y_2;
            // Update states
            x_2 = x_1;
            x_1 = x;
            y_2 = y_1;
            y_1 = y;
            // Store output
            arr[i] = y;
        }
    } else {
        let prevCutoff = cutoffs[0];
        for (let i = 0; i < arr.length; i++) {
            const cutoff = cutoffs[i] ?? prevCutoff;
            // Constants for a simple lowpass filter (not specifically Butterworth)
            const w0 = 2 * Math.PI * cutoff / sampleRate;
            const alpha = Math.sin(w0) / 2;
            // Coefficients for a generic lowpass filter
            const b0 = (1 - Math.cos(w0)) / 2;
            const b1 = 1 - Math.cos(w0);
            const b2 = (1 - Math.cos(w0)) / 2;
            const a0 = 1 + alpha;
            const a1 = -2 * Math.cos(w0);
            const a2 = 1 - alpha;
            const x = arr[i]; // Current sample
            // IIR filter equation
            const y = (b0/a0)*x + (b1/a0)*x_1 + (b2/a0)*x_2 - (a1/a0)*y_1 - (a2/a0)*y_2;
            // Update states
            x_2 = x_1;
            x_1 = x;
            y_2 = y_1;
            y_1 = y;
            // Store output
            arr[i] = y;
        }
    }
    lowpassStates[channel] = {
        x_1,
        x_2,
        y_1,
        y_2
    };
    return arr
}

// Pre-filtering state for highpass
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}} */
const highpassStates = [];
/**
 * @param {Float32Array} arr
 * @param {number[]} cutoffs
 * @param {number} sampleRate
 * @param {number} channel
 */
function highpassFilter(arr, cutoffs, channel) {
    let { x_1, x_2, y_1, y_2 } = highpassStates[channel] ?? { x_1: 0, x_2: 0, y_1: 0, y_2: 0 }
    if (cutoffs.length === 1) {
        const cutoff = cutoffs[0];
        if (cutoff <= 20) return;
        // Constants for a simple highpass filter (not specifically Butterworth)
        const w0 = 2 * Math.PI * cutoff / sampleRate;
        const alpha = Math.sin(w0) / 2;
        // Coefficients for a generic highpass filter
        const b0 = (1 + Math.cos(w0)) / 2;
        const b1 = -(1 + Math.cos(w0));
        const b2 = (1 + Math.cos(w0)) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;
        for (let i = 0; i < arr.length; i++) {
            const x = arr[i]; // Current sample
            // IIR filter equation
            const y = (b0/a0)*x + (b1/a0)*x_1 + (b2/a0)*x_2 - (a1/a0)*y_1 - (a2/a0)*y_2;
            // Update states
            x_2 = x_1;
            x_1 = x;
            y_2 = y_1;
            y_1 = y;
            // Store output
            arr[i] = y;
        }
    } else {
        let prevCutoff = cutoffs[0];
        for (let i = 0; i < arr.length; i++) {
            const cutoff = cutoffs[i] ?? prevCutoff;
            // Constants for a simple highpass filter (not specifically Butterworth)
            const w0 = 2 * Math.PI * cutoff / sampleRate;
            const alpha = Math.sin(w0) / 2;
            // Coefficients for a generic highpass filter
            const b0 = (1 + Math.cos(w0)) / 2;
            const b1 = -(1 + Math.cos(w0));
            const b2 = (1 + Math.cos(w0)) / 2;
            const a0 = 1 + alpha;
            const a1 = -2 * Math.cos(w0);
            const a2 = 1 - alpha;
            const x = arr[i]; // Current sample
            // IIR filter equation
            const y = (b0/a0)*x + (b1/a0)*x_1 + (b2/a0)*x_2 - (a1/a0)*y_1 - (a2/a0)*y_2;
            // Update states
            x_2 = x_1;
            x_1 = x;
            y_2 = y_1;
            y_1 = y;
            // Store output
            arr[i] = y;
        }
    }
    highpassStates[channel] = {
        x_1,
        x_2,
        y_1,
        y_2
    };
    return arr
}

/**
 * Applies stereo panning to a stereo audio signal.
 * @param {Float32Array} l The left channel of the stereo audio signal.
 * @param {Float32Array} r The right channel of the stereo audio signal.
 * @param {number[]} pan The pan value ranging from -1 (full left) to 1 (full right).
 */
function panStereoFilterSmooth(l, r, pans) {
    if (pans.length === 1) {
        const pan = pans[0];
        if (pan === 0) return;
        const leftGain = pan <= 0 ? 1 : Math.sqrt(1 - pan);
        const rightGain = pan >= 0 ? 1 : Math.sqrt(1 + pan);
        // Apply panning gains to each channel
        for (let i = 0; i < l.length; i++) {
            l[i] *= leftGain;
            r[i] *= rightGain;
        }
    } else {
        let prevPan = pans[0];
        for (let i = 0; i < l.length; i++) {
            const pan = pans[i] ?? prevPan;
            // Calculate gain for left and right channels based on pan value
            const leftGain = pan <= 0 ? 1 : Math.sqrt(1 - pan);
            const rightGain = pan >= 0 ? 1 : Math.sqrt(1 + pan);
            // Apply panning gains to each channel
            l[i] *= leftGain;
            r[i] *= rightGain;
        }
    }
}

function panStereoFilterLinear(l, r, pans) {
    if (pans.length === 1) {
        const pan = pans[0];
        // Linear gain calculation
        const leftGain = pan <= 0 ? 1 : 1 - pan;
        const rightGain = pan >= 0 ? 1 : 1 + pan;
        // Apply panning gains to each channel
        for (let i = 0; i < l.length; i++) {
            l[i] *= leftGain;
            r[i] *= rightGain;
        }
    } else {
        let prevPan = pans[0];
        for (let i = 0; i < l.length; i++) {
            const pan = pans[i] ?? prevPan;
            // Linear gain calculation
            const leftGain = pan <= 0 ? 1 : 1 - pan;
            const rightGain = pan >= 0 ? 1 : 1 + pan;
            // Apply panning gains to each channel
            l[i] *= leftGain;
            r[i] *= rightGain;
        }
    }
}


registerProcessor('clip-processor', ClipProcessor);

/// <reference path="../AudioWorklet.d.ts" />
/// <reference path="../ClipProcessor.d.ts" />


/** @type {ClipProcessorStateMap} */
const State = {
    Initial: 0,
    Started: 1,
    Stopped: 2,
    Paused: 3,
    Scheduled: 4,
    Ended: 5,
    Disposed: 6
}

class ClipProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
        {
            name: 'playbackRate',
            rate: 'a-rate',
            defaultValue: 1.0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        },
        {
            name: 'detune',
            rate: 'a-rate',
            defaultValue: 0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        },
        {
            name: 'gain',
            rate: 'a-rate',
            defaultValue: 1,
            minValue: 0,
            maxValue: 3.4028234663852886e+38
        },
        {
            name: 'pan',
            rate: 'a-rate',
            defaultValue: 0,
            minValue: -3.4028234663852886e+38,
            maxValue: 3.4028234663852886e+38
        },
        {
            name: 'highpass',
            rate: 'a-rate',
            defaultValue: 20,
            minValue: 20,
            maxValue: 20000
        },
        {
            name: 'lowpass',
            rate: 'a-rate',
            defaultValue: 20000,
            minValue: 20,
            maxValue: 20000
        }
    ]
    }
    /**
     * @param {ClipWorkletOptions | undefined} options
     */
     constructor(options) {
        super(options);
        /** @type {ClipProcessorOptions} */
        const processorOptions = options?.processorOptions ?? {}
        const {
            buffer = [],
            loopEnd = buffer[0]?.length,
            loop = false,
            playhead = 0,
            loopStart,
            duration,
            offset = 0,
            startWhen = 0,
            stopWhen = 0,
            pauseWhen = 0,
            resumeWhen = 0,
            playedSamples = 0,
            state = State.Initial,
            timesLooped = 0,
            fadeInDuration = 0,
            fadeOutDuration = 0,
            crossfadeDuration = 0,
        } = processorOptions
        this.signal = buffer
        this.playhead = playhead;
        this.loop = loop;
        this.loopStart = loopStart
        this.loopEnd = loopEnd
        this.duration = duration
        this.startWhen = startWhen;
        this.stopWhen = stopWhen;
        this.pauseWhen = pauseWhen;
        this.resumeWhen = resumeWhen;
        this.timesLooped = timesLooped;
        this.playedSamples = playedSamples;
        this.offset = offset;
        this.state = state;
        this.duration = duration
        /** @type {number | undefined} */
        this.durationSamples
        this.fadeInSamples = fadeInDuration * sampleRate
        this.fadeOutSamples = fadeOutDuration * sampleRate
        this.crossfadeSamples = crossfadeDuration * sampleRate

        this.lastFrameTime = currentTime

        /** @type {number | undefined} */
        this.remainingSamples
        this.port.onmessage = this.onmessage
        this.maxTimeTaken = 0

        console.log('proc initialized', this)
    }

    /** @type {ClipProcessorOnmessage} */
    onmessage = ev => {
        const { type, data } = ev.data;
        console.log('proc', type, data)
        switch (type) {
            case 'buffer':
                this.signal = data
            break;
            case 'start':
                this.loopStart ??= 0
                this.loopEnd ??= this.signal[0].length
                this.duration = data?.duration ?? -1
                if (this.duration === -1) {
                    this.duration = this.loop
                        ? this.duration = Number.MAX_SAFE_INTEGER
                        : this.signal[0].length / sampleRate
                }
                this.durationSamples = Math.min(this.duration * sampleRate, Number.MAX_SAFE_INTEGER)
                this.offset = Math.floor((data?.offset ?? 0) * sampleRate)
                if (this.offset < 0) {
                    this.offset = this.signal[0].length + this.offset
                }
                if (this.offset > this.signal[0].length) {
                    this.offset = this.signal[0].length % this.offset
                }
                this.playhead = this.offset
                this.startWhen = data?.when ?? currentTime
                this.stopWhen = this.startWhen + this.duration
                this.playedSamples = 0
                this.state = State.Scheduled
                this.port.postMessage({ type: "scheduled" })
            break;
            case 'stop':
                if (this.state === State.Ended || this.state === State.Initial) {
                    break;
                }
                this.stopWhen = data ?? this.stopWhen
                this.state = State.Stopped
                this.port.postMessage({ type: "stopped" })
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
            break;
            case 'dispose':
                this.dispose()
            break;
            case 'loop':
                this.loop = data;
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
                this.playhead = data;
            break;
            case 'fadeIn':
                this.fadeInSamples = data * sampleRate
            break
            case 'fadeOut':
                this.fadeOutSamples = data * sampleRate
            break
            case 'loopCrossfade':
                this.crossfadeSamples = data * sampleRate
            break
            default:
            break
        }
    }

    dispose() {
        this.state = State.Disposed
        this.port.postMessage({ type: "disposed" })
        this.port.close()
        this.signal = []
    }

    /**
     * @param {Float32Array[][]} _inputs
     * @param {Float32Array[][]} outputs
     * @param {Record<string, Float32Array>} parameters
     */
    process(_inputs, outputs, parameters) {
        if (this.state === State.Disposed) {
            return false
        }
        const ondone = () => {
            const timeTaken = currentTime - this.lastFrameTime
            this.lastFrameTime = currentTime
            this.port.postMessage({
                type: 'frame',
                data: [currentTime, currentFrame, Math.floor(this.playhead), timeTaken * 1000]
            })
            return true
        }
        if (this.signal === undefined) {
            return ondone()
        }
        if (this.state === State.Initial) {
            return ondone()
        }
        if (this.state === State.Ended) {
            fillWithSilence(outputs[0])
            return ondone()
        }
        if (this.state === State.Scheduled) {
            if (currentTime >= this.startWhen) {
                this.state = State.Started
                this.port.postMessage({ type: "started" })
            } else {
                fillWithSilence(outputs[0])
                return ondone()
            }
        } else if (this.state === State.Paused) {
            if (currentTime > this.pauseWhen) {
                fillWithSilence(outputs[0])
                return ondone()
            }
        }
        // otherwise we are in started or stopped state
        if (currentTime > this.stopWhen) {
            fillWithSilence(outputs[0])
            this.state = State.Ended
            this.port.postMessage({ type: "ended" })
            this.playedSamples = 0
            return ondone()
        }

        const output0 = outputs[0];
        const durationSamples = this.durationSamples ?? Number.MAX_SAFE_INTEGER
        const sourceLength = this.signal[0].length;
        if (sourceLength === 0) {
            fillWithSilence(output0)
            return ondone()
        }
        const nc = Math.min(this.signal.length, output0.length)
        const ns = Math.min(this.signal[0]?.length, output0[0]?.length)
        const loop = this.loop
        const loopStart = this.loopStart ?? 0
        const loopEnd = this.loopEnd ?? sourceLength
        const playedSamples = this.playedSamples
        const fadeInSamples = this.fadeInSamples
        const fadeOutSamples = this.fadeOutSamples
        const stopWhen = this.stopWhen
        const signal = this.signal
        const state = this.state

        const {
            playbackRate: playbackRates,
            detune: detunes,
            lowpass, highpass,
            gain: gains,
            pan: pans
        } = parameters;

        // find the indices to be used based on the playback rate and detune etc.
        const {
            indices,
            loopFadeInIndices,
            playhead,
            ended,
            looped,
        } = getPlayIndices(
            playbackRates,
            detunes,
            loop,
            loopStart,
            loopEnd,
            durationSamples,
            sourceLength,
            ns,
            playedSamples,
            this.playhead,
            this.crossfadeSamples
        )

        fill(output0, signal, indices)

        const xfadeLength = loopFadeInIndices.length
        if (xfadeLength > 0) {
            for (let i = 0; i < xfadeLength; i++) {
                const idx = loopFadeInIndices[i]
                const remaining = loopStart - idx
                const frac = 1 - ((remaining - i) / this.crossfadeSamples)
                for (let ch = 0; ch < nc; ch++) {
                    const sample = signal[ch][idx] * frac
                    output0[ch][i] = output0[ch][i] * (1-frac) + sample
                }
            }
        }

        const shouldFadeIn = fadeInSamples > 0 && playedSamples < fadeInSamples;
        if (shouldFadeIn) {
            const remaining = fadeInSamples - playedSamples
            const thisblock = Math.min(ns, remaining)
            for (let i = 0; i < thisblock; ++i) {
                const frac = 1 - ((remaining - i) / fadeInSamples)
                for (let ch = 0; ch < nc; ++ch) {
                    output0[ch][i] *= frac
                }
            }
        }

        if (fadeOutSamples > 0) {
            // fadeout on stopped
            if (state === State.Stopped) {
                const remaining = Math.floor((stopWhen - currentTime) * sampleRate)
                const fadeSamples = Math.min(ns, remaining)
                for (let i = 0; i < fadeSamples; ++i) {
                    const frac = (remaining - i) / fadeOutSamples
                    for (let ch = 0; ch < nc; ++ch) {
                        output0[ch][i] *= frac
                    }
                }
                for (let i = fadeSamples; i < ns; ++i) {
                    for (let ch = 0; ch < nc; ++ch) {
                        output0[ch][i] = 0
                    }
                }
            // fadeout on started without explicitly calling stop
            } else if (playedSamples > (durationSamples - fadeOutSamples)) {
                const remaining = durationSamples - playedSamples
                const fadeSamples = Math.min(ns, remaining)
                for (let i = 0; i < fadeSamples; ++i) {
                    const frac = (remaining - i) / fadeOutSamples
                    for (let ch = 0; ch < nc; ++ch) {
                        output0[ch][i] *= frac
                    }
                }
                // fill the rest with silence
                for (let i = fadeSamples; i < ns; ++i) {
                    for (let ch = 0; ch < nc; ++ch) {
                        output0[ch][i] = 0
                    }
                }
            }
        }

        for (let channel = 0; channel < nc; ++channel) {
            const signal = output0[channel];
            lowpassFilter(signal, lowpass, channel)
            highpassFilter(signal, highpass, channel)
        }
        gainFilter(output0, gains)

        if (nc === 1) {
            monoToStereo(output0)
        }
        panFilter(output0, pans)

        if (looped) {
            this.timesLooped++
            this.port.postMessage({ type: "looped", data: this.timesLooped })
        }

        if (ended) {
            this.state = State.Ended
            this.port.postMessage({ type: "ended" })
        }

        this.playedSamples += indices.length
        this.playhead = playhead

        // copy result to other outputs if any
        for (let i = 1; i < outputs.length; i++) {
            const output = outputs[i]
            copy(output0, output)
        }
        return ondone()
    }
}

/**
 * @param {Float32Array[]} target
 * @param {Float32Array[]} source
 * @param {number[]} indices
 * @returns {void}
 */
function fill(target, source, indices) {
    for (let i = 0; i < indices.length; i++) {
        for (let ch = 0; ch < target.length; ch++) {
            target[ch][i] = source[ch][indices[i]]
        }
    }
    for (let i = indices.length; i < target[0].length; i++) {
        for (let ch = 0; ch < target.length; ch++) {
            target[ch][i] = 0
        }
    }
}

/**
 * @param {Float32Array[]} signal
 * @returns {void}
 */
function monoToStereo(signal) {
    const r = new Float32Array(signal[0].length)
    for (let i = 0; i < signal[0].length; i++) {
        r[i] = signal[0][i]
    }
    signal.push(r)
}

/**
 * @param {Float32Array} playbackRates
 * @param {Float32Array} detunes
 * @param {boolean} loop
 * @param {number} loopStart
 * @param {number} loopEnd
 * @param {number} durationSamples
 * @param {number} sourceLength
 * @param {number} ns
 * @param {number} playedSamples
 * @param {number} playhead
 * @param {number} loopFadeInLength
 * @returns {{
 *  indices: number[],
 *  loopFadeInIndices: number[],
 *  playhead: number
 *  ended: boolean,
 *  looped: boolean
 * }}
 */
function getPlayIndices(
    playbackRates,
    detunes,
    loop,
    loopStart,
    loopEnd,
    durationSamples,
    sourceLength,
    ns,
    playedSamples,
    playhead,
    loopFadeInLength
) {
    let playbackRate = playbackRates[0] ?? 1.0
    let detune = detunes[0] ?? 0
    let ended = false
    let looped = false
    /** @type {number[]} */
    let indices = []
    /** @type {number[]} */
    let loopFadeInIndices = []

    for (let i = 0; i < ns; ++i) {
        if (playedSamples > durationSamples) {
            ended = true
            break
        }
        // Calculate the final playback rate for each sample
        playbackRate = playbackRates[i] ?? playbackRate;
        detune = detunes[i] ?? detune
        const rate = playbackRate * Math.pow(2, detune / 1200);

        // Handle looping
        if (loop) {
            // maybe go to loop start
            if (rate > 0) {
                const crossfadeStart = loopEnd - loopFadeInLength
                if (playhead >= crossfadeStart) {
                    const relativeToLoopStart = Math.floor(playhead - loopEnd)
                    const abs = loopStart + relativeToLoopStart
                    loopFadeInIndices.push(abs)
                }
                if (playhead >= loopEnd) {
                    playhead = loopStart
                    looped = true
                }
            // if reversed, maybe go to loop end
            } else if (rate < 0 && playhead < loopStart) {
                playhead = loopEnd
                looped = true
            }
        }

        // Handle stopping at the buffer's ends
        if ((rate > 0 && playhead >= sourceLength) || (rate < 0 && playhead < 0)) {
            ended = true
            break
        }

        const index = Math.floor(playhead)
        indices.push(index)

        // Update playhead position
        playhead += rate;
    }
    return {
        indices,
        loopFadeInIndices,
        playhead,
        ended,
        looped
    }
}

/**
 * @param {Float32Array[]} source
 * @param {Float32Array[]} target
 * @returns {Float32Array[]}
 */
function copy(source, target = []) {
    for (let i = target.length; i < source.length; i++) {
        target[i] = new Float32Array(source[i].length)
    }
    for (let ch = 0; ch < source.length; ++ch) {
        for (let i = 0; i < source[ch].length; ++i) {
            target[ch][i] = source[ch][i]
        }
    }
    return target
}

/**
 * @param {Float32Array[]} buffer
 * @returns {void}
 * */
function fillWithSilence(buffer) {
    for (let i = 0; i < buffer.length; ++i) {
        for (let j = 0; j < buffer[i]?.length; ++i) {
            buffer[i][j] = 0;
        }
    }
}

/**
 * @param {Float32Array[]} arr
 * @param {Float32Array} gains
 */
function gainFilter(arr, gains) {
    if (gains.length === 1) {
        const gain = gains[0];
        if (gain === 1) return;
        for (let ch of arr) {
            for (let i = 0; i < ch.length; i++) {
                ch[i] *= gain;
            }
        }
        return
    }
    let gain = gains[0];
    for (let ch of arr) {
        for (let i = 0; i < ch.length; i++) {
            gain = gains[i] ?? gain
            ch[i] *= gain
        }
    }
}

// Pre-filtering state
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}[]} */
const lowpassStates = [];
/**
 * @param {Float32Array} arr
 * @param {Float32Array} cutoffs
 * @param {number} channel
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
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}[]} */
const highpassStates = [];
/**
 * @param {Float32Array} arr
 * @param {Float32Array} cutoffs
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
 * @param {Float32Array[]} signal
 * @param {Float32Array} pans The pan value ranging from -1 (full left) to 1 (full right).
 */
function panFilter(signal, pans) {
    let pan = pans[0];
    for (let i = 0; i < signal[0].length; i++) {
        pan = pans[i] ?? pan;
        const leftGain = pan <= 0 ? 1 : 1 - pan;
        const rightGain = pan >= 0 ? 1 : 1 + pan;
        signal[0][i] *= leftGain;
        signal[1][i] *= rightGain;
    }
}

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

registerProcessor('ClipProcessor', ClipProcessor);

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

/**
 * @param {ClipProcessorOptions} options
 * @returns {Required<ClipProcessorOptions>}
 */
function getProperties({
    buffer = [],
    duration = -1,
    loop = false,
    loopStart = 0,
    loopEnd = (buffer[0]?.length ?? 0) * sampleRate,
    loopCrossfade = 0,
    playhead = 0,
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
    enableFadeIn = fadeInDuration > 0,
    enableFadeOut = fadeOutDuration > 0,
    enableLoopCrossfade = loopCrossfade > 0,
    // enableLoopCrossfade = true,
    enableHighpass = true,
    enableLowpass = true,
    enableGain = true,
    enablePan = true,
    enableDetune = true,
    enablePlaybackRate = true,
} = {}) {
    return {
        buffer,
        loop,
        loopStart,
        loopEnd,
        loopCrossfade,
        duration,
        playhead,
        offset,
        startWhen,
        stopWhen,
        pauseWhen,
        resumeWhen,
        playedSamples,
        state,
        timesLooped,
        fadeInDuration,
        fadeOutDuration,
        enableFadeIn,
        enableFadeOut,
        enableHighpass,
        enableLowpass,
        enableGain,
        enablePan,
        enableDetune,
        enablePlaybackRate,
        enableLoopCrossfade,
    }
}

    /**
     * @param {number | undefined} offset
     * @param {Required<ClipProcessorOptions>} properties
     * @returns number
     */
function setOffset(properties, offset) {
    if (offset === undefined) {
        return properties.offset = 0
    }
    if (offset < 0) {
        setOffset(properties, properties.buffer[0]?.length + properties.offset)
    }
    if (offset > properties.buffer[0]?.length - 1) {
        setOffset(properties, properties.buffer[0]?.length % properties.offset)
    }
    const offs = Math.floor(offset * sampleRate)
    properties.offset = offs
    return offs
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

    /** @type {Required<ClipProcessorOptions>} */
    properties

    /**
     * @param {ClipWorkletOptions | undefined} options
     */
     constructor(options) {
        super(options);
        /** @type {ClipProcessorOptions} */
        this.properties = getProperties(options?.processorOptions)
        this.port.onmessage = this.onmessage
        console.log('proc initialized', this)
    }


    /** @type {ClipProcessorOnmessage} */
    onmessage = ev => {
        const { type, data } = ev.data;
        console.log('proc', type, data)
        switch (type) {
            case 'buffer':
                this.properties.buffer = data
            break;
            case 'start':
                this.properties.timesLooped = 0
                this.properties.loopStart ??= 0
                this.properties.loopEnd ??= (this.properties.buffer[0].length ?? 0) * sampleRate
                this.properties.duration = data?.duration ?? -1
                if (this.properties.duration === -1) {
                    this.properties.duration = this.properties.loop
                        ? this.properties.duration = Number.MAX_SAFE_INTEGER
                        : this.properties.buffer[0].length / sampleRate
                }
                setOffset(this.properties, data?.offset)
                this.properties.playhead = this.properties.offset
                this.properties.startWhen = data?.when ?? currentTime
                this.properties.stopWhen = this.properties.startWhen + this.properties.duration
                this.properties.playedSamples = 0
                // this.properties.state = State.Scheduled
                this.properties.state = State.Scheduled
                this.port.postMessage({ type: "scheduled" })
            break;
            case 'stop':
                if (this.properties.state === State.Ended || this.properties.state === State.Initial) {
                    break;
                }
                this.properties.stopWhen = data ?? this.properties.stopWhen
                this.properties.state = State.Stopped
                this.port.postMessage({ type: "stopped" })
            break;
            case 'pause':
                this.properties.state = State.Paused
                this.properties.pauseWhen = data ?? currentTime
                this.port.postMessage({ type: "paused" })
            break;
            case 'resume':
                this.properties.state = State.Started
                this.properties.startWhen = data ?? currentTime
                this.port.postMessage({ type: 'resume' })
            break;
            case 'dispose':
                this.dispose()
            break;
            case 'loop':
                const loop = data
                const state = this.properties.state
                if (loop) {
                    if (state === State.Scheduled || state === State.Started) {
                        this.properties.stopWhen = Number.MAX_SAFE_INTEGER
                        this.properties.duration = Number.MAX_SAFE_INTEGER
                    }
                }
                this.properties.loop = loop
            break;
            case 'loopStart':
                this.properties.loopStart = data;
            break;
            case 'loopEnd':
                this.properties.loopEnd = data;
            break;
            case 'loopCrossfade':
                this.properties.loopCrossfade = data;
            break;
            case 'playhead':
                this.properties.playhead = Math.floor(data);
            break;
            case 'fadeIn':
                this.properties.fadeInDuration = data
            break
            case 'fadeOut':
                this.properties.fadeOutDuration = data
            break
            case 'toggleGain':
                this.properties.enableGain = data ?? !this.properties.enableGain
            break
            case 'togglePan':
                this.properties.enablePan = data ?? !this.properties.enablePan
            break
            case 'toggleLowpass':
                this.properties.enableLowpass = data ?? !this.properties.enableLowpass
            break
            case 'toggleHighpass':
                this.properties.enableHighpass = data ?? !this.properties.enableHighpass
            break
            case 'toggleDetune':
                this.properties.enableDetune = data ?? !this.properties.enableDetune
            break
            case 'togglePlaybackRate':
                this.properties.enablePlaybackRate = data ?? !this.properties.enablePlaybackRate
            break
            case 'toggleLoopCrossfade':
                console.log('before', this.properties)
                this.properties.enableLoopCrossfade = data ?? !this.properties.enableLoopCrossfade
                console.log('after', this.properties)
            break;
            case 'logState':
                console.log(this.properties)
            break
            default:
            break
        }
    }

    dispose() {
        this.properties.state = State.Disposed
        this.port.postMessage({ type: "disposed" })
        this.port.close()
        this.properties.buffer = []
    }

    /**
     * @param {Float32Array[][]} _inputs
     * @param {Float32Array[][]} outputs
     * @param {Record<string, Float32Array>} parameters
     */
    process(_inputs, outputs, parameters) {
        let state = this.properties.state
        if (this.properties.state === State.Disposed) {
            return false
        }
        const ondone = () => {
            const timeTaken = currentTime - (this.lastFrameTime ?? 0)
            this.lastFrameTime = currentTime
            this.port.postMessage({
                type: 'frame',
                data: [currentTime, currentFrame, Math.floor(this.properties.playhead), timeTaken * 1000]
            })
            return true
        }
        if (state === State.Initial) {
            return ondone()
        }
        if (state === State.Ended) {
            fillWithSilence(outputs[0])
            return ondone()
        }
        if (state === State.Scheduled) {
            if (currentTime >= this.properties.startWhen) {
                state = this.properties.state = State.Started
                this.port.postMessage({ type: "started" })
            } else {
                fillWithSilence(outputs[0])
                return ondone()
            }
        } else if (state === State.Paused) {
            if (currentTime > this.properties.pauseWhen) {
                fillWithSilence(outputs[0])
                return ondone()
            }
        }
        // otherwise we are in started or stopped state
        if (currentTime > this.properties.stopWhen) {
            fillWithSilence(outputs[0])
            state = this.properties.state = State.Ended
            this.port.postMessage({ type: "ended" })
            this.properties.playedSamples = 0
            return ondone()
        }

        const output0 = outputs[0];
        const sourceLength = this.properties.buffer[0].length ?? 0;
        if (sourceLength === 0) {
            fillWithSilence(output0)
            return ondone()
        }

        const {
            playbackRate: playbackRates,
            detune: detunes,
            lowpass, highpass,
            gain: gains,
            pan: pans
        } = parameters;

        const properties = this.properties

        const {
            buffer,
            loop,
            loopStart,
            loopEnd,
            loopCrossfade,
            stopWhen,
            playedSamples,
            enableLowpass,
            enableHighpass,
            enableGain,
            enablePan,
            enableFadeOut,
            enableFadeIn,
            enableLoopCrossfade,
            playhead,
            fadeInDuration,
            fadeOutDuration,
        } = properties

        const nc = Math.min(buffer.length, output0.length)
        const ns = Math.min(buffer[0]?.length ?? 0, output0[0]?.length ?? 0)
        const durationSamples = this.properties.duration * sampleRate

        // this should only be done if using loop true
        // const loopStartSamples = Math.floor(loopStart * sampleRate)
        // let loopEndSamples = Math.floor(loopEnd * sampleRate)
        // if (loopEndSamples <= loopStartSamples + 2048) {
            // loopEndSamples = loopStartSamples + 2048
        // }
        // loopEndSamples = Math.min(loopEndSamples, sourceLength)
        // let loopSamples = loopEndSamples - loopStartSamples

        // const fadeInSamples = Math.floor(Math.min(fadeInDuration * sampleRate, loopSamples))
        // const fadeOutSamples = Math.floor(Math.min(fadeOutDuration * sampleRate, loopSamples))

        // remove
        // let xfadeSamples = 0

        // find the indexes to be used based on the playback rate and detune etc.
        // const {
        //     indexes,
        //     loopFadeInindexes,
        //     playhead: updatedPlayhead,
        //     ended,
        //     looped,
        // } = getPlayindexes(
        //     playbackRates,
        //     detunes,
        //     loop,
        //     loopStartSamples,
        //     loopEndSamples,
        //     durationSamples,
        //     sourceLength,
        //     ns,
        //     playedSamples,
        //     playhead,
        //     xfadeSamples
        // )


        // Constants setup
        const SAMPLE_BLOCK_SIZE = 128;
        const loopCrossfadeSamples = Math.floor(sampleRate * loopCrossfade);
        const loopStartSamples = Math.min(Math.floor(loopStart * sampleRate), sourceLength - SAMPLE_BLOCK_SIZE);
        const loopEndSamples = Math.min(Math.floor(loopEnd * sampleRate), sourceLength);
        const loopLengthSamples = loopEndSamples - loopStartSamples;

        const {
            indexes,
            ended,
            looped,
            playhead: updatedPlayhead
        } = findIndexesNormal({
            bufferLength: sourceLength,
            loop,
            playhead,
            loopStartSamples,
            loopEndSamples,
            durationSamples
        })
        fill(output0, buffer, indexes)


        const xfadeNumSamples = Math.min(Math.floor(loopCrossfade * sampleRate), loopLengthSamples);

        // Check conditions for crossfade
        const isWithinLoopRange = loop && playhead > loopStartSamples && playhead < loopEndSamples;
        const needsCrossfadeLogic = enableLoopCrossfade && loopCrossfadeSamples > 0 && sourceLength > SAMPLE_BLOCK_SIZE;

        if (isWithinLoopRange && needsCrossfadeLogic) {
            processLoopFadeOut();
            processLoopFadeIn();
        }

        function processLoopFadeOut() {
            let endIndex = Math.min(loopStartSamples + xfadeNumSamples, loopEndSamples);
            let numSamples = endIndex - loopStartSamples;
            // if we are at the end of the buffer, use whats available untile the end
            if (loopEndSamples + numSamples > sourceLength) {
                numSamples = loopEndSamples - sourceLength
                endIndex = loopStartSamples + numSamples
            }
            if (numSamples === 0) {
                return
            }
            const isWithin = playhead > loopStartSamples && playhead < endIndex;
            if (isWithin) {
                const remaining = endIndex - playhead;
                let index = Math.floor(loopEndSamples + numSamples - remaining)
                const n = Math.min(remaining, SAMPLE_BLOCK_SIZE);
                console.log({ numSamples, endIndex, index})
                for (let i = 0; i < n; i++) {
                    index++;
                    const position = (numSamples - remaining) / numSamples; // 0 to 1
                    const gain = Math.cos(Math.PI * position / 2);
                    if (index > sourceLength || index < 0) {
                        throw new Error(`index ${index} in loop fade out is out of bounds, sourceLength: ${sourceLength}`)
                    }
                    for (let ch = 0; ch < nc; ch++) {
                        output0[ch][i] += buffer[ch][index] * gain;
                    }
                }
            }
        }

        function processLoopFadeIn() {
            let startIndex = Math.max(loopEndSamples - xfadeNumSamples, loopStartSamples);
            let numSamples = loopEndSamples - startIndex;
            let firstIndex = loopStartSamples - numSamples;
            if (firstIndex < 0) {
                numSamples += firstIndex
                startIndex = loopEndSamples - numSamples
                firstIndex = 0
            }
            if (numSamples === 0) {
                return
            }
            const isWithin = playhead > startIndex;
            if (isWithin) {
                let remaining = loopEndSamples - playhead;
                let index = firstIndex + numSamples - remaining;
                const n = Math.min(remaining, SAMPLE_BLOCK_SIZE);
                for (let i = 0; i < n; i++) {
                    index++
                    remaining--
                    const position = (numSamples - remaining) / numSamples // 0 to 1
                    const gain = Math.sin(Math.PI * position / 2);
                    if (index > sourceLength || index < 0) {
                        throw new Error(`index ${index} in loop fade in is out of bounds, sourceLength: ${sourceLength}`)
                    }
                    for (let ch = 0; ch < nc; ch++) {
                        output0[ch][i] += buffer[ch][index] * gain;
                    }
                }
            }
        }


        // const xfadeLength = loopFadeInindexes.length
        // if (xfadeLength > 0) {
        //     console.log('xfade')
        //     for (let i = 0; i < xfadeLength; i++) {
        //         const idx = loopFadeInindexes[i]
        //         const remaining = loopStartSamples - idx
        //         const frac = 1 - ((remaining - i) / xfadeSamples)
        //         for (let ch = 0; ch < nc; ch++) {
        //             const sample = buffer[ch][idx] * frac
        //             output0[ch][i] = output0[ch][i] * (1-frac) + sample
        //         }
        //     }
        // }

        // const shouldFadeIn = enableFadeIn && fadeInSamples > 0 && playedSamples < fadeInSamples;
        // if (shouldFadeIn) {
        //     fadeIn(output0, fadeInSamples, playedSamples, ns)
        // }

        // if (enableFadeOut && fadeOutSamples > 0) {
        //     // fadeout on stopped
        //     if (state === State.Stopped) {
        //         console.log('fadeout')
        //         const remaining = Math.floor((stopWhen - currentTime) * sampleRate)
        //         const fadeSamples = Math.min(ns, remaining)
        //         fadeOut(output0, fadeSamples, remaining, fadeOutSamples, ns)
        //     // fadeout on started without explicitly calling stop
        //     } else if (playedSamples > (durationSamples - fadeOutSamples)) {
        //         console.log('fadeout')
        //         const remaining = durationSamples - playedSamples
        //         const fadeSamples = Math.min(ns, remaining)
        //         fadeOut(output0, fadeSamples, remaining, fadeOutSamples, ns)
        //     }
        // }

        if (enableLowpass) {
            lowpassFilter(output0, lowpass)
        }
        if (enableHighpass) {
            highpassFilter(output0, highpass)
        }

        if (enableGain) {
            gainFilter(output0, gains)
        }

        if (nc === 1) {
            monoToStereo(output0)
        }
        if (enablePan) {
            panFilter(output0, pans)
        }

        if (looped) {
            this.properties.timesLooped++
            this.port.postMessage({ type: "looped", data: this.properties.timesLooped })
        }

        if (ended) {
            state = this.properties.state = State.Ended
            this.port.postMessage({ type: "ended" })
        }

        this.properties.playedSamples += indexes.length
        this.properties.playhead = updatedPlayhead

        const numNans = checkNans(output0)
        if (numNans > 0) {
            console.log({numNans, indexes, playhead: updatedPlayhead, ended, looped, sourceLength})
            return false
        }

        for (let i = 1; i < outputs.length; i++) {
            copy(output0, outputs[i])
        }
        return ondone()
    }
}

/**
 * Calculates the gain for the fade in effect.
 * Using an equal power strategy
 * given the total number of samples for the fade In
 * and the current position in the fade In.
 * @param {number} fadeInNumSamples
 * @param {number} fadeInPos
 */
function calculateFadeInGain(fadeInNumSamples, fadeInPos) {
    const angle = Math.PI * fadeInPos / fadeInNumSamples
    return Math.cos(angle)
}

// /**
//  * @param {ClipProcessor}
//  */
// function findPlayindexesNormalWithoutLoop(props) {
//     if (playhead + 128 < bufferLength) {
//         const length = 128
//         const indexes = Array.from({ length })
//         for (let i = 0; i < 128; i++) {
//             indexes[i] = Math.floor(playhead + i)
//         }
//         return indexes
//     }
//     const length = bufferLength - playhead
//     if (length < 0) {
//         return []
//     }
//     const indexes = Array.from({ length })
//     for (let i = 0; i < length; i++) {
//         indexes[i] = playhead + i
//     }
//     return indexes
// }


/**
 * Finds the indexes to use for playback this process block.
 * Without applying any changes regarding playback-rate or detune.
 * @param {BlockParameters} props
 * @returns {BlockReturnState}
 */
function findIndexesNormal(props) {
    const { playhead, bufferLength, loop, loopStartSamples, loopEndSamples } = props;

    // Determine the number of indexes needed
    let length = 128;
    if (!loop && (playhead + 128 > bufferLength)) {
        length = bufferLength - playhead;
    }

    // Preallocate array with determined length
    const indexes = new Array(length);
    let nextPlayhead;

    // Handling non-looping playback
    if (!loop) {
        for (let i = 0, head = playhead; i < length; i++, head++) {
            indexes[i] = head;
        }
        nextPlayhead = playhead + length;
        return {
            playhead: nextPlayhead,
            indexes,
            looped: false,
            ended: nextPlayhead >= bufferLength
        };
    }

    // Handling looping playback
    let head = playhead;
    let looped = false;
    for (let i = 0; i < length; i++, head++) {
        if (head >= loopEndSamples) {
            head = loopStartSamples + (head - loopEndSamples);
            looped = true;
        }
        indexes[i] = head;
    }
    nextPlayhead = head;

    return {
        indexes,
        looped,
        ended: false,
        playhead: nextPlayhead
    };
}

/**
 * Finds the indexes to use for playback this process block.
 * While considering the playback-rate.
 * @returns {number[]}
 */
function findPLayindexesWithPlaybackRate() {
    return []
}

/**
 * Finds the indexes to use for playback this process block.
 * While considering the detune.
 * @returns {number[]}
 */
function findPlayindexesWithDetune() {
    return []
}

/**
 * Finds the indexes to use for playback this process block.
 * While considering the playback-rate and detune.
 * @returns {number[]}
 */
function findPLayindexesWithPlaybackRateAndDetune() {
    return []
}

/**
 * @param {Float32Array[]} output0
 * @returns {number} num nans
 */
function checkNans(output0) {
    let numNans = 0
    for (let i = 0; i < output0.length; i++) {
        for (let j = 0; j < output0[i].length; j++) {
            if (isNaN(output0[i][j])) {
                numNans++
                output0[i][j] = 0
            }
        }
    }
    return numNans
}

/**
 * @param {Float32Array[]} output0
 * @param {number} fadeInSamples
 * @param {number} playedSamples
 * @param {number} ns
 */
function fadeIn(output0, fadeInSamples, playedSamples, ns) {
    const remaining = fadeInSamples - playedSamples
    const thisblock = Math.min(ns, remaining)
    for (let i = 0; i < thisblock; ++i) {
        const frac = 1 - ((remaining - i) / fadeInSamples)
        for (let ch = 0; ch < output0.length; ++ch) {
            output0[ch][i] *= frac
        }
    }
}

/**
 * @param {Float32Array[]} output0
 * @param {number} fadeSamples
 * @param {number} remaining
 * @param {number} fadeOutSamples
 * @param {number} ns
 */
function fadeOut(output0, fadeSamples, remaining, fadeOutSamples, ns) {
    for (let i = 0; i < fadeSamples; ++i) {
        const frac = (remaining - i) / fadeOutSamples
        for (let ch = 0; ch < output0.length; ++ch) {
            output0[ch][i] *= frac
        }
    }
    for (let i = fadeSamples; i < ns; ++i) {
        for (let ch = 0; ch < output0.length; ++ch) {
            output0[ch][i] = 0
        }
    }
}

/**
 * @param {Float32Array[]} target
 * @param {Float32Array[]} source
 * @param {number[]} indexes
 * @returns {void}
 */
function fill(target, source, indexes) {
    for (let i = 0; i < indexes.length; i++) {
        for (let ch = 0; ch < target.length; ch++) {
            target[ch][i] = source[ch][indexes[i]]
        }
    }
    for (let i = indexes.length; i < target[0].length; i++) {
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
 * @param {number} loopStartSamples
 * @param {number} loopEndSamples
 * @param {number} durationSamples
 * @param {number} sourceLength
 * @param {number} ns
 * @param {number} playedSamples
 * @param {number} playhead
 * @param {number} loopFadeInLength
 * @returns {{
 *  indexes: number[],
 *  loopFadeInindexes: number[],
 *  playhead: number
 *  ended: boolean,
 *  looped: boolean
 * }}
 */
function getPlayindexes(
    playbackRates,
    detunes,
    loop,
    loopStartSamples,
    loopEndSamples,
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
    let indexes = []
    /** @type {number[]} */
    let loopFadeInindexes = []

    for (let i = 0; i < ns; ++i) {
        if (playedSamples > durationSamples) {
            console.log('played samples ended')
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
                const crossfadeStart = loopEndSamples - loopFadeInLength
                if (loopFadeInLength > 0 && (playhead >= crossfadeStart && loopFadeInLength > 0)) {
                    const relativeToLoopStart = Math.floor(playhead - loopEndSamples)
                    const abs = loopStartSamples + relativeToLoopStart
                    loopFadeInindexes.push(abs)
                }
                if (playhead >= loopEndSamples) {
                    playhead = loopStartSamples
                    looped = true
                }
            // if reversed, maybe go to loop end
            } else if (rate < 0) {
                const crossfadeStart = loopStartSamples + loopFadeInLength
                if (loopFadeInLength > 0 && (playhead <= crossfadeStart && loopFadeInLength > 0)) {
                    const relativeToLoopStart = Math.floor(playhead - loopStartSamples)
                    const abs = loopStartSamples + relativeToLoopStart
                    loopFadeInindexes.push(abs)
                }
                if (playhead < loopStartSamples) {
                    playhead = loopEndSamples
                    looped = true
                }
            }
        // Handle stopping at the buffer's ends
        } else if ((rate > 0 && playhead >= sourceLength) || (rate < 0 && playhead < 0)) {
            console.log('ended at buffer ends')
            ended = true
            break
        }

        // const index = Math.floor(playhead -1)
        const index = Math.max(Math.floor(playhead -1), 0)
        indexes.push(index)

        // Update playhead position
        playhead += rate;
    }
    return {
        indexes,
        loopFadeInindexes,
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


// function calcLowpassCoefficients(cutoff, sampleRate) {
//     // Constants for a simple lowpass filter (not specifically Butterworth)
//     const w0 = 2 * Math.PI * cutoff / sampleRate;
//     const alpha = Math.sin(w0) / 2;
//     // Coefficients for a generic lowpass filter
//     const b0 = (1 - Math.cos(w0)) / 2;
//     const b1 = 1 - Math.cos(w0);
//     const b2 = (1 - Math.cos(w0)) / 2;
//     const a0 = 1 + alpha;
//     const a1 = -2 * Math.cos(w0);
//     const a2 = 1 - alpha;
//     const x = arr[i]; // Current sample
//     // IIR filter equation
//     const y = (b0/a0)*x + (b1/a0)*x_1 + (b2/a0)*x_2 - (a1/a0)*y_1 - (a2/a0)*y_2;
//     // Update states
//     x_2 = x_1;
//     x_1 = x;
//     y_2 = y_1;
//     y_1 = y;
// }

// Pre-filtering state
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}[]} */
const lowpassStates = [{ x_1: 0, x_2: 0, y_1: 0, y_2: 0 }, { x_1: 0, x_2: 0, y_1: 0, y_2: 0 }];
/**
 * @param {Float32Array[]} buffer
 * @param {Float32Array} cutoffs
 */
function lowpassFilter(buffer, cutoffs) {
    for (let channel = 0; channel < buffer.length; channel++) {
        const arr = buffer[channel];
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

            const h0 = b0/a0;
            const h1 = b1/a0;
            const h2 = b2/a0;
            const h3 = a1/a0;
            const h4 = a2/a0;

            for (let i = 0; i < arr.length; i++) {
                const x = arr[i]; // Current sample
                // IIR filter equation
                const y = h0*x + h1*x_1 + h2*x_2 - h3*y_1 - h4*y_2;
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
    }
}

// Pre-filtering state for highpass
/** @type {{x_1: number, x_2: number, y_1: number, y_2: number}[]} */
const highpassStates = [{ x_1: 0, x_2: 0, y_1: 0, y_2: 0 }, { x_1: 0, x_2: 0, y_1: 0, y_2: 0 }];
/**
 * @param {Float32Array[]} buffer
 * @param {Float32Array} cutoffs
 */
function highpassFilter(buffer, cutoffs) {
    for (let channel = 0; channel < buffer.length; channel++) {
        const arr = buffer[channel];
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
    }
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

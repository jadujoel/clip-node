// /** @type {AudioBufferSourceNode} */
export class ClipNode extends AudioWorkletNode {
    /**
     * @param {AudioContext} context
     * @param {ClipWorkletOptions} options
     * */
    constructor(context, {
        numberOfInputs = 0,
        outputChannelCount = [2],
        processorOptions,
        channelCount,
        channelCountMode,
        channelInterpretation,
        numberOfOutputs,
        parameterData
    } = {}) {
        super(context, 'ClipProcessor', {
            numberOfInputs,
            outputChannelCount,
            processorOptions,
            channelCount,
            channelCountMode,
            channelInterpretation,
            numberOfOutputs,
            parameterData,
        });
        /** @type {TypedAudioParamMap<'playbackRate' | 'detune' | 'highpass' | 'lowpass' | 'gain'  | 'pan'>} */
        // @ts-ignore
        this.parameters
        this.sampleRate = context.sampleRate; // You might need this for calculations
        /** @type {(() => void) | undefined} */
        this.onscheduled = undefined
        /** @type {(() => void) | undefined} */
        this.onstarted = undefined
        /** @type {(() => void) | undefined} */
        this.onpaused = undefined
        /** @type {(() => void) | undefined} */
        this.onresumed = undefined
        /** @type {(() => void) | undefined} */
        this.onended = undefined
        /** @type {(() => void) | undefined} */
        this.onlooped = undefined
        /** @type {(() => void) | undefined} */
        this.onstopped = undefined
        /** @type {((data: readonly [currentTime: number, currentFrame: number, playhead: number, timeTaken: number]) => void) | undefined} */
        this.onframe = undefined
        /** @type {(() => void) | undefined} */
        this.ondisposed = undefined

        /** @type {((state: string) => void) | undefined} */
        this.onstatechange = undefined
        /** @type {AudioBuffer | undefined} */
        this._buffer = audioBufferFromFloat32Array(this.context, processorOptions?.buffer)
        /** @type {number | undefined} */
        this._duration
        /** @type {number} */
        this._loopStart = 0
        /** @type {number} */
        this._loopEnd = 0
        /** @type {boolean} */
        this._loop = false
        /** @type {number} */
        this._offset = 0
        /** @type {number} */
        this._playhead = 0
        /** @type {number} */
        this._fadeIn = 0
        /** @type {number} */
        this._fadeOut = 0
        /** @type {number} */
        this._loopCrossfade = 0
        /** @type {number} */
        this._duration = -1
        /** @type {number} */
        this.timesLooped = 0
        /** @type {string} */
        this.state = 'initial'
        /** @type {string} */
        this.previousState = 'initial'
        /** @type {number} */
        this.cpu = 0
        /** @type {number} */
        this.currentTime
        /** @type {number} */
        this.currentFrame
        this.port.onmessage = this.onmessage

        console.log('clip node initialized', this)
    }

    /**
     * @param {MessageEvent} message
     */
    onmessage = message => {
        if (message.type !== "message") {
            return
        }
        const { type, data } = message.data
        if (type !== 'playhead' && type !== "frame") {
            console.log('node', type)
        }
        switch (type) {
            case 'frame':
                /** @type [number, number, number, number] */
                const [currentTime, currentFrame, playhead, timeTaken] = data
                this._playhead = playhead
                this.cpu = timeTaken
                this.currentFrame = currentFrame
                this.currentTime = currentTime
                if (this.onframe !== undefined) {
                    this.onframe(data)
                }
                break
            case 'scheduled':
                this.state = "scheduled"
                if (this.onscheduled !== undefined) {
                    this.onscheduled()
                }
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
            case 'started':
                this.state = "started"
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                if (this.onstarted !== undefined) {
                    this.onstarted()
                }
                break
            case 'stopped':
                this.state = "stopped"
                if (this.onstopped !== undefined) {
                    this.onstopped()
                }
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
            case 'paused':
                this.state = "paused"
                if (this.onpaused !== undefined) {
                    this.onpaused()
                }
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
            case 'resume':
                this.state = "resumed"
                if (this.onresumed !== undefined) {
                    this.onresumed()
                }
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
            case 'ended':
                this.state = "ended"
                if (this.onended !== undefined) {
                    this.onended()
                }
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
            case 'looped':
                this.timesLooped++
                if (this.onlooped !== undefined) {
                    this.onlooped()
                }
                break
            case 'disposed':
                this.state = "disposed"
                if (this.state !== this.previousState && this.onstatechange !== undefined) {
                    this.onstatechange(this.state)
                }
                break
        }
    }

    toggleGain(value = true) {
        this.port.postMessage({ type: 'toggleGain', data: value })
    }

    togglePlaybackRate(value = true) {
        this.port.postMessage({ type: 'togglePlaybackRate', data: value })
    }

    toggleDetune(value = true) {
        this.port.postMessage({ type: 'toggleDetune', data: value })
    }

    togglePan(value = true) {
        this.port.postMessage({ type: 'togglePan', data: value })
    }

    toggleHighpass(value = true) {
        this.port.postMessage({ type: 'toggleHighpass', data: value })
    }

    toggleLowpass(value = true) {
        this.port.postMessage({ type: 'toggleLowpass', data: value })
    }

    toggleFadeIn(value = true) {
        this.port.postMessage({ type: 'toggleFadeIn', data: value })
    }

    toggleFadeOut(value = true) {
        this.port.postMessage({ type: 'toggleFadeOut', data: value })
    }

    toggleLoopCrossfade(value = true) {
        this.port.postMessage({ type: 'toggleLoopCrossfade', data: value })
    }

    /** @returns {AudioBuffer | undefined} */
    get buffer() {
        return this._buffer;
    }

    /** @param {AudioBuffer} audioBuffer */
    set buffer(audioBuffer) {
        this._buffer = audioBuffer;
        const data = audioBuffer.numberOfChannels === 1
            ? [audioBuffer.getChannelData(0)]
            : [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)]
        this.port.postMessage({ type: 'buffer', data });
    }

    /**
     * @param {number | undefined} when
     * @param {number | undefined} offset
     * @param {number | undefined} duration
     * @returns {void}
     */
    start(when, offset, duration) {
        if (!this._buffer) {
            console.error('Buffer not set. Call node.buffer = yourAudioBuffer before starting playback.');
            return
        }
        this.port.postMessage({
            type: 'start',
            data: {
                when,
                offset,
                duration
            }
        });
    }

    /**
     * @param {number} when
     * @returns {void}
     * */
    stop(when = this.context.currentTime, initialDelay = 0, fadeOut = this._fadeOut) {
        this.port.postMessage({ type: 'stop', data: when + initialDelay + fadeOut + 0.2 });
    }

    /**
     * @param {number} when
     * @returns {void}
     **/
    pause(when = this.context.currentTime) {
        this.port.postMessage({ type: 'pause', data: when })
    }

    /**
     * @param {number} when
     * @returns {void}
     **/
    resume(when = this.context.currentTime) {
        this.port.postMessage(({ type: 'resume', data: when }))
    }

    /**
     * @param {boolean} value
     * @returns {void}
     * */
    set loop(value) {
        if (this._loop !== value) {
            this._loop = value
            this.port.postMessage({ type: 'loop', data: value })
        }
    }

    /** @returns {boolean} */
    get loop() {
        return this._loop
    }

    /**
     * @param {number} value
     * @returns {void}
     */
    set loopStart(value) {
        if (value !== this._loopStart) {
            this._loopStart = value
            this.port.postMessage({ type: 'loopStart', data: this._loopStart });
        }
    }

    /**
     * @returns {number}
     */
    get loopStart() {
        return this._loopStart
    }

    /**
     * @param {number} value
     */
    set loopEnd(value) {
        if (value !== this._loopEnd) {
            this._loopEnd = value
            this.port.postMessage({ type: 'loopEnd', data: this._loopEnd });
        }
    }

    /**
     * @returns {number}
     */
    get loopEnd() {
        return this._loopEnd
    }

    /**
     * @param {number} value
     * @returns {void}
     */
    set duration(value) {
        if (value !== this._duration) {
            this._duration = value
        }
    }

    /**
     * @returns {number}
     */
    get duration() {
        return this._duration ?? this._buffer?.duration ?? -1
    }

    /**
     * @param {number} value
     */
    set offset(value) {
        this._offset = value
    }

    /**
     * @returns {number}
     */
    get offset() {
        return this._offset
    }

    /**
     * @returns {number}
     */
    get playhead() {
        return this._playhead
    }

    /** @param {number} value */
    set playhead(value) {
        this.port.postMessage({ type: 'playhead', data: value })
    }

    /** @type {AudioParam} */
    get playbackRate() {
        return this.parameters.get('playbackRate');
    }

    /** @type {AudioParam} */
    get detune() {
        return this.parameters.get('detune');
    }

    /** @type {AudioParam} */
    get highpass() {
        return this.parameters.get('highpass')
    }

    /** @type {AudioParam} */
    get lowpass() {
        return this.parameters.get('lowpass')
    }

    /** @type {AudioParam} */
    get gain() {
        return this.parameters.get('gain')
    }

    /** @type {AudioParam} */
    get pan() {
        return this.parameters.get('pan')
    }

    /**
     * @returns {number}
     */
    get fadeIn() {
        return this._fadeIn
    }

    /** @param {number} value */
    set fadeIn(value) {
        this._fadeIn = value
        this.port.postMessage({ type: 'fadeIn', data: value })
    }

    /**
     * @returns {number}
     */
    get fadeOut() {
        return this._fadeOut
    }

    /** @param {number} value */
    set fadeOut(value) {
        this._fadeOut = value
        this.port.postMessage({ type: 'fadeOut', data: value })
    }

    /**
     * @returns {number}
     */
    get loopCrossfade() {
        return this._loopCrossfade
    }

    /**
     * @param {number} value
     **/
    set loopCrossfade(value) {
        this._loopCrossfade = value
        this.port.postMessage({ type: 'loopCrossfade', data: value })
    }

    /**
     * @returns {void}
     */
    dispose() {
        this.port.postMessage({ type: 'dispose' })
        this.port.close()
        if (this.ondisposed !== undefined) {
            this.ondisposed()
            this.ondisposed = undefined
        }
        this._buffer = undefined
        this._duration = undefined
        this.onended = undefined
        this.onframe = undefined
        this.onlooped = undefined
        this.onpaused = undefined
        this.onresumed = undefined
        this.onstarted = undefined
        this.onstopped = undefined
        this.onscheduled = undefined
        this.onstatechange = undefined
        this.state = 'disposed'
    }
}

/**
 *
 * @param {AudioBuffer | undefined} buffer
 * @returns {Float32Array[]}
 */
export function float32ArrayFromAudioBuffer(buffer) {
    if (buffer === undefined) {
        return []
    }
    const data = buffer.numberOfChannels === 1
        ? [buffer.getChannelData(0)]
        : [buffer.getChannelData(0), buffer.getChannelData(1)]
    return data
}

/**
 * @param {BaseAudioContext} context
 * @param {Float32Array[] | undefined} data
 * @returns {AudioBuffer | undefined}
 */
export function audioBufferFromFloat32Array(context, data) {
    if (data === undefined) {
        return undefined
    }
    const buffer = context.createBuffer(data.length, data[0].length, context.sampleRate)
    for (let i = 0; i < data.length; i++) {
        buffer.copyToChannel(data[i], i)
    }
    return buffer
}

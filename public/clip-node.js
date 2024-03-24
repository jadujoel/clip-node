/** @type {AudioBufferSourceNode} */
export class ClipNode extends AudioWorkletNode {
    /**
     * @param {AudioContext} context
     * @param {AudioWorkletNodeOptions} options
     * */
    constructor(context, {
        numberOfInputs = 0,
        outputChannelCount = [2],
        processorOptions = {
            sampleRate: 48000
        },
        channelCount,
        channelCountMode,
        channelInterpretation,
        numberOfOutputs,
        parameterData
    } = {}) {
        super(context, 'clip-processor', {
            numberOfInputs,
            outputChannelCount,
            processorOptions,
            channelCount,
            channelCountMode,
            channelInterpretation,
            numberOfOutputs,
            parameterData,
        });
        this._buffer = null; // To hold the AudioBuffer
        this.sampleRate = context.sampleRate; // You might need this for calculations
        /** @type {() => void | undefined} */
        this._onscheduled = undefined
        /** @type {() => void | undefined} */
        this._onstarted = undefined
        /** @type {() => void | undefined} */
        this._onpaused = undefined
        /** @type {() => void | undefined} */
        this._onresumed = undefined
        /** @type {() => void | undefined} */
        this._onended = undefined
        /** @type {() => void | undefined} */
        this._onlooped = undefined
        /** @type {() => void | undefined} */
        this._onstopped = undefined
        /** @type {() => void | undefined} */
        this._onframe = undefined
        /** @type {() => void | undefined} */
        this._onstatechange = undefined
        this._loopStart = 0
        this._loopEnd = 0
        this._loop = false
        this._offset = 0
        this._duration
        this._playhead = 0
        this._fadeIn = 0.001
        this._fadeOut = 0.001
        this.timesLooped = 0
        this.state = 'initial'
        this.previousState = 'initial'
        this.load = 0
        /** @type {number} */
        this.currentTime
        /** @type {number} */
        this.currentFrame
        this.port.onmessage = message => {
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
                    const [currentTime, currentFrame, playhead, load] = data
                    this._playhead = playhead
                    this.load = load
                    this.currentFrame = currentFrame
                    this.currentTime = currentTime
                    if (this._onframe !== undefined) {
                        this._onframe()
                    }
                    break
                case 'scheduled':
                    this.state = "scheduled"
                    if (this._onscheduled !== undefined) {
                        this._onscheduled()
                    }
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    break
                case 'started':
                    this.state = "started"
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    if (this._onstarted !== undefined) {
                        this._onstarted()
                    }
                    break
                case 'stopped':
                    this.state = "stopped"
                    if (this._onstopped !== undefined) {
                        this._onstopped()
                    }
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    break
                case 'paused':
                    this.state = "paused"
                    if (this._onpaused !== undefined) {
                        this._onpaused()
                    }
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    break
                case 'resume':
                    this.state = "resumed"
                    if (this._onresumed !== undefined) {
                        this._onresumed()
                    }
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    break
                case 'ended':
                    this.state = "ended"
                    if (this._onended !== undefined) {
                        this._onended()
                    }
                    if (this.state !== this.previousState && this._onstatechange !== undefined) {
                        this._onstatechange(this.state)
                    }
                    break
                case 'looped':
                    this.timesLooped++
                    if (this._onlooped !== undefined) {
                        this._onlooped()
                    }
                    break
            }
        }
    }

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

    /** @param {number} when  */
    stop(when = this.context.currentTime, initialDelay = 0, fadeOut = this._fadeOut) {
        this.port.postMessage({ type: 'stop', data: when + initialDelay + fadeOut + 0.2 });
    }

    /** @param {number} when  */
    pause(when = this.context.currentTime) {
        this.port.postMessage({ type: 'pause', data: when })
    }

    /** @param {number} when  */
    resume(when = this.context.currentTime) {
        this.port.postMessage(({ type: 'resume', data: when }))
    }

    /** @param {boolean} */
    set loop(value) {
        if (this._loop !== value) {
            this._loop = value
            this.port.postMessage({ type: 'loop', data: value })
        }
    }

    get loop() {
        return this._loop
    }

    /** @param {(state: string) => void} callback */
    set onstatechange(callback) {
        this._onstatechange = callback
    }

    get onstatechange() {
        return this._onstatechange
    }

    /**
     * @param {number} value
     */
    set loopStart(value) {
        if (value !== this._loopStart) {
            this._loopStart = Math.max(Math.min(value, this._loopEnd - 0.1), 0)
            this.port.postMessage({ type: 'loopStart', data: this._loopStart });
        }
    }

    get loopStart() {
        return this._loopStart
    }

    /**
     * @param {number} value
     */
    set loopEnd(value) {
        if (value !== this._loopEnd) {
            this._loopEnd = Math.min(Math.max(value, this._loopStart + 0.1), this._buffer.duration)
            this.port.postMessage({ type: 'loopEnd', data: this._loopEnd });
        }
    }

    get loopEnd() {
        return this._loopEnd
    }

    /**
     * @param {number} value
     */
    set duration(value) {
        if (value !== this._duration) {
            this._duration = value
            this.port.postMessage({ type: 'duration', data: value })
        }
    }

    get duration() {
        return this._duration ?? this._buffer.duration
    }

    /**
     * @param {number} value
     */
    set offset(value) {
        if (value === this._offset) {
            return
        }
        if (value < 0) {
            this._offset = Math.max(-this._buffer.duration, value)
        } else {
            this._offset = Math.min(this._buffer.duration, value)
        }
        this.port.postMessage({ type: 'offset', data: this._offset })
    }

    get offset() {
        return this._offset
    }

    get onended() {
        return this.onended
    }

    /** @type {() => unknown} */
    set onended(callback) {
        this._onended = callback
    }

    get onlooped() {
        return this._onlooped
    }

    /** @type {() => unknown} */
    set onlooped(callback) {
        this._onlooped = callback
    }

    get onframe() {
        return this._onframe
    }

    set onframe(callback) {
        this._onframe = callback
    }

    get playhead() {
        return this._playhead
    }

    /** @param {number} value */
    set playhead(value) {
        let clamped = Math.min(Math.max(0, value), this._buffer.length)
        this.port.postMessage({ type: 'playhead', data: clamped })
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

    get fadeIn() {
        return this._fadeIn
    }

    /** @param {number} value */
    set fadeIn(value) {
        this._fadeIn = value
        this.port.postMessage({ type: 'fadeIn', data: value })
    }

    get fadeOut() {
        return this._fadeOut
    }

    /** @param {number} value */
    set fadeOut(value) {
        this._fadeOut = value
        this.port.postMessage({ type: 'fadeOut', data: value })
    }
}

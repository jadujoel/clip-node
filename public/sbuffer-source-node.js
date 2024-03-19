

const State = {
    Initial: 0,
    Started: 1,
    Stopped: 2,
    Paused: 3,
}

/** @type {AudioBufferSourceNode} */
export class SBufferSourceNode extends AudioWorkletNode {
    /** @param {AudioContext} audioContext */
    constructor(audioContext) {
        super(audioContext, 'sbuffer-source-processor', { numberOfInputs: 0, outputChannelCount: [2] });
        this._buffer = null; // To hold the AudioBuffer
        this.sampleRate = audioContext.sampleRate; // You might need this for calculations
        this._onended = () => {}
        this._loopStart = 0
        this._loopEnd = 0
        this._loop = false
        this._duration = 0
        this.timesLooped = 0
        this.playhead = 0
        this.state = State.Initial
        this.port.onmessage = message => {
            if (message.type !== "message") {
                return
            }
            const { type, data } = message.data
            switch (type) {
                case 'playhead':
                    this.playhead = data
                    break
                case 'ended':
                    this._onended()
                    break
                case 'looped':
                    this.timesLooped++
                    break
                case 'started':
                    this.state = State.Started
                    break
                case 'stopped':
                    this.state = State.Stopped
                    break
                case 'paused':
                    this.state = State.Paused
                    break
                case 'resume':
                    this.state = State.Started
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
     * @param {number} when
     * @param {number} offset
     * @param {number} duration
     */
    start(when, offset, duration) {
        if (!this._buffer) {
            console.error('Buffer not set. Call node.buffer = yourAudioBuffer before starting playback.');
            return
        }
        this.port.postMessage({
            type: 'start',
            data: {
                offset: offset,
                duration: duration
            }
        });
    }

    /** @param {number} when  */
    stop(when = this.context.currentTime) {
        this.port.postMessage({ type: 'stop', data: when });
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
        this._loop = value
        this.port.postMessage({ type: 'loop', data: value })
    }

    get loop() {
        return this._loop
    }

    /**
     * @param {number} value
     */
    set loopStart(value) {
        this._loopStart = value;
        this.port.postMessage({ type: 'loopStart', data: value });
    }

    get loopStart() {
        return this._loopStart
    }

    /**
     * @param {number} value
     */
    set loopEnd(value) {
        this._loopEnd = value;
        this.port.postMessage({ type: 'loopEnd', data: value });
    }

    get loopEnd() {
        return this._loopEnd
    }

    /**
     * @param {number} value
     */
    set duration(value) {
        this._duration = value
        this.port.postMessage({ type: 'duration', data: value })
    }

    get duration() {
        return this._duration
    }

    get onended() {
        return this.onended
    }

    /** @type {() => unknown} */
    set onended(callback) {
        this._onended = callback
    }

    /** @returns {Promise<number>} */
    async getPlayhead() {
        return new Promise(resolve => {
            this.port.addEventListener('message', event => {
                resolve(event.data.data)
            }, { once: true })
            this.port.postMessage({ type: 'playhead' })
        })
    }

    /** @type {AudioParam} */
    get playbackRate() {
        return this.parameters.get('playbackRate');
    }

    /** @type {AudioParam} */
    get detune() {
        return this.parameters.get('detune');
    }
}

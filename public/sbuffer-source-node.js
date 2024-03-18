


/** @type {AudioBufferSourceNode} */
export class SBufferSourceNode extends AudioWorkletNode {
    /** @param {AudioContext} audioContext */
    constructor(audioContext) {
        super(audioContext, 'sbuffer-source-processor');
        this._buffer = null; // To hold the AudioBuffer
        this.sampleRate = audioContext.sampleRate; // You might need this for calculations
        this.port.onmessage = (event) => {
            console.log(event.data)
        };
        this._onended = () => {}
        this._loopStart = 0
        this._loopEnd = 0
        this._loop = false
        this._duration = 0
    }

    get buffer() {
        return this._buffer;
    }

    /** @param {AudioBuffer} audioBuffer */
    set buffer(audioBuffer) {
        this._buffer = audioBuffer;
        // Convert AudioBuffer to Float32Array and send it to the processor via the message port
        // Note: This simplistic approach sends only the first channel of the buffer
        const channelData = audioBuffer.getChannelData(0);
        this.port.postMessage({ type: 'buffer', data: channelData });
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
        this.port.onmessage({ type: 'ended' }, callback)
    }

    /** @returns {Promise<number>} */
    async getPlayhead() {
        return new Promise(resolve => {
            this.port.addEventListener('playhead', event => {
                resolve(event.data)
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

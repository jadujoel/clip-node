/// <reference path="../AudioWorklet.d.ts" />


console.log('clip processor entry')

class PassProcessor extends AudioWorkletProcessor {
     /**
     * @param {ClipWorkletOptions | undefined} options
     */
     constructor(options) {
        super(options);
     }
    process() {
      return false
    }
}


console.log('registered processor', PassProcessor)
registerProcessor('pass-processor', PassProcessor);

type ClipProcessorOnmessage = (ev: MessageEvent<ClipProcessorMessageRx>) => void

interface ClipProcessorStateMap {
  readonly Initial: 0,
  readonly Started: 1,
  readonly Stopped: 2,
  readonly Paused: 3,
  readonly Scheduled: 4,
  readonly Ended: 5,
  readonly Disposed: 6
}

type ClipProcessorState = ClipProcessorStateMap[keyof ClipProcessorStateMap]

interface ClipWorkletOptions extends AudioWorkletNodeOptions {
  readonly processorOptions?: ClipProcessorOptions
}

interface ClipProcessorOptions {
  readonly buffer?: Float32Array[],
  readonly loop?: boolean,
  readonly loopStart?: number,
  readonly loopEnd?: number,
  readonly offset?: number,
  readonly duration?: number,
  readonly playhead?: number,
  readonly state?: ClipProcessorState
  readonly startWhen?: number
  readonly stopWhen?: number
  readonly pauseWhen?: number
  readonly resumeWhen?: number
  readonly playedSamples?: number
  readonly timesLooped?: number
  readonly fadeInDuration?: number
  readonly fadeOutDuration?: number
  readonly crossfadeDuration?: number
}

type ClipProcessorMessageRx
  = ClipProcessorBufferMessageRx
  | ClipProcessorStartMessageRx
  | ClipProcessorStopMessageRx
  | ClipProcessorPauseMessageRx
  | ClipProcessorResumeMessageRx
  | ClipProcessorDisposeMessageRx
  | ClipProcessorLoopMessageRx
  | ClipProcessorLoopStartMessageRx
  | ClipProcessorLoopEndMessageRx
  | ClipProcessorPlayheadMessageRx
  | ClipProcessorOffsetMessageRx
  | ClipProcessorFadeInMessageRx
  | ClipProcessorFadeOutMessageRx
  | ClipProcessorLoopCrossfadeMessageRx

type ClipProcessorMessageType
  = 'buffer'
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'dispose'
  | 'loop'
  | 'loopStart'
  | 'loopEnd'
  | 'playhead'
  | 'playbackRate'
  | 'offset'
  | 'fadeIn'
  | 'fadeOut'
  | 'loopCrossfade'

interface ClipProcessorBufferMessageRx {
  readonly type: 'buffer',
  readonly data: Float32Array[]
}

interface ClipProcessorStartMessageRx {
  readonly type: 'start',
  readonly data?: {
    readonly duration?: number,
    readonly offset?: number,
    readonly when?: number
  }
}

interface ClipProcessorStopMessageRx {
  readonly type: 'stop',
  readonly data?: number
}

interface ClipProcessorPauseMessageRx {
  readonly type: 'pause',
  readonly data?: number
}

interface ClipProcessorResumeMessageRx {
  readonly type: 'resume',
  readonly data?: number
}

interface ClipProcessorDisposeMessageRx {
  readonly type: 'dispose'
  readonly data?: never
}

interface ClipProcessorLoopMessageRx {
  readonly type: 'loop',
  readonly data: boolean
}

interface ClipProcessorLoopStartMessageRx {
  readonly type: 'loopStart',
  readonly data: number
}

interface ClipProcessorLoopEndMessageRx {
  readonly type: 'loopEnd',
  readonly data: number
}

interface ClipProcessorPlayheadMessageRx {
  readonly type: 'playhead',
  readonly data: number
}

interface ClipProcessorOffsetMessageRx {
  readonly type: 'offset',
  readonly data: number
}

interface ClipProcessorFadeInMessageRx {
  readonly type: 'fadeIn',
  readonly data: number
}

interface ClipProcessorFadeOutMessageRx {
  readonly type: 'fadeOut',
  readonly data: number
}

interface ClipProcessorLoopCrossfadeMessageRx {
  readonly type: 'loopCrossfade',
  readonly data: number
}

import { ClipNode } from './clip-node.js';

const elements = {
  /** @type {HTMLButtonElement} */
  start: document.getElementById("start"),
  /** @type {HTMLButtonElement} */
  stop: document.getElementById("stop"),
  /** @type {HTMLButtonElement} */
  pause: document.getElementById("pause"),
  /** @type {HTMLButtonElement} */
  resume: document.getElementById("resume"),
  /** @type {HTMLInputElement} */
  loop: document.getElementById("loop"),
  /** @type {HTMLInputElement} */
  loopStart: document.getElementById("loopStart"),
  /** @type {HTMLOutputElement} */
  loopStartValue: document.getElementById("loopStartValue"),
  /** @type {HTMLInputElement} */
  loopEnd: document.getElementById("loopEnd"),
  /** @type {HTMLOutputElement} */
  loopEndValue: document.getElementById("loopEndValue"),
  /** @type {HTMLInputElement} */
  playBackRate: document.getElementById("playbackRate"),
  /** @type {HTMLOutputElement} */
  playBackRateValue: document.getElementById("playbackRateValue"),
  /** @type {HTMLInputElement} */
  detune: document.getElementById("detune"),
  /** @type {HTMLOutputElement} */
  detuneValue: document.getElementById("detuneValue"),
  /** @type {HTMLInputElement} */
  offset: document.getElementById('offset'),
  /** @type {HTMLOutputElement} */
  offsetValue: document.getElementById('offsetValue'),
  /** @type {HTMLInputElement} */
  duration: document.getElementById('duration'),
  /** @type {HTMLOutputElement} */
  durationValue: document.getElementById('durationValue'),

  /** @type {HTMLOutputElement} */
  timesLooped: document.getElementById('timesLooped'),

  /** @type {HTMLInputElement} */
  playhead: document.getElementById('playhead'),
  /** @type {HTMLOutputElement} */
  playheadValue: document.getElementById('playheadValue'),

  /** @type {HTMLInputElement} */
  startDelay: document.getElementById('startDelay'),
  /** @type {HTMLOutputElement} */
  startDelayValue: document.getElementById('startDelayValue'),
  /** @type {HTMLInputElement} */
  stopDelay: document.getElementById('stopDelay'),
  /** @type {HTMLOutputElement} */
  stopDelayValue: document.getElementById('stopDelayValue'),

  /** @type {HTMLInputElement} */
  gain: document.getElementById('gain'),
  /** @type {HTMLOutputElement} */
  gainValue: document.getElementById('gainValue'),

  /** @type {HTMLInputElement} */
  pan: document.getElementById('pan'),
  /** @type {HTMLOutputElement} */
  panValue: document.getElementById('panValue'),

  /** @type {HTMLInputElement} */
  lowpass: document.getElementById('lowpass'),
  /** @type {HTMLOutputElement} */
  lowpassValue: document.getElementById('lowpassValue'),
  /** @type {HTMLInputElement} */
  highpass: document.getElementById('highpass'),
  highpassValue: document.getElementById('highpassValue'),

  /** @type {HTMLOutputElement} */
  state: document.getElementById('state'),
  /** @type {HTMLOutputElement} */
  fps: document.getElementById('fps'),
  /** @type {HTMLOutputElement} */
  currentTime: document.getElementById('currentTime'),
  /** @type {HTMLOutputElement} */
  currentFrame: document.getElementById('currentFrame'),
}

for (const [name, element] of Object.entries(elements)) {
  if (element === null) {
    throw new Error(`Element ${name} not found`)
  }
}

document.addEventListener('click', start, { once: true })

const sampleRate = 48000
const context = new AudioContext({ sampleRate});
const addModulePromise = context.audioWorklet.addModule('clip-processor.js');
const bufferPromise = decode('lml.webm', context)

async function start() {
  await addModulePromise
  await context.resume()
  const node = new ClipNode(context);
  const buffer = await bufferPromise

  node.connect(context.destination)

  elements.duration.value = -1
  elements.offset.max = buffer.duration
  elements.offset.value = 0
  elements.loopEnd.max = buffer.duration
  elements.loopEnd.value = buffer.duration
  elements.loopStart.max = buffer.duration
  elements.loopStart.value = 0
  elements.loopEnd.max = buffer.duration
  elements.highpass.value = node.highpass.value
  elements.lowpass.value = node.lowpass.value
  elements.gain.value = node.gain.value
  elements.pan.value = node.pan.value = 0

  elements.start.onclick = () => node.start(
    context.currentTime + Number(elements.startDelay.value),
    Number(elements.offset.value),
    Number(elements.duration.value)
  )
  elements.stop.onclick = () => node.stop(context.currentTime + Number(elements.stopDelay.value))
  elements.pause.onclick = () => node.pause(context.currentTime + Number(elements.stopDelay.value))
  elements.resume.onclick = () => node.resume(context.currentTime + Number(elements.startDelay.value))
  elements.loop.addEventListener('click', () => {
    node.loop = Boolean(elements.loop.checked)
  })
  elements.loopStart.oninput = () => {
    node.loopStart = Number(elements.loopStart.value)
    elements.loopStartValue.value = node.loopStart.toPrecision(2)
  }
  elements.loopEnd.oninput = () => {
    node.loopEnd = Number(elements.loopEnd.value)
    elements.loopEndValue.value = node.loopEnd.toPrecision(2)
  }
  elements.playBackRate.oninput = () => {
    node.playbackRate.value = Number(elements.playBackRate.value)
    elements.playBackRateValue.value = node.playbackRate.value.toPrecision(2)
  }
  elements.detune.oninput = () => {
    node.detune.value = Number(elements.detune.value)
    elements.detuneValue.value = node.detune.value
  }

  elements.offset.oninput = () => {
    node.offset = Number(elements.offset.value)
    elements.offsetValue.value = node.offset
  }

  elements.duration.oninput = () => {
    node.duration = Number(elements.duration.value)
    elements.durationValue.value = node.duration
  }

  elements.lowpass.oninput = () => {
    node.lowpass.value = Number(elements.lowpass.value)
    elements.lowpassValue.value = node.lowpass.value
  }

  elements.highpass.oninput = () => {
    node.highpass.value = Number(elements.highpass.value)
    elements.highpassValue.value = node.highpass.value
  }

  elements.gain.oninput = () => {
    node.gain.value = Number(elements.gain.value)
    elements.gainValue.value = node.gain.value.toPrecision(2)
  }

  elements.pan.oninput = () => {
    node.pan.value = Number(elements.pan.value)
    elements.panValue.value = node.pan.value.toPrecision(2)
  }

  node.buffer = buffer
  node.loop = Boolean(elements.loop.checked)
  node.offset = Number(elements.offset.value)
  node.duration = Number(elements.duration.value)
  node.loopStart = Number(elements.loopStart.value)
  node.loopEnd = Number(elements.loopEnd.value)
  node.playbackRate.value = Number(elements.playBackRate.value)
  node.detune.value = Number(elements.detune.value)
  node.onlooped = () => {
    elements.timesLooped.value = Number(node.timesLooped)
  }

  elements.durationValue.value = elements.duration.value
  elements.offsetValue.value = elements.offset.value
  elements.loopEndValue.value = buffer.duration.toPrecision(2)
  elements.loopEndValue.value = buffer.duration.toPrecision(2)
  elements.playBackRateValue.value = node.playbackRate.value.toPrecision(2)
  elements.detuneValue.value = node.detune.value.toPrecision(2)

  elements.startDelay.oninput = () => {
    elements.startDelayValue.value = elements.startDelay.value
  }
  elements.stopDelay.oninput = () => {
    elements.stopDelayValue.value = elements.stopDelay.value
  }

  elements.playhead.oninput = () => {
    node.playhead = (Number(elements.playhead.value))
  }
  elements.playhead.min = 0
  elements.playhead.max = node._buffer.length

  node.onframe = () => {
    elements.playhead.value = node.playhead
    elements.playheadValue.value = node.playhead
    elements.fps.value = node.fps
    elements.state.value = node.state
    elements.currentTime.value = node.currentTime.toPrecision(4)
    elements.currentFrame.value = node.currentFrame
  }
}

/**
 * @param {string} url
 * @param {AudioContext} context
 */
async function decode(url, context = new AudioContext({sampleRate: 48000})) {
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(buffer => context.decodeAudioData(buffer));
}

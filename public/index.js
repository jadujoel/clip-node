import { ClipNode } from './clip-node.js';
import { AudioControl } from './audio-control.js';

const elements = {
  /** @type {HTMLOutputElement} */
  state: document.getElementById('state'),
  /** @type {HTMLOutputElement} */
  fps: document.getElementById('fps'),
  /** @type {HTMLOutputElement} */
  currentTime: document.getElementById('currentTime'),
  /** @type {HTMLOutputElement} */
  currentFrame: document.getElementById('currentFrame'),
  /** @type {HTMLOutputElement} */
  timesLooped: document.getElementById('timesLooped'),

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

  /** @type {AudioControl} */
  loopStart: document.getElementById("loopstart-control"),
  /** @type {AudioControl} */
  loopEnd: document.getElementById("loopend-control"),
  /** @type {AudioControl} */
  playBackRate: document.getElementById("playbackrate-control"),
  /** @type {AudioControl} */
  detune: document.getElementById("detune-control"),
  /** @type {AudioControl} */
  offset: document.getElementById('offset-control'),
  /** @type {AudioControl} */
  duration: document.getElementById('duration-control'),
  /** @type {AudioControl} */
  playhead: document.getElementById('playhead-control'),
  /** @type {AudioControl} */
  startDelay: document.getElementById('startdelay-control'),
  /** @type {AudioControl} */
  stopDelay: document.getElementById('stopdelay-control'),
  /** @type {AudioControl} */
  gain: document.getElementById('gain-control'),
  /** @type {AudioControl} */
  pan: document.getElementById('pan-control'),
  /** @type {AudioControl} */
  lowpass: document.getElementById('lowpass-control'),
  /** @type {AudioControl} */
  highpass: document.getElementById('highpass-control'),
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

  elements.start.onclick = () => node.start(
    context.currentTime + Number(elements.startDelay.value),
    elements.offset.value,
    elements.duration.value
  )

  elements.stop.onclick = () => node.stop(context.currentTime + Number(elements.stopDelay.value))
  elements.pause.onclick = () => node.pause(context.currentTime + Number(elements.stopDelay.value))
  elements.resume.onclick = () => node.resume(context.currentTime + Number(elements.startDelay.value))
  elements.loop.addEventListener('click', () => {
    node.loop = Boolean(elements.loop.checked)
  })
  elements.loopStart.oninput = () => {
    node.loopStart = elements.loopStart.value
  }
  elements.loopEnd.oninput = () => {
    node.loopEnd = elements.loopEnd.value
  }
  elements.playBackRate.oninput = () => {
    node.playbackRate.value = elements.playBackRate.value
  }
  elements.detune.oninput = () => {
    node.detune.value = elements.detune.value
  }

  elements.offset.oninput = () => {
    node.offset = elements.offset.value
  }

  elements.duration.oninput = () => {
    node.duration = elements.duration.value
  }

  elements.lowpass.oninput = () => {
    node.lowpass.value = elements.lowpass.value
  }

  elements.highpass.oninput = () => {
    node.highpass.value = elements.highpass.value
  }

  elements.gain.oninput = () => {
    node.gain.value = elements.gain.value
  }

  elements.pan.oninput = () => {
    node.pan.value = elements.pan.value
  }

  elements.playhead.oninput = () => {
    node.playhead = elements.playhead.value
  }

  node.onlooped = () => {
    elements.timesLooped.value = node.timesLooped
  }

  node.onframe = () => {
    elements.playhead.value = node.playhead
    elements.fps.value = node.fps
    elements.state.value = node.state
    elements.currentTime.value = node.currentTime.toPrecision(4)
    elements.currentFrame.value = node.currentFrame
  }

  elements.offset.max = buffer.duration
  elements.loopEnd.max = buffer.duration
  elements.loopStart.max = buffer.duration
  elements.playhead.max = buffer.length

  elements.loopEnd.value = buffer.duration

  elements.duration.value = -1

  elements.playBackRate.value = node.playbackRate.value
  elements.detune.value = node.detune.value
  elements.gain.value = node.gain.value
  elements.pan.value = node.pan.value
  elements.lowpass.value = node.lowpass.value
  elements.highpass.value = node.highpass.value

  node.buffer = buffer
  node.loop = Boolean(elements.loop.checked)
  node.offset = elements.offset.value
  node.duration = elements.duration.value
  node.loopStart = elements.loopStart.value
  node.loopEnd = elements.loopEnd.value
  node.playbackRate.value = elements.playBackRate.value
  node.detune.value = elements.detune.value

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

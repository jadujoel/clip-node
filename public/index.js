import { ClipNode, float32ArrayFromAudioBuffer } from './clip-node.js';
import { AudioControl } from './audio-control.js';

const infos = {
  state: getOutputElement('state'),
  currentTime: getOutputElement('currentTime'),
  currentFrame: getOutputElement('currentFrame'),
  timesLooped: getOutputElement('timesLooped'),
  latency: getOutputElement('latency'),
  timeTaken: getOutputElement('timeTaken'),
}

const states = {
  start: getButtonElement('start'),
  stop: getButtonElement('stop'),
  pause: getButtonElement('pause'),
  resume: getButtonElement('resume'),
  dispose: getButtonElement('dispose'),
}

const controls = {
  loopStart: getAudioControlElement("loopstart-control"),
  loopEnd: getAudioControlElement("loopend-control"),
  loopCrossfade: getAudioControlElement("loopcrossfade-control"),
  offset: getAudioControlElement('offset-control'),
  duration: getAudioControlElement('duration-control'),
  playhead: getAudioControlElement('playhead-control'),
  startDelay: getAudioControlElement('startdelay-control'),
  stopDelay: getAudioControlElement('stopdelay-control'),
  fadeIn: getAudioControlElement('fadein-control'),
  fadeOut: getAudioControlElement('fadeout-control'),
}

const params = {
  playBackRate: getAudioControlElement("playbackrate-control"),
  detune: getAudioControlElement("detune-control"),
  gain: getAudioControlElement('gain-control'),
  pan: getAudioControlElement('pan-control'),
  lowpass: getAudioControlElement('lowpass-control'),
  highpass: getAudioControlElement('highpass-control'),
}

const elements = {
  ...infos,
  ...states,
  loop: getInputElement("loop"),
  ...controls,
  ...params,
}

for (const [name, element] of Object.entries(elements)) {
  if (element === null) {
    throw new Error(`Element ${name} not found`)
  }
}

// window.addEventListener('click', start, { once: true })
if (!searchParamsIncludes('disable-state')) {
  loadState()
}

const sampleRate = 48000
const bufferPromise = decode('lml.webm')

elements.start.addEventListener('click', start, { once: true })

async function start() {
  const context = new AudioContext({ sampleRate })
  await context.audioWorklet.addModule('./clip-processor.js')
  const buffer = await bufferPromise
  const node = new ClipNode(context, { processorOptions: { buffer: float32ArrayFromAudioBuffer(buffer) } });
  node.connect(context.destination)

  // states
  states.start.onclick = () => {
    console.log('start')
    context.resume()

    node.start(
      context.currentTime + controls.startDelay.value,
      controls.offset.value,
      controls.duration.value
    )}
  states.stop.onclick = () => node.stop(context.currentTime + controls.stopDelay.value)
  states.pause.onclick = () => node.pause(context.currentTime + controls.stopDelay.value)
  states.resume.onclick = () => node.resume(context.currentTime + controls.startDelay.value)
  states.dispose.onclick = () => node.dispose()

  // controls
  elements.loop.addEventListener('click', () => {
    node.loop = Boolean(elements.loop.checked)
  })
  controls.loopStart.oninput = () => {
    node.loopStart = controls.loopStart.value
  }
  controls.loopEnd.oninput = () => {
    node.loopEnd = controls.loopEnd.value
  }
  // rate limit the crossfade to once every four seconds
  controls.loopCrossfade.oninput = throttle(() => {
    node.loopCrossfade = controls.loopCrossfade.value
  }, 2000)

  controls.offset.oninput = () => {
    node.offset = controls.offset.value
  }
  controls.duration.oninput = () => {
    node.duration = controls.duration.value
  }
  controls.playhead.oninput = () => {
    node.playhead = controls.playhead.value
  }
  controls.fadeIn.oninput = () => {
    node.fadeIn = controls.fadeIn.value
  }
  controls.fadeOut.oninput = () => {
    node.fadeOut = controls.fadeOut.value
  }

  controls.offset.max = buffer.duration
  controls.loopEnd.max = buffer.duration
  controls.loopStart.max = buffer.duration
  controls.fadeIn.max = buffer.duration
  controls.fadeOut.max = buffer.duration
  controls.playhead.max = buffer.length
  controls.duration.value = -1

  //params
  params.playBackRate.oninput = () => {
    node.playbackRate.value = params.playBackRate.value
  }
  params.detune.oninput = () => {
    node.detune.value = params.detune.value
  }
  params.lowpass.oninput = () => {
    node.lowpass.value = params.lowpass.value
  }
  params.highpass.oninput = () => {
    node.highpass.value = params.highpass.value
  }
  params.gain.oninput = () => {
    node.gain.value = params.gain.value
  }
  params.pan.oninput = () => {
    node.pan.value = params.pan.value
  }

  // infos
  infos.latency.value = context.outputLatency?.toString()
  node.onstatechange = () => {
    infos.state.value = node.state
  }
  node.onlooped = () => {
    infos.timesLooped.value = node.timesLooped.toString()
  }
  node.onframe = ([currentTime, currentFrame, playhead, timeTaken]) => {
    controls.playhead.value = playhead
    infos.currentTime.value = currentTime.toPrecision(4)
    infos.currentFrame.value = currentFrame.toString()
    infos.timeTaken.value = timeTaken.toFixed(4)
    const timestamp = context.getOutputTimestamp()
    const output = Math.round(context.outputLatency * context.sampleRate)
    const base = Math.round(context.baseLatency * context.sampleRate)
    const total = Math.round((context.currentTime - (timestamp.contextTime ?? 0)) * context.sampleRate)
    const ms = (total / context.sampleRate * 1000).toFixed(0)
    infos.latency.value = `base: ${base} | output: ${output} | total: ${total} Samples = ${ms} Milliseconds`
  }
  node.addEventListener('processorerror', (e) => {
    console.error('node error', e)
  })

  node.loop = elements.loop.checked
  node.loopStart = controls.loopStart.value
  node.loopEnd = controls.loopEnd.value
  node.loopCrossfade = controls.loopCrossfade.value
  node.offset = controls.offset.value
  node.duration = controls.duration.value
  node.playhead = controls.playhead.value
  node.fadeIn = controls.fadeIn.value
  node.fadeOut = controls.fadeOut.value
  node.duration = controls.duration.value

  node.playbackRate.value = params.playBackRate.value
  node.detune.value = params.detune.value
  node.lowpass.value = params.lowpass.value
  node.highpass.value = params.highpass.value
  node.gain.value = params.gain.value
  node.pan.value = params.pan.value
  infos.state.value = "initial"

  for (const [name, value] of Object.entries(infos)) {
    value.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      console.log('context menu', name, value)
    })
  }
  loadState()

}

if (!searchParamsIncludes('disable-state')) {
  window.addEventListener('beforeunload', () => {
    saveState()
  })
}

function saveState() {
  /** @type {Record<string, { value: number, snap: string, tempo: number, min: number, max: number, unit: 'string'}>} */
  let state = {}
  for (const [name, element] of Object.entries({...controls, ...params})) {
    state[name] = {
      value: element.value,
      snap: element.snap,
      tempo: element.tempo,
      min: element.min,
      max: element.max,
      // @ts-ignore
      unit: element.unit,
    }
  }
  localStorage.setItem('clip-node-state', JSON.stringify(state))
  console.log('saved state', state)
}

function loadState() {
  /** @type {Record<string, { value: number, snap: string, tempo: number, min: number, max: number, unit: string}>} */
  let states = JSON.parse(localStorage.getItem('clip-node-state') ?? '{}')
  for (const [name, {value, snap, tempo, min, max, unit}] of Object.entries(states)) {
    /** @type {elements[keyof typeof elements] | undefined} */
    // @ts-ignore
    const el = elements[name]
    if (el === undefined) {
      continue
    }
    // @ts-ignore
    el.snap = snap
    // @ts-ignore
    el.tempo = tempo
    // @ts-ignore
    el.min = min
    // @ts-ignore
    el.max = max
    // @ts-ignore
    el.unit = unit

    el.value = value
  }
  console.log('loaded state', states)
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

// Throttle function
/**
 * @param {() => void} callback
 * @param {number} limit
 */
function throttle(callback, limit) {
  /** @type {boolean | undefined} */
  let inThrottle;
  return function() {
    const args = arguments;
    // @ts-ignore
    const context = this;
    if (!inThrottle) {
      // @ts-ignore
      callback.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}


/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function getEl(id) {
  const el = document.getElementById(id)
  if (el === null) {
    throw new Error(`Element ${id} not found`)
  }
  return el
}

/**
 * @param {string} id
 * @returns {HTMLInputElement}
 * @throws {Error}
 */
function getInputElement(id) {
  const el = document.getElementById(id)
  if (el?.tagName === 'INPUT') {
    // @ts-ignore
    return el
  }
  throw new Error(`Element ${id} is not an input element`)
}

/**
 * @param {string} id
 * @returns {HTMLOutputElement}
 * @throws {Error}
 */
function getOutputElement(id) {
  const el = document.getElementById(id)
  if (el?.tagName === 'OUTPUT') {
    // @ts-ignore
    return el
  }
  throw new Error(`Element ${id} is not an output element`)
}

/**
 * @param {string} id
 * @returns {HTMLButtonElement}
 * @throws {Error}
 */
function getButtonElement(id) {
  const el = document.getElementById(id)
  if (el?.tagName === 'BUTTON') {
    // @ts-ignore
    return el
  }
  throw new Error(`Element ${id} is not a button element`)
}

/**
 * @param {string} id
 * @returns {AudioControl}
 */
function getAudioControlElement(id) {
  const el = document.getElementById(id)
  if (el?.tagName === 'AUDIO-CONTROL') {
    // @ts-ignore
    return el
  }
  throw new Error(`Element ${id} is not an audio control element`)
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function searchParamsIncludes(key) {
  return new URLSearchParams(window.location.search).has(key)
}

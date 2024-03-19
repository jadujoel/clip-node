import { SBufferSourceNode } from './sbuffer-source-node.js'

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

  /** @type {HTMLButtonElement} */
  playhead: document.getElementById("playhead"),
}

document.addEventListener('click', start, { once: true })
async function start() {
  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule('sbuffer-source-processor.js');
  const node = new SBufferSourceNode(audioContext);
  const file = "https://alive.evolutiongaming.com/frontend/gametech/sounds/rage/desktop/bigWinIntro.webm"
  const buffer = await decode(audioContext, file)
  node.buffer = buffer


  const lp = audioContext.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 10000

  node.connect(lp).connect(audioContext.destination)

  elements.loopStart.max = buffer.duration
  elements.loopEnd.max = buffer.duration

  elements.playhead.onclick = () => {
    console.log(node.playhead)
    node.getPlayhead().then((head) => {
      console.log('current playhead is', head)
    })
  }

  elements.start.onclick = () => node.start()
  elements.stop.onclick = () => node.stop()
  elements.pause.onclick = () => node.pause()
  elements.resume.onclick = () => node.resume()
  elements.loop.addEventListener('click', () => {
    node.loop = Boolean(elements.loop.checked)
    console.log(node.loop)
  })
  elements.loopStart.oninput = () => {
    elements.loopStartValue.value = elements.loopStart.value
    node.loopStart = Number(elements.loopStart.value)
  }
  elements.loopEnd.oninput = () => {
    elements.loopEndValue.value = elements.loopEnd.value
    node.loopEnd = Number(elements.loopEnd.value)
  }
  elements.playBackRate.oninput = () => {
    elements.playBackRateValue.value = elements.playBackRate.value
    node.playbackRate.value = Number(elements.playBackRate.value)
  }
  elements.detune.oninput = () => {
    elements.detuneValue.value = elements.detune.value
    node.detune.value = Number(elements.detune.value)
  }
}


/**
 * @param {AudioContext} context
 * @param {string} url
 */
async function decode(context, url) {
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(buffer => context.decodeAudioData(buffer));
}

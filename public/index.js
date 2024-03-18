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
}
const audioContext = new AudioContext();

start()
async function start() {
  await audioContext.audioWorklet.addModule('sbuffer-source-processor.js');
  const node = new SBufferSourceNode(audioContext);
  const file = "https://alive.evolutiongaming.com/frontend/gametech/sounds/rage/desktop/bigWinIntro.webm"
  const buffer = await decode(audioContext, file)
  elements.loopStart.max = buffer.duration
  elements.loopEnd.max = buffer.duration

  node.connect(audioContext.destination)
  node.buffer = buffer

  elements.start.onclick = () => node.start()
  elements.stop.onclick = () => node.stop()
  elements.pause.onclick = () => node.pause()
  elements.resume.onclick = () => node.resume()
  elements.loop.addEventListener('click', () => {
    node.loop = Boolean(elements.loop.checked)
    console.log(node.loop)
  })
  elements.loopStart.oninput = () => {
    node.loopStart = elements.loopStartValue.value = elements.loopStart.value
  }
  elements.loopEnd.oninput = () => {
    node.loopEnd = elements.loopEndValue.value = elements.loopEnd.value
  }
  elements.playBackRate.oninput = () => {
    node.playbackRate.value = elements.playBackRateValue.value = elements.playBackRate.value
  }
  elements.detune.oninput = () => {
    node.detune.value = elements.detuneValue.value = elements.detune.value
  }
}

function stop() {
  audioContext.close()
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

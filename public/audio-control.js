/** @type {typeof document.createElement} */
const create = document.createElement.bind(document)

export class AudioControl extends HTMLElement {
  constructor() {
    super(); // Always call super first in constructor
    this.attachShadow({ mode: 'open' }); // Attach a shadow DOM tree to the custom element
    this.elements = {
      label: create('label'),
      snap: create('select'),
      input: create('input'),
      output: create('output'),
    }
    const noneSelection = create('option')
    noneSelection.value = 'none'
    noneSelection.textContent = 'None'
    const barSelection = create('option')
    barSelection.value = 'bar'
    barSelection.textContent = 'Bar'
    const beatSelection = create('option')
    beatSelection.value = 'beat'
    beatSelection.textContent = 'Beat'
    const eighthSelection = create('option')
    eighthSelection.value = '8th'
    eighthSelection.textContent = '8th'
    const sixteenthSelection = create('option')
    sixteenthSelection.value = '16th'
    sixteenthSelection.textContent = '16th'
    this.elements.snap.append(noneSelection, beatSelection, barSelection, eighthSelection, sixteenthSelection)

    this.snap = this.getAttribute('snap') ?? 'none'
    /** @type {HTMLOptionElement | null} */
    const selected = this.elements.snap.querySelector(`option[value="${this.snap}"]`)
    if (selected !== null) {
      selected.selected = true
    }

    this.elements.snap.addEventListener('change', (e) => {
      // @ts-ignore
      this.snap = e.target?.value
    })
    this.elements.snap.setAttribute('part', 'select');

    this.tempo = Number(this.getAttribute('tempo') ?? 120)

    const { label, input, output } = this.elements

    // Get attributes
    let id = this.id
    if (!id) {
      id = this.label.toLowerCase().replace(/\s/g, "-") + "-control";
      this.id = id
    }

    label.textContent = this.label
    label.setAttribute('part', 'label');

    input.type = 'range'
    input.value = this.value.toString()
    input.step = this.step
    input.min = this.min.toString()
    input.max = this.max.toString()
    input.setAttribute('part', 'input');

    output.value = this.value.toString()
    output.textContent = this.value.toString()
    output.setAttribute('part', 'output');

    /**
     * @param {Event} e
     */
    const updateValue = (e) => {
      // @ts-ignore
      const value = getSnappedValue(Number(e.target.value), this.snap, this.tempo)
      this.setAttribute('value', value.toString())
      const index = getClosestSnapIndex(value, this.snap, this.tempo)
      const precise = this.snap === 'none' ? value : index
      output.value = precise.toString()
    }
    // Add event listener to update output
    input.addEventListener('input', updateValue);

    // @ts-ignore
    this.shadowRoot.append(...Object.values(this.elements))
  }

  connectedCallback() {

  }

  // /** @param value {number} */
  set value(newValue) {
    const value = getSnappedValue(Number(newValue), this.snap, this.tempo)
    const index = getClosestSnapIndex(value, this.snap, this.tempo)
    const precise = this.snap === 'none' ? value : index
    this.elements.input.value = value.toString()
    this.elements.output.value = precise.toString()
    this.setAttribute('value', value.toString())
  }

  /** @param value {number} */
  // set value(value) {
  //   this.elements.input.value = value
  //   this.elements.output.value = value.toPrecision(this.precision)
  //   this.setAttribute('value', value)
  // }

  static get observedAttributes() {
    return ['value'];
  }

  /**
   * @param name {string}
   * @param oldValue {string}
   * @param newValue {string | number}
   */
  attributeChangedCallback() {
  }

  /** @param {number} value */
  set precision(value) {
    this.setAttribute('precision', value.toString())
    this.value = Number(value.toPrecision(value))
  }

  get precision() {
    return Number(this.getAttribute('precision') ?? 5)
  }

  get value() {
    return Number(this.getAttribute('value'))
  }

  get min() {
    return Number(this.getAttribute('min') ?? 0)
  }

  /** @param value {number} */
  set min(value) {
    const str = value.toString()
    this.elements.input.min = str
    this.setAttribute('min', str)
  }

  get max() {
    return Number(this.getAttribute('max') ?? 1)
  }

  /** @param value {number} */
  set max(value) {
    const str = value.toString()
    this.elements.input.max = str
    this.setAttribute('max', str)
  }

  get label() {
    return this.getAttribute('label') ?? ""
  }

  /** @param value {string} */
  set label(value) {
    this.elements.label.textContent = value
    this.setAttribute('label', value)
  }

  set step(value) {
    this.elements.input.step = value
    this.setAttribute('step', value)
  }

  get step() {
    return this.getAttribute('step') ?? '0.001'
  }

  get snap() {
    return this.getAttribute('snap') ?? 'none'
  }

  set snap(value) {
    this.setAttribute('snap', value)
    this.elements.snap.selectedIndex = Array.from(this.elements.snap.options).findIndex((option) => option.value === value)
    this.elements.input.value = getSnappedValue(Number(this.elements.input.value), value, this.tempo).toString()
    this.elements.output.value = getSnappedValue(Number(this.elements.output.value), value, this.tempo).toString()
  }
}

/**
 * @param {number} value
 * @param {string} snap
 * @param {number} tempo
 */
function getClosestSnapIndex(value, snap, tempo) {
  switch (snap) {
    case 'beat':
      const secondsPerBeat = 60 / tempo
      return Math.round(value / secondsPerBeat)
    case 'bar':
      const secondsPerBar = 60 / tempo * 4
      return Math.round(value / secondsPerBar)
    case '8th':
      const secondsPerEighth = 60 / tempo / 8
      return Math.round(value / secondsPerEighth)
    case '16th':
      const secondsPer16th = 60 / tempo / 16
      return Math.round(value / secondsPer16th)
    default:
      return value
  }
}

/**
 * @param {number} value
 * @param {string} snap
 * @param {number} tempo
 * Takes a number in seconds and finds the closest beat or bar
 */
function getSnappedValue(value, snap, tempo) {
  switch (snap) {
    case 'beat':
      const secondsPerBeat = 60 / tempo
      const numb = Math.round(value / secondsPerBeat)
      return numb * secondsPerBeat
    case 'bar':
      const secondsPerBar = 60 / tempo * 4
      const bar = Math.round(value / secondsPerBar)
      return (bar * secondsPerBar)
    case '8th':
      const secondsPerEighth = 60 / tempo / 8
      const eighth = Math.round(value / secondsPerEighth)
      return (eighth * secondsPerEighth)
    case '16th':
      const secondsPer16th = 60 / tempo / 16
      const sixteenth = Math.round(value / secondsPer16th)
      return (sixteenth * secondsPer16th)
    default:
      return value
  }
}

customElements.define('audio-control', AudioControl);

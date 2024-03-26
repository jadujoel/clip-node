/** @type {typeof document.createElement} */
const create = document.createElement.bind(document)

export class AudioControl extends HTMLElement {
  constructor() {
    super(); // Always call super first in constructor
    const initialValue = this.getAttribute('value') ?? '0'
    this.attachShadow({ mode: 'open' }); // Attach a shadow DOM tree to the custom element
    this.elements = {
      label: create('label'),
      snapLabel: create('label'),
      snap: create('select'),
      input: create('input'),
      output: create('output'),
      unitLabel: create('label'),
      unit: create('select')
    }

    this.elements.snapLabel.textContent = 'Snap'
    this.elements.snapLabel.setAttribute('part', 'label');
    this.elements.unitLabel.textContent = 'Unit'
    this.elements.unitLabel.setAttribute('Unit', 'label');

    // set up snap, aka input scaling
    {
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

      const linSelection = create('option')
      linSelection.value = 'lin'
      linSelection.textContent = 'lin'

      const dbSelection = create('option')
      dbSelection.value = 'dB'
      dbSelection.textContent = 'dB'

      const log10Selection = create('option')
      log10Selection.value = 'log10'
      log10Selection.textContent = 'log10'

      const log2Selection = create('option')
      log2Selection.value = 'log2'
      log2Selection.textContent = 'log2'

      const intSelection = create('option')
      intSelection.value = 'int'
      intSelection.textContent = 'Int'

      this.elements.snap.append(
        noneSelection,
        beatSelection,
        barSelection,
        eighthSelection,
        sixteenthSelection,
        intSelection,
        log10Selection,
        log2Selection
      )
      this.snap = this.getAttribute('snap') ?? 'none'
      /** @type {HTMLOptionElement | null} */
      const selectedSnap = this.elements.snap.querySelector(`option[value="${this.snap}"]`)
      if (selectedSnap !== null) {
        selectedSnap.selected = true
      }
      this.elements.snap.addEventListener('change', (e) => {
        // @ts-ignore
        this.snap = e.target?.value
        // dont bubble to parent
        e.preventDefault()
      })
      this.elements.snap.setAttribute('part', 'select');
    }

    // set up unit / aka output label scaling

    {
      const linSelection = create('option')
      linSelection.value = 'lin'
      linSelection.textContent = 'lin'

      const dbSelection = create('option')
      dbSelection.value = 'dB'
      dbSelection.textContent = 'dB'

      const log10Selection = create('option')
      log10Selection.value = 'log10'
      log10Selection.textContent = 'log10'

      const log2Selection = create('option')
      log2Selection.value = 'log2'
      log2Selection.textContent = 'log2'

      this.elements.unit.append(
        linSelection,
        dbSelection,
        log10Selection,
        log2Selection
      )

      // set up unit
      // @ts-ignore
      this.unit = this.getAttribute('unit') ?? 'lin'
      /** @type {HTMLOptionElement | null} */
      const selectedUnit = this.elements.unit.querySelector(`option[value="${this.unit}"]`)
      if (selectedUnit !== null) {
        selectedUnit.selected = true
      }
      this.elements.unit.addEventListener('change', (e) => {
        // @ts-ignore
        this.unit = e.target?.value
        e.preventDefault()
      })
      this.elements.unit.setAttribute('part', 'select');
    }


    // set up input
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
    input.value = initialValue
    input.step = this.step
    input.min = this.min.toString()
    input.max = this.max.toString()
    input.setAttribute('part', 'input');

    output.value = initialValue
    output.textContent = initialValue
    output.setAttribute('part', 'output');

    this.setValue(Number(initialValue))

    /**
     * @param {Event} e
     */
    const updateValue = (e) => {
      // @ts-ignore
      this.value = e.target.value
    }
    // Add event listener to update output
    input.addEventListener('input', updateValue);

    // @ts-ignore
    this.shadowRoot.append(...Object.values(this.elements))

  }

  /** @param {number} newValue */
  set value(newValue) {
    this.setValue(newValue)
  }

  /** @param {number} newValue */
  setValue(newValue) {
    const value = getSnappedValue(Number(newValue), this.snap, this.tempo)
    const index = getClosestSnapIndex(value, this.snap, this.tempo)
    let precise = this.snap === 'none' ? value : index
    this.elements.input.value = value.toString()
    const out = getUnitValue(Number(value), this.unit).toPrecision(this.precision)
    this.elements.output.value = out
    this.setAttribute('value', value.toString())
  }

  // static get observedAttributes() {
  //   return ['value'];
  // }

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
    return Number(this.getAttribute('value') ?? 0)
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
    const snapped = getSnappedValue(Number(this.elements.input.value), value, this.tempo)
    const min = getSnappedValue(Number(this.min), value, this.tempo).toString()
    const max = getSnappedValue(Number(this.max), value, this.tempo).toString()
    this.elements.input.min = min
    this.elements.input.max = max
    this.value = snapped
    // this.elements.output.value = getSnappedValue(Number(this.elements.output.value), value, this.tempo).toString()
  }

  /**
   * @param value {'lin' | 'dB'}
   */
  set unit(value) {
    if (!isUnit(value)) {
      return
    }
    this.setAttribute('unit', value)
    this.elements.unit.selectedIndex = Array.from(this.elements.unit.options).findIndex((option) => option.value === value)
    this.elements.output.value = getUnitValue(Number(this.elements.input.value), value).toPrecision(this.precision)
  }

  get unit() {
    // @ts-ignore
    return this.getAttribute('unit') ?? 'lin'
  }
}

const units = [
  'lin',
  'dB',
]

/**
 * @param {string} value
 */
function isUnit(value) {
  return units.includes(value)
}

/**
 * @param {number} value
 * @param {string} unit
 */
function getUnitValue(value, unit) {
  switch (unit) {
    case 'lin':
      return value
    case 'log10':
      return Math.log10(value)
    case 'log2':
      return Math.log2(value)
    case 'dB':
      return dbFromLin(value)
    default:
      return value
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
    case 'int':
      return Math.round(value)
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
    case 'int':
      return Math.round(value)
    default:
      return value
  }
}

/**
 * @param {number} lin
 * @returns {number}
 **/

function dbFromLin(lin) {
  return Math.max(20 * Math.log10(lin), -1000)
}

customElements.define('audio-control', AudioControl);

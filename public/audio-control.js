/** @type {typeof document.createElement} */
const create = document.createElement.bind(document)

export class AudioControl extends HTMLElement {
  constructor() {
    super(); // Always call super first in constructor
    this.attachShadow({ mode: 'open' }); // Attach a shadow DOM tree to the custom element
    this.elements = {
      input: create('input'),
      output: create('output'),
      label: create('label'),
    }
  }

  connectedCallback() {
    const { label, input, output } = this.elements

    // Get attributes
    let id = this.id
    if (!id) {
      id = this.label.toLowerCase().replace(/\s/g, "-") + "-control";
      this.id = id
    }

    label.for = this.id
    label.textContent = this.label
    label.setAttribute('part', 'label');

    input.type = 'range'
    input.value = this.value
    input.step = this.step
    input.min = this.min
    input.max = this.max
    input.setAttribute('part', 'input');

    output.value = this.value
    output.textContent = this.value
    output.setAttribute('part', 'output');

    // Add event listener to update output
    input.addEventListener('input', (e) => {
      this.setAttribute('value', e.target.value)
      output.value = Number(e.target.value).toPrecision(this.precision)
    });

    this.shadowRoot.append(label, input, output)
  }

  static get observedAttributes() {
    return ['value'];
  }

  /**
   * @param name {string}
   * @param oldValue {string}
   * @param newValue {string | number}
   */
  attributeChangedCallback(name, oldValue, newValue) {

    // const { label, input, output } = this.elements;
    // if (name !== 'value') {
    // }
    // switch (name) {
    //   case 'value':
    //     input.value = String(newValue);
    //     output.value = String(Number(newValue).toPrecision(this.precision))
    //     break;
    //   case 'min':
    //     input.min = String(newValue);
    //     break;
    //   case 'max':
    //     input.max = String(newValue);
    //     break;
    //   case 'precision':
    //     output.value = Number(this.value).toPrecision(newValue)
    //     break;
    //   case 'step':
    //     input.step = newValue;
    //     break;
    //   case 'label':
    //     label.textContent = newValue;
    //     break;
    //   default:
    //     break;
    // }
  }

  /** @param {number} value */
  set precision(value) {
    this.elements.output.value = Number(this.elements.output.value).toPrecision(value)
    this.setAttribute('precision', value)
  }

  get precision() {
    return Number(this.getAttribute('precision') ?? 5)
  }

  get value() {
    return Number(this.getAttribute('value'))
  }

  /** @param value {number} */
  set value(value) {
    this.elements.input.value = value
    this.elements.output.value = value.toPrecision(this.precision)
    this.setAttribute('value', value)
  }

  get min() {
    return Number(this.getAttribute('min') ?? 0)
  }

  /** @param value {number} */
  set min(value) {
    this.elements.input.min = value
    this.setAttribute('min', value)
  }

  get max() {
    return Number(this.getAttribute('max') ?? 1)
  }

  /** @param value {number} */
  set max(value) {
    this.elements.input.max = value
    this.setAttribute('max', value)
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

}

customElements.define('audio-control', AudioControl);

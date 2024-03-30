/// <reference path="../SnappableSlider.d.ts" />

/** @type {typeof document.createElement} */
const create = document.createElement.bind(document)

const hertzPreset = {
  snaps: [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16385],
  min: 32,
  max: 16384,
  skew: 0.25
}

const decibelPreset = {
  snaps: [-60, -48, -36, -24, -12, -6, -3, 0],
  min: -60,
  max: 0,
  skew: 1
}

let isOptionKeyHeld = false

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') {
    isOptionKeyHeld = true
  }
})

document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    isOptionKeyHeld = false
  }
})

export class SnappableSlider extends HTMLElement {
  /** @type{SnappableSliderState} */
  props
  /**
   * @param {SnappableSliderProperties} props
   */
  constructor(props = {}) {
    super();
    this.props = this.updateProps(props)

    this.elements = {
      track: create('span'),
      fill: create('span'),
      thumb: create('span'),
      /** @type {HTMLSpanElement[]} */
      snaps: [],
      /** @type {HTMLSpanElement[]} */
      xvals: [],
    }
    this.elements.track.setAttribute('part', 'track')
    this.elements.fill.setAttribute('part', 'fill')
    this.elements.thumb.setAttribute('part', 'thumb')
    this.append(this.elements.track, this.elements.fill, this.elements.thumb)

    this.updateSnaps()
    this.renderValue(this.props.value)

    // Event listeners for mouse interaction
    this.addEventListener('mousedown', this.startDrag);
    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.stopDrag);

    // Optional: Add touch support
    this.addEventListener('touchstart', this.startDrag);
    document.addEventListener('touchmove', this.onDrag);
    document.addEventListener('touchend', this.stopDrag);

    const menu = create('div')
    menu.setAttribute('part', "menu")

    const iskew = create('li')
    iskew.setAttribute('part', "menu-item")

    const imin = create('li')
    imin.setAttribute('part', "menu-item")

    const imax = create('li')
    imax.setAttribute('part', "menu-item")
    menu.appendChild(imin)

    const ival = create('li')
    ival.setAttribute('part', "menu-item")
    ival.textContent = `Value: ${this.props.value}`

    menu.appendChild(iskew)
    menu.appendChild(imin)
    menu.appendChild(imax)
    menu.appendChild(ival)

    this.append(menu)

    this.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      menu.style.display = 'block'
      menu.style.left = `${e.pageX}px`;
      iskew.textContent = `Skew: ${this.props.skew}`
      imin.textContent = `Min: ${this.props.min}`
      imax.textContent = `Max: ${this.props.max}`
      ival.textContent = `Value: ${this.props.value}`
      document.addEventListener('click', () => {
        menu.style.display = 'none'
      }, { once: true })
    })

    if (this.props.preset !== 'none') {
      this.setPreset(this.props.preset)
    }
  }

  /**
   * @param {number} value
   */
  set value(value) {
    this.setProps({ value })
  }

  get value() {
    return this.props.value
  }

  /**
   * @param {number} value
   */
  set min(value) {
    this.setProps({ min: value })
  }

  get min() {
    return this.props.min
  }

  /**
   * @param {number} value
   * */
  set max(value) {
    this.setProps({ max: value })
  }

  get max() {
    return this.props.max
  }

  updateSnaps() {
    const { snaps } = this.props
    let prevPos = 0
    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i]
      const ratio = this.getRatioFromValue(snap)
      let snapEl = this.elements.snaps[i]
      let xvalEl = this.elements.xvals[i]
      if (snapEl === undefined) {
        snapEl = create('span')
        snapEl.setAttribute('part', 'snap')
        this.elements.snaps.push(snapEl)
        this.append(snapEl)
      }
      if (xvalEl === undefined) {
        xvalEl = create('span')
        xvalEl.setAttribute('part', 'xval')
        this.elements.xvals.push(xvalEl)
        this.append(xvalEl)
      }
      snapEl.style.left = `${ratio * 100}%`
      xvalEl.textContent = snap.toString()
      xvalEl.style.left = `${ratio * 100}%`
      // check if val is overlapping with previous, if so hide it
      if (i > 0 && ratio - prevPos < 0.05) {
        xvalEl.style.display = 'none'
      } else {
        xvalEl.style.display = 'block'
        prevPos = ratio
      }
    }
  }

  /**
   * @param {MouseEvent | TouchEvent} e
   */
  startDrag(e) {
    this.dragging = true;
    this.onslider(e);
  }

  /**
   *  @param {MouseEvent | TouchEvent} e
   **/
  onDrag = (e) => {
    if (!this.dragging) return;
    this.onslider(e);
  }

  stopDrag = () => {
    this.dragging = false;
  }

  /**
   * @param {number} value
   */
  onChange = (value) => {}

  /**
   * @param {MouseEvent | TouchEvent} e
   */
  onslider(e) {
    const { left, width } = this.getBoundingClientRect();
    const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX; // Support for touch devices
    const ratio = Math.min(Math.max((clientX - left) / width, 0), 1);
    const value = this.getValueFromRatio(ratio)
    const snapped = this.getSnappedValue(value)
    if (snapped === this.props.value) return
    this.props.value = snapped
    this.setAttribute('value', snapped.toString())
    this.renderRatio(this.getRatioFromValue(snapped))
    this.onChange(snapped)
  }

  /**
   * Sets the component's value and updates the UI
   * @param {number} value
   * @returns {void}
   */
  updateValue(value) {
    this.props.value = value
    this.renderValue(value)
  }

  /**
   * @param {number} value
   */
  renderValue(value = this.props.value) {
    this.renderRatio(this.getRatioFromValue(value))
  }

  /**
   * @param {number} ratio
   */
  renderRatio(ratio) {
    const { fill, thumb } = this.elements
    fill.style.width = thumb.style.left = `${ratio * 100}%`
  }

  /**
   * Gets the ratio from 0 to 1 of a value between min and max
   * Given a value, returns a ratio between 0 and 1
   * @param {number} value
   * @returns {number}
   */
  getRatioFromValue(value) {
    const { min, max, skew } = this.props;
    const range = max - min;
    // Normalize the value within the range [0, 1]
    const normalized = (value - min) / range;
    if (skew === 1) return normalized;
    return Math.pow(normalized, skew);
  }

  /**
   * Given a ratio between 0 and 1, returns the corresponding value between min and max
   * This function is the inverse of getRatioFromValue
   * @param {number} ratio
   * @returns {number}
   */
  getValueFromRatio(ratio) {
    const { min, max, skew } = this.props;
    const range = max - min;

    // Apply the inverse skew transformation if skew != 1
    let value;
    if (skew === 1) {
      value = ratio;
    } else {
      value = Math.pow(ratio, 1 / skew); // Apply inverse skew
    }

    // Denormalize the value to get the actual value in the [min, max] range
    return value * range + min;
  }


  /**
   * @param {number} value
   * @returns {number}
   */
  getSnappedValue(value) {
    if (this.props.snaps.length === 0 || !this.props.snap || isOptionKeyHeld) return value
    return this.props.snaps.reduce((closest, snap) => {
      const closestValue = Math.abs(closest - value)
      const snapValue = Math.abs(snap - value)
      return snapValue < closestValue ? snap : closest
    })
  }

  /**
   * @returns {SnappableSliderState}
   */
  getAttributes() {
    const scale = this.getAttribute('scale') ?? 'linear'
    const snap = this.getAttribute('snap')
    let snapAttribute = this.getAttribute('snaps')
    /**
     * @type {number[]}
     */
    let snaps
    if (!snapAttribute) {
      snaps = []
    } else {
      snaps = snapAttribute.split(' ').map(Number)
    }
    return {
      min: Number(this.getAttribute('min') ?? 0),
      max: Number(this.getAttribute('max') ?? 1),
      value: Number(this.getAttribute('value') ?? 0),
      snap: snap !== null && snap !== 'false',
      snaps: snaps,
      /** @type {Scale} */
      scale: isScale(scale) ? scale : 'linear',
      skew: Number(this.getAttribute('skew') ?? 1),
      preset: this.getAttribute('preset') ?? 'none'
    }
  }

  /**
   * @param {SnappableSliderProperties} newProps
   * @returns {SnappableSliderState}
   */
  updateProps(newProps) {
    let props = {
      ...this.getAttributes(),
      ...newProps,
    }
    if (props.preset !== 'none') {
      props = {
        ...props,
        ...this.getPropsFromPreset(props.preset)
      }
    }
    this.setAttribute('min', props.min.toString())
    this.setAttribute('max', props.max.toString())
    this.setAttribute('value', props.value.toString())
    this.setAttribute('snaps', props.snaps.join(' '))
    this.setAttribute('snap', props.snap ? 'true' : 'false')
    this.setAttribute('preset', props.preset)
    this.props = props
    return props
  }

  /**
   * @param {string} preset
   * @returns {SnappableSliderProperties}
   */
  getPropsFromPreset(preset) {
    switch (preset) {
      case 'hertz':
        return hertzPreset
      case 'decibel':
        return decibelPreset
      default:
        return {}
    }
  }

  /**
   * @param {string} preset
   */
  setPreset(preset) {
    this.setProps(this.getPropsFromPreset(preset))
  }

  /**
   * @param {SnappableSliderProperties} newProps
   */
  setProps(newProps) {
    this.updateProps(newProps)
    this.updateSnaps()
    this.renderValue()
  }
}

/**
 * @param {string} value
 * @returns {value is Scale}
 */
function isScale(value) {
  return ['linear', 'log10', 'exponential', 'decibel'].includes(value)
}

// /**
//  * @type {Record<Scale, (value: number) => number>}
//  */
// const scaleMap = {
//   linear: (value) => value,
//   log10: (value) => Math.log10(value),
//   exponential: (value) => Math.exp(value),
//   decibel: (value) => 10 * Math.log10(value),
// }

// /**
//  * @param {number} value
//  * @param {Scale} scale
//  * @returns {number}
//  */
// function getScaledValue(value, scale) {
//   return scaleMap[scale](value)
// }

/**
 * @param {Event} e
 * @returns {e is TouchEvent}
 */
function isTouchEvent(e) {
  // @ts-ignore
  return e.touches?.length > 0
}


customElements.define('snappable-slider', SnappableSlider);

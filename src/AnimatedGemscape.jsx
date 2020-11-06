import React, { useRef, useState, useEffect, useContext } from "react"
import { useSprings, useSpring, animated } from 'react-spring'

import Gem from './Gem.jsx'
import {
  glowingOpacity,
  glowingTransform,
  mouseGemRefGenerator,
  parseGemscapeXML
} from './util.js'
import { HSLuvHueIntensityMap } from './HSLuvHueIntensityMap'


const AnimatedGem = animated(Gem)

const glowingFill = function (intensityFactor) {
  return (ref, inside) => {
    let fill = ref.getAttribute('__fill')
    if (inside) {
      fill = HSLuvHueIntensityMap(fill, intensityFactor)
    }
    return fill
  }
}

const AnimatedGemscapeContainer = (props) => {
  const [parsed, setParsed] = useState(null)
  useEffect(() => {
    fetch(props.href)
      .then(resp => resp.text())
      .then(text => {
        const parsedResult = parseGemscapeXML()(text)
        setParsed(parsedResult)
      })
  }, [props.href])

  if (parsed) {
    const { href, ...rest } = props
    return (
      <AnimatedGemscape {...rest} parsed={parsed}/>
    )
  } else {
    return null
  }
}


const AnimatedGemscape = (props) => {

  const getDefault = (paths) => {
    return paths.map(path => ({
      'fillOpacity': parseFloat(path['__fillopacity']),
      'fill': path['__fill'],
      'transform': 'translate(0 0) scale(1)'
    }))
  }

  const getBeginning = (paths) => {
    return paths.map(path => ({
      'fillOpacity': parseFloat(path['__fillopacity']),
      'fill': path['__fillgreyscale'],
      'transform': 'translate(0 0) scale(1)'
    }))
  }

  const queue = useContext(QueueContext)

  const gemscapeRef = useRef(null)
  const attributesRef = useRef(null)

  const pathRefs = []

  const [saturationFactor, setSaturationFactor] = useState(1.1)
  const [brightnessFactor, setBrightnessFactor] = useState(1.1)
  const [intensityFactor, setIntensityFactor] = useState(10)
  const [useParallax, setUseParallax] = useState(true)
  const [useGlowOnHover, setUseGlowOnHover] = useState(true)
  const [parallaxFactor, setParallaxFactor] = useState(5)
  const [parallaxPlane, setParallaxPlane] = useState(2)
  const [scaleFactor, setScaleFactor] = useState(1.05)

  const parsed = props.parsed
  const beginning = getBeginning(parsed.paths)
  // console.log(`parsed.paths.length=${parsed.paths.length}`)

  const [springs, set, stop] = useSprings(
    parsed.paths.length, idx => ({
      ...beginning[idx],
      // 'fillOpacity': 1,
      // 'fill': '#ffffff',
      // 'transform': 'translate(0 0) scale(1.0)',
      'config': props.config
    })
  )

  const [playCursor, setPlayCursor, stopPlayCursor] = useSpring(
    () => ({offset: queue.percentagePlayed, config: props.config}))

  useEffect(() => {
    // console.log('useEffect')
    attributesRef.current = null
    if (parsed === null) {
      return
    }
    const defaults = getDefault(parsed.paths)
    set(idx => ({...defaults[idx]}))
  })

  useEffect(() => {
    setPlayCursor(() => ({offset: queue.percentagePlayed}))
  }, [queue.percentagePlayed])

  const checkMouse = () => {
    if (gemscapeRef.current === null || pathRefs.length === 0) {
      return false
    }
    if (pathRefs[0] === null) {
      return false
    }
    if (attributesRef.current === null) {
      attributesRef.current = mouseGemRefGenerator(gemscapeRef, pathRefs)
    }
    return true
  }

  const onMouseClick = (evt) => {
    props.onSeek(evt)
    // if (! checkMouse()) {
    //   return
    // }
    // const width = gemscapeRef.current.getAttribute('width')

    // const { clientX: x, clientY: y } = evt
    // for (const obj of attributesRef.current(x, y)) {
    //   if (obj.idx === 0) {
    //     const frac = obj.screenCursor.x/width
    //     setPlayCursor({ offset: 100*frac })
    //     break
    //   }
    // }
  }

  const onMouseMove = (evt) => {
    const { clientX: x, clientY: y } = evt
    if (! checkMouse()) {
      return
    }
    // props.onSeek(evt)
    const getFillOpacity = glowingOpacity
    const getFill = glowingFill(intensityFactor)
    const getTransform = glowingTransform(scaleFactor)

    const [width, height] = [gemscapeRef.current.getAttribute('width'), gemscapeRef.current.getAttribute('height')]
    const nLayers = (new Set(pathRefs.map(path => path.path.getAttribute('layer')))).size

    let attributes = []
    const defaults = getDefault(parsed.paths)

    for (const obj of attributesRef.current(x, y)) {
      // if (obj.idx === 0) {
      //   const frac = obj.screenCursor.x/width
      //   setPlayCursor({ offset: 100*frac })
      //   // break
      // }

      const transform = {
        'scale': 1.0,
        'x': 0.0,
        'y': 0.0
      }

      const layer = parseInt(obj.ref.getAttribute('layer'))
      // const layer = obj.idx
      if (useParallax) {
        const parallaxLayer = layer + parallaxPlane - nLayers
        const xScale = parallaxLayer * 0.001 * parallaxFactor
        const yScale = parallaxLayer * 0.001 * parallaxFactor
        const xPos = (obj.screenCursor.x - width/2)
        const yPos = (obj.screenCursor.y - height/2)
        transform.x = xPos*xScale
        transform.y = yPos*yScale
      }
      let fillOpacity = defaults[obj.idx].fillOpacity
      let fill = defaults[obj.idx].fill


      if (useGlowOnHover) {
        if (layer > 0) {
          fillOpacity = getFillOpacity(obj.ref, obj.inside)
          fill = getFill(obj.ref, obj.inside)
          const transformObj = getTransform(obj.ref, obj.inside)
          transform.x += transformObj.x
          transform.y += transformObj.y
          transform.scale = transformObj.scale
        }
      }

      // const bbox = obj.ref.getBBox()
      // if (obj.pathCursor.x < bbox.x && layer !== 0) {
      //   fill = parsed.paths[obj.idx].__fillgreyscale
      // }


      attributes.push({
        'fillOpacity': fillOpacity,
        'fill': fill,
        'transform': `translate(${transform.x} ${transform.y}) scale(${transform.scale}) `
      })
    }
    set(idx => ({
      ...attributes[idx],
      config: props.config
    }))
  }

  if (parsed === null) {
    return null
  } else {
    parsed.svg.onMouseMove = onMouseMove
    parsed.svg.onClick = onMouseClick

    const { height, width } = parsed.svg
    const xScale = props.width / width
    const yScale = props.height / height

    const interp = playCursor.offset.interpolate(o => `${o}%`)

    return (
      <g transform={`scale(${xScale} ${yScale})`}>
      <svg {...parsed.svg} ref={gemscapeRef}>
        <defs>
          <clipPath id="clip">
            <animated.rect width={interp} fill="#000000" x={0} y={0} height={parsed.rect.height}/>
          </clipPath>
          <clipPath id="grayscale-clip">
            <animated.rect width={parsed.rect.width} fill="#000000" x={interp} y={0} height={parsed.rect.height}/>
          </clipPath>
        </defs>
        <rect {...parsed.rect}/>
        <g clipPath="url(#grayscale-clip)">
          <g {...parsed.g}>
            {springs.map((props, idx) => {
              const transform = props.transform
              const {fill, __fillgreyscale, ...rest} = parsed.paths[idx]

              const layer = parseInt(parsed.paths[idx].layer)
              if (layer != null) {
                if (layer === 0) {
                  return <AnimatedGem key={`grayscale-${idx}`} {...rest} fill={__fillgreyscale} fillOpacity="0.5" transform={transform}/>
                }
              }
              return null
            })}
          </g>
        </g>
        {springs.map((props, idx) => {
          // const path = `${dirName}/gem.${idx}.svg`
          const {fillOpacity, fill, ...rest} = props
          const fillOpacityInterp = fillOpacity.interpolate([0, 1], [0, 1])
          const layer = parseInt(parsed.paths[idx].layer)
          let clipPath = null
          if (layer === 0) {
            clipPath = "url(#clip)"
          }
          return (
            <g clipPath={clipPath} key={idx}>
              <g {...parsed.g}>
                <AnimatedGem
                  {...parsed.paths[idx]}
                  fill={fill}
                  fillOpacity={fillOpacityInterp}
                  ref={ref => pathRefs[idx] = ref}
                  {...rest}/>
              </g>
            </g>
            )
          })}
      </svg>
      </g>
    )
  }
}
export default AnimatedGemscapeContainer

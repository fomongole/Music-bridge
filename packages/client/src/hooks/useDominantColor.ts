import { useState, useEffect } from 'react'
import { FastAverageColor } from 'fast-average-color'

export function useDominantColor(imageUrl?: string) {
  const [color, setColor] = useState<string>('rgba(0, 0, 0, 0)') // Default transparent

  useEffect(() => {
    if (!imageUrl) {
      setColor('rgba(0, 0, 0, 0)')
      return
    }

    const fac = new FastAverageColor()
    
    fac.getColorAsync(imageUrl)
      .then(result => {
        // We use rgba with a slight opacity for softer blending
        setColor(`rgba(${result.value[0]}, ${result.value[1]}, ${result.value[2]}, 0.8)`)
      })
      .catch(e => {
        console.error('Error extracting color:', e)
        setColor('rgba(0, 0, 0, 0)')
      })

    return () => fac.destroy()
  }, [imageUrl])

  return color
}
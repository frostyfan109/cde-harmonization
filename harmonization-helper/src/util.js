export const lerp = (start, end, amt) => (1-amt)*start+amt*end
export const minMaxNorm = (x, min, max) => (x - min) / (max - min)
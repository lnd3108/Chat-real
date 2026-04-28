import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const getMatches = () =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false

  const [isMobile, setIsMobile] = React.useState<boolean>(getMatches)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(getMatches())
    }

    onChange()
    window.addEventListener("resize", onChange)

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
      return () => {
        window.removeEventListener("resize", onChange)
        mql.removeEventListener("change", onChange)
      }
    }

    mql.addListener(onChange)
    return () => {
      window.removeEventListener("resize", onChange)
      mql.removeListener(onChange)
    }
  }, [])

  return isMobile
}

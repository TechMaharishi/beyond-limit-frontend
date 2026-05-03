import { useEffect, useState } from "react"

/**
 * Custom hook for debouncing a value.
 * Delays the update of a value until a specified delay has passed without any new changes.
 * Useful for search inputs or other high-frequency events to prevent excessive API calls or renders.
 *
 * @param value The value to be debounced.
 * @param delay The delay in milliseconds (default: 500ms).
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

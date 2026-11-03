import { cn } from "@/utils/cn"
import { SearchIcon, XIcon } from "lucide-react"
import {
  forwardRef,
  useState,
  type ComponentProps,
} from "react"

type SearchProps = Omit<ComponentProps<"input">, "type"> & {
  className?: string
  containerClassName?: string
}

const Search = forwardRef<HTMLInputElement, SearchProps>(
  (
    {
      className = "",
      containerClassName = "",
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const [inputEl, setInputEl] =
      useState<HTMLInputElement | null>(null)

    const [localValue, setLocalValue] = useState(
      defaultValue?.toString() ?? ""
    )

    const isControlled = value !== undefined

    const currentValue = isControlled
      ? String(value ?? "")
      : localValue

    const showClear = currentValue.length > 0

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (!isControlled) {
        setLocalValue(e.target.value)
      }

      onChange?.(e)
    }

    const handleClear = () => {
      if (!inputEl) return

      if (!isControlled) {
        setLocalValue("")
      }

      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set

      setter?.call(inputEl, "")

      inputEl.dispatchEvent(
        new Event("input", { bubbles: true })
      )

      inputEl.focus()
    }

    return (
      <div
        className={cn(
          "flex group items-center gap-2 w-full h-10 px-3 rounded-lg",
          "bg-neutral-3 border border-gray-200 dark:border-gray-700",
          "transition-colors overflow-hidden",
          "focus-within:border-gray-300 focus-within:shadow-sm",
          containerClassName
        )}
      >
        <SearchIcon className="size-4 shrink-0 text-gray-400 group-focus-within:text-neutral-9" />

        <div className="w-px h-4.5 bg-neutral-5 group-focus-within:bg-neutral-9" />

        <input
          ref={(node) => {
            setInputEl(node)

            if (typeof ref === "function") {
              ref(node)
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
            }
          }}
          role="search"
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          className={cn(
            "flex-1 w-full h-full outline-none bg-transparent appearance-none",
            "text-sm text-black dark:text-white",
            "placeholder:text-gray-400",
            "[&::-webkit-search-decoration]:appearance-none",
            "[&::-webkit-search-cancel-button]:appearance-none",
            "[&::-webkit-search-results-button]:appearance-none",
            "[&::-webkit-search-results-decoration]:appearance-none",
            "disabled:cursor-not-allowed disabled:text-neutral-9",
            className
          )}
          {...props}
        />

        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    )
  }
)

Search.displayName = "Search"

export { Search }


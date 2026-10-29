import { cn } from "@/utils/cn";
import { Label } from "./label";
import { forwardRef, useId, useState, useEffect } from "react";
import SelectBase, {
  type SelectInstance,
  type Props as SelectProps,
} from "react-select";

export type SelectOptionProps = {
  label: any;
  value: string;
  isDisabled?: boolean;
  optionImage?: React.ReactNode;
  optionLabel?: React.ReactNode;
};

type InfiniteScrollProps = {
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
};

type BaseSelectProps = Omit<
  SelectProps<SelectOptionProps, boolean>,
  "options" | "onChange" | "value"
> & {
  datalist: SelectOptionProps[];
  label?: string;
  disabled?: boolean;
  hideClear?: boolean;
  errorMsg?: string;
  defValue?: string | string[];
  value?: string | string[] | null;
  containerClassName?: string;
  infiniteScroll?: InfiniteScrollProps;
};

type SinglSelectProps = BaseSelectProps & {
  isMulti?: false;
  onChange?: (selected: string | null) => void;
};

type MultiSelectProps = BaseSelectProps & {
  isMulti: true;
  onChange?: (selected: string[]) => void;
};

export type CustomSelectProps = SinglSelectProps | MultiSelectProps;

const SelectInput = forwardRef<
  SelectInstance<SelectOptionProps, boolean>,
  CustomSelectProps
>(function SelectInput(
  {
    label,
    datalist,
    defValue,
    value: controlledValue,
    errorMsg,
    required,
    disabled,
    containerClassName,
    onChange,
    infiniteScroll,
    hideClear,
    ...props
  },
  ref,
) {
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasError = Boolean(errorMsg && errorMsg.trim());

  const defaultValue = Array.isArray(defValue)
    ? datalist.filter((item) => defValue.includes(item.value))
    : datalist.find((item) => item.value === defValue) || null;

  const resolvedValue =
    controlledValue !== undefined
      ? Array.isArray(controlledValue)
        ? datalist.filter((item) => (controlledValue as string[]).includes(item.value))
        : (datalist.find((item) => item.value === controlledValue) ?? null)
      : undefined;

  return (
    <div className={cn("flex flex-col gap-2 w-full", containerClassName)}>
      {label && (
        <Label>
          {label}
          {required && <sup className="text-red-500">*</sup>}
        </Label>
      )}

      <SelectBase
        ref={ref}
        instanceId={instanceId}
        options={datalist}
        isMulti={props.isMulti}
        isDisabled={disabled}
        isClearable={hideClear ? false : true}
        unstyled
        menuPosition="absolute"
        menuPortalTarget={mounted && typeof document !== "undefined" ? document.body : undefined}
        menuShouldScrollIntoView={false}
        closeMenuOnSelect={!props.isMulti}
        defaultValue={defaultValue}
        {...(resolvedValue !== undefined ? { value: resolvedValue } : {})}
        placeholder={props.placeholder ?? "Not Selected"}
        isOptionDisabled={(option) => !!option.isDisabled}
        onMenuScrollToBottom={() => {
          if (infiniteScroll?.hasMore && !infiniteScroll?.loading) {
            infiniteScroll.onLoadMore?.();
          }
        }}
        noOptionsMessage={() =>
          infiniteScroll?.loading ? "Loading..." : "No options"
        }
        onChange={(val) => {
          if (props.isMulti) {
            const values = Array.isArray(val)
              ? val.map((item) => item.value)
              : [];

            (onChange as MultiSelectProps["onChange"])?.(values);
          } else {
            const value = (val as SelectOptionProps | null)?.value;

            (onChange as SinglSelectProps["onChange"])?.(value ?? null);
          }
        }}
        classNames={{
          control: () =>
            cn(
              "!min-h-[40px] !px-4 border rounded-lg bg-neutral-3 dark:bg-gray-800 text-sm border-gray-200 dark:border-gray-700 text-slate-800 dark:text-gray-100 cursor-pointer shadow-2xs",
              hasError && "bg-white border-red-500",
              disabled && "bg-[#D0D3D9] text-neutral-9",
            ),

          menu: () =>
            "mt-2 py-2 border rounded-lg text-sm border-gray-100 dark:bg-gray-800 dark:border-gray-700 shadow-xl bg-white z-50",

          menuPortal: () => "z-50",

          multiValue: () => "gap-1 py-1.5 px-2 mr-1",

          multiValueRemove: () => "mt-0.5 px-0 mr-0",

          singleValue: () => "text-slate-800 dark:text-gray-100 font-medium",

          option: ({ isFocused, isSelected }) =>
            cn(
              "!flex items-center min-h-9 px-3 border-l-2 border-transparent !text-sm hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-500 cursor-pointer text-slate-800 dark:text-gray-200",
              (isFocused || isSelected) &&
                "bg-blue-50 dark:bg-gray-700 border-blue-500 font-medium",
            ),

          placeholder: ({ isDisabled }) =>
            cn("text-gray-400", isDisabled && "text-neutral-9"),

          valueContainer: () => "stroke-0 mr-2",

          clearIndicator: () =>
            "stroke-0 mr-1 text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200",

          dropdownIndicator: () =>
            "stroke-0 mr-0 text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200",
        }}
        {...props}
      />

      {hasError && <p className="text-sm text-red-500">{errorMsg}</p>}
    </div>
  );
});

export { SelectInput };


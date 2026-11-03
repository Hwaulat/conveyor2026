import {
  Tabs as TabsComponent,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './tabs';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  content?: ReactNode;
  disabled?: boolean;
}

export type TabVariant =
  | 'default'
  | 'pill'
  | 'underline'
  | 'bordered'
  | 'solid'
  | 'primary'
  | 'dynamic';

export type TabsOrientation = 'horizontal' | 'vertical';

export interface TabsProps {
  items: TabItem[];
  variant?: TabVariant;
  orientation?: TabsOrientation;
  fullWidth?: boolean;
  className?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface VariantConfig {
  listWrapper?: string;
  list: string;
  triggerBase: string;
  triggerActive: string;
  triggerSize?: string;
}

const variants: Record<TabVariant, VariantConfig> = {
  default: {
    list: 'bg-gray-100 dark:bg-gray-700/60 rounded-xl p-1 h-auto',
    triggerBase:
      'text-gray-500 dark:text-gray-400 rounded-lg text-xs data-[state=inactive]:hover:text-gray-700 dark:data-[state=inactive]:hover:text-gray-300',
    triggerActive:
      'data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white',
  },
  pill: {
    list: 'bg-transparent gap-1 h-auto',
    triggerBase:
      'rounded-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent',
    triggerActive:
      'data-[state=active]:bg-gray-900 dark:data-[state=active]:bg-white data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:border-transparent',
  },
  underline: {
    list: 'bg-transparent border-b border-gray-200 dark:border-gray-700 rounded-none h-auto gap-0 p-0',
    triggerBase:
      'rounded-none text-xs text-gray-500 dark:text-gray-400 border-b-2 border-transparent hover:text-gray-700 dark:hover:text-gray-300 pb-2 bg-transparent px-3',
    triggerActive:
      'data-[state=active]:border-gray-900 dark:data-[state=active]:border-white data-[state=active]:text-gray-900 dark:data-[state=active]:text-white',
  },
  bordered: {
    list: 'bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl p-1 h-auto',
    triggerBase: 'text-xs text-gray-500 dark:text-gray-400 rounded-lg',
    triggerActive:
      'data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white',
  },
  solid: {
    list: 'bg-gray-900 dark:bg-gray-700 rounded-xl p-1 h-auto',
    triggerBase: 'text-xs text-gray-400 rounded-lg',
    triggerActive:
      'data-[state=active]:bg-white data-[state=active]:text-gray-900',
  },
  primary: {
    list: 'bg-[#F3F4F6] dark:bg-gray-700/60 rounded-xl p-1 h-auto',
    triggerBase:
      'text-xs text-[#6A7282] dark:text-gray-400 rounded-lg data-[state=inactive]:hover:text-gray-700 dark:data-[state=inactive]:hover:text-gray-300',
    triggerActive:
      'data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-[#1F5AA6] dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0px_1px_2px_-1px_#0000001A,0px_1px_3px_0px_#0000001A]',
    triggerSize: 'h-[28px] w-fit py-[6px] px-3',
  },
  dynamic: {
    listWrapper:
      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3',
    list: 'bg-transparent rounded-xl p-0 h-auto gap-0',
    triggerBase:
      'rounded-none border-b-3 border-transparent text-muted-foreground hover:text-foreground bg-transparent whitespace-nowrap px-1 text-sm',
    triggerActive:
      'data-[state=active]:border-b-blue-500 p-5 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400',
    triggerSize: 'h-auto py-4',
  },
};

export function Tabs({
  items,
  variant = 'default',
  orientation = 'horizontal',
  defaultValue,
  value,
  onValueChange,
  fullWidth = false,
  className,
}: TabsProps) {
  const { listWrapper, list, triggerBase, triggerActive, triggerSize } =
    variants[variant];

  const controlledProps =
    value !== undefined ? { value, onValueChange } : undefined;
  const uncontrolledProps =
    value === undefined
      ? { defaultValue: defaultValue ?? items[0]?.value }
      : undefined;

  const tabsList = (
    <TabsList
      className={cn(
        list,
        fullWidth && 'w-full',
        orientation === 'vertical' && 'flex-col h-auto',
      )}
    >
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={cn(
            triggerBase,
            triggerActive,
            triggerSize ?? 'h-8',
            'font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
            fullWidth && 'flex-1',
          )}
        >
          {item.icon && (
            <span className="[&_svg]:w-3.5 [&_svg]:h-3.5 shrink-0">
              {item.icon}
            </span>
          )}
          {item.label}
          {item.badge !== undefined && (
            <span className="ml-0.5 text-[9px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 rounded-full leading-4 font-semibold">
              {item.badge}
            </span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <TabsComponent
      {...controlledProps}
      {...uncontrolledProps}
      orientation={orientation}
      className={cn('overflow-auto lg:overflow-hidden', className)}
    >
      {listWrapper ? <div className={listWrapper}>{tabsList}</div> : tabsList}

      {items.map((item) =>
        item.content ? (
          <TabsContent key={item.value} value={item.value} className="mt-4">
            {item.content}
          </TabsContent>
        ) : null
      )}
    </TabsComponent>
  );
}

// Re-export as TabList alias for convenience
export { Tabs as TabList };


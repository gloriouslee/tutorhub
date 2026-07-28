import {
  useAccountContext,
  type ParentChild,
} from "@/hooks/useAccountContext";

export type { ParentChild } from "@/hooks/useAccountContext";

export interface ParentContext {
  parentId: string;
  parentName: string;
  children: ParentChild[];
  ready: boolean;
}

const EMPTY_CONTEXT: ParentContext = {
  parentId: "",
  parentName: "",
  children: [],
  ready: false,
};

export function useParentContext(): ParentContext {
  const { context, ready } = useAccountContext();
  if (context?.role !== "parent") return { ...EMPTY_CONTEXT, ready };

  return {
    parentId: context.parentId,
    parentName: context.parentName,
    children: context.children ?? [],
    ready,
  };
}

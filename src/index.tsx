/* @refresh reload */
import "./styles/general.css";

import WorldIcon from "~icons/bx/world";
import SolidIcon from "~icons/devicon/solidjs";
import TailwindIcon from "~icons/devicon/tailwindcss";
import IconifyIcon from "~icons/line-md/iconify2-static";
import DaisyUiIcon from "~icons/logos/daisyui-icon";
import LucideIcon from "~icons/simple-icons/lucide";
import ClockIcon from "~icons/tabler/clock";
import CodeIcon from "~icons/tabler/code";
import InfoCircleIcon from "~icons/tabler/info-circle";

import { Component, ComponentProps, For, JSX, lazy } from "solid-js";

import { render } from "solid-js/web";

import { Route, RouteSectionProps, Router } from "@solidjs/router";

import Layout from "./pages/Layout";

const root = document.body;

interface PageDefinition {
  title: string;
  component?: Component<RouteSectionProps<unknown>>;
  icon?: (props: ComponentProps<"svg">) => JSX.Element;
}

export type PageTree = {
  [key: string]: PageDefinition & {
    children?: PageTree;
  };
};

export const pageTree = {
  "": {
    title: "Hello World!",
    component: lazy(() => import("./pages/Index")),
    icon: WorldIcon,
  },
  info: {
    title: "Info",
    component: lazy(() => import("./pages/Info")),
    icon: InfoCircleIcon,
  },
  "work-clock": {
    title: "Work Clock",
    component: lazy(() => import("./pages/WorkClock")),
    icon: ClockIcon,
  },
  solid: {
    title: "SolidJS",
    icon: SolidIcon,
  },
  tailwind: {
    title: "TailwindCSS",
    icon: TailwindIcon,
  },
  daisyui: {
    title: "DaisyUI",
    icon: DaisyUiIcon,
  },
  kobalte: {
    title: "Kobalte",
    icon: CodeIcon,
  },
  lucide: {
    title: "Lucide Icons",
    icon: LucideIcon,
  },
  iconify: {
    title: "Iconify",
    icon: IconifyIcon,
  },
  router: {
    title: "Solid Router",
    icon: SolidIcon,
  },
} as const;

function flattenPageTree(
  pageTree: PageTree,
): ({ path: string } & PageDefinition)[] {
  const result: ({ path: string } & PageDefinition)[] = [];
  for (const [key, value] of Object.entries(pageTree)) {
    result.push({ path: `/${key}`, ...value });
    if (value.children) {
      result.push(
        ...flattenPageTree(value.children).map((child) => ({
          ...child,
          path: key === "" ? child.path : `/${key}${child.path}`,
        })),
      );
    }
  }
  return result;
}

export const pageList = flattenPageTree(pageTree);

render(() => {
  return (
    <Router root={Layout}>
      <For
        each={pageList}
        children={(page) => (
          <Route
            path={page.path}
            component={page.component}
          />
        )}
      />
      <Route
        path="*404"
        component={() => <span>404 LOL</span>}
      />
    </Router>
  );
}, root);

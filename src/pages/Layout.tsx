import AnarchyIcon from "~icons/game-icons/anarchy";
import FistIcon from "~icons/game-icons/fist";
import HammerSickleIcon from "~icons/game-icons/hammer-sickle";
import MenuIcon from "~icons/line-md/close-to-menu-alt-transition";
import GitHubIcon from "~icons/line-md/github-loop";
import XIcon from "~icons/line-md/menu-to-close-transition";
import SunIcon from "~icons/line-md/moon-filled-to-sunny-filled-loop-transition";
import MoonIcon from "~icons/line-md/sunny-filled-loop-to-moon-filled-loop-transition";
import ElevatorIcon from "~icons/line-md/upload-outline-loop";
import FlagIcon from "~icons/solar/flag-bold-duotone";
import LoadingIcon from "~icons/svg-spinners/bouncing-ball";

import {
  FlowComponent,
  For,
  JSX,
  Suspense,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";

import { createAutoAnimate } from "@formkit/auto-animate/solid";
import { Collapsible } from "@kobalte/core";
import { A, RouteSectionProps, useLocation } from "@solidjs/router";
import { Observer } from "tailwindcss-intersect";

import { pageList } from "..";

const getBreadcrumbs = () => {
  const location = useLocation();

  const path = location.pathname;
  if (path === "/") return null;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <div class="breadcrumbs overflow-x-auto px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm">
      <ul>
        <li>
          <A href="/">Home</A>
        </li>
        <For each={segments}>
          {(segment, index) => {
            const url = () => `/${segments.slice(0, index() + 1).join("/")}`;

            const pageTitle = () =>
              pageList.find((p) => p.path === url())?.title ?? segment;

            return (
              <li>
                <A href={url()}>{pageTitle()}</A>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
};

export const ObserverProvider: FlowComponent = (props: {
  children: JSX.Element;
}) => {
  createEffect(() => {
    Observer.start();
  });

  return <>{props.children}</>;
};

const NavigationLinks = (props: {
  kind: "desktop" | "mobile" | "footer";
  onClick?: JSX.EventHandlerUnion<
    HTMLAnchorElement,
    MouseEvent,
    JSX.EventHandler<HTMLAnchorElement, MouseEvent>
  >;
}): JSX.Element => {
  const location = useLocation();

  return (
    <For each={pageList}>
      {(page) => {
        switch (props.kind) {
          case "desktop":
            return (
              <li>
                <A
                  href={page.path}
                  activeClass="bg-base-200 font-medium"
                  class={
                    "hover:text-primary group text-xs-adjust rounded-lg py-1 transition-all duration-200 hover:scale-105 sm:py-2 sm:text-sm md:text-base"
                  }
                  end={true}
                  onClick={props.onClick}
                >
                  {page.icon && (
                    <page.icon
                      class={
                        "mr-1 inline h-4 w-4 transition-transform duration-200 group-hover:-rotate-12 sm:h-5 sm:w-5"
                      }
                    />
                  )}
                  {page.title}
                </A>
              </li>
            );
          case "mobile":
            return (
              <A
                href={page.path}
                class={`btn btn-ghost btn-xs-adjust sm:btn-sm my-1 justify-start ${
                  location.pathname === page.path ?
                    "bg-base-300 font-medium"
                  : ""
                }`}
                onClick={props.onClick}
              >
                {page.icon && (
                  <page.icon class="mr-1 inline h-4 w-4 sm:h-5 sm:w-5" />
                )}
                <span class="truncate">{page.title}</span>
              </A>
            );
          case "footer":
            return (
              <A
                href={page.path}
                class="link link-hover text-xs-adjust sm:text-sm"
              >
                {page.icon && (
                  <page.icon class="mr-1 inline h-4 w-4 sm:h-5 sm:w-5" />
                )}
                {page.title}
              </A>
            );
          default:
            const _: never = props.kind;
        }
      }}
    </For>
  );
};

const Layout = (props: RouteSectionProps): JSX.Element => {
  const [isDarkMode, setIsDarkMode] = createSignal(
    localStorage.getItem("theme") === "solidarity-dark" ||
      (localStorage.getItem("theme") !== "solidarity-light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [showElevator, setShowElevator] = createSignal(false);
  const [showElevatorIcon, setShowElevatorIcon] = createSignal(false);

  createEffect<number | undefined>((lastTimeout) => {
    clearTimeout(lastTimeout);

    const show = showElevator();
    const timeout = show ? 200 : 300;

    return setTimeout(
      () => setShowElevatorIcon(show),
      timeout,
    ) as unknown as number;
  });

  const [mainRef] = createAutoAnimate();

  (() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const [lastPrefersDark, setPrefersDark] = (() => {
      switch (localStorage.getItem("prefers-dark")) {
        case "true":
          return [true, false];
        case "false":
          return [false, false];
        default:
          return [prefersDark, true];
      }
    })();

    if (lastPrefersDark !== prefersDark || setPrefersDark) {
      localStorage.setItem("prefers-dark", `${prefersDark}`);
      localStorage.removeItem("theme");
    }

    const savedTheme = localStorage.getItem("theme") ?? "";

    if (savedTheme === "solidarity-dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.body.setAttribute("data-theme", "solidarity-dark");
    } else {
      setIsDarkMode(false);
      document.body.setAttribute("data-theme", "solidarity-light");
    }
  })();

  const toggleTheme = () => {
    const newMode = !isDarkMode();
    setIsDarkMode(newMode);
    const theme = newMode ? "solidarity-dark" : "solidarity-light";
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  // Schließe das mobile Menü, wenn sich die Route ändert
  const handleNavigation = () => {
    setIsMobileMenuOpen(false);
  };

  // Handle scroll to track when to show elevator button
  createEffect(() => {
    const handleScroll = () => {
      // Show elevator button when scrolled down more than 300px
      setShowElevator(window.scrollY > 300);
    };

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll);

    // Initial check
    handleScroll();

    // Cleanup
    onCleanup(() => {
      window.removeEventListener("scroll", handleScroll);
    });
  });

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Navigation-Links für Desktop und Mobile

  return (
    <div class="bg-base-100 flex min-h-screen flex-col transition-colors duration-200">
      {/* Navbar */}
      <div class="navbar bg-base-100 sticky top-0 z-10 min-h-12 px-2 shadow-md sm:px-4">
        <div class="navbar-start">
          <A
            href="/"
            class="btn btn-ghost p-1 text-base font-bold sm:p-2 sm:text-xl"
            activeClass="text-primary"
            end={true}
          >
            <span class="xs:inline hidden">Simple Frontend Stack</span>
            <span class="xs:hidden">SFS</span>
          </A>
        </div>

        {/* Desktop Navigation */}
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal gap-1 px-1">
            <NavigationLinks kind="desktop" />
          </ul>
        </div>

        <div class="navbar-end">
          {/* Theme Toggle */}
          <button
            class="btn btn-ghost btn-circle btn-sm sm:btn-md"
            onClick={toggleTheme}
            aria-label={
              isDarkMode() ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDarkMode() ?
              <SunIcon class="h-4 w-4 sm:h-5 sm:w-5" />
            : <MoonIcon class="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/yerTools/simple-frontend-stack"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-circle btn-sm sm:btn-md"
            aria-label="GitHub repository"
          >
            <GitHubIcon class="h-4 w-4 sm:h-5 sm:w-5" />
          </a>

          {/* Mobile Menu Button */}
          <button
            class="btn btn-ghost btn-circle btn-sm sm:btn-md lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
            aria-label={isMobileMenuOpen() ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen() ?
              <XIcon class="h-4 w-4 sm:h-5 sm:w-5" />
            : <MenuIcon class="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <Collapsible.Root
        open={isMobileMenuOpen()}
        onOpenChange={setIsMobileMenuOpen}
        class="lg:hidden"
      >
        <Collapsible.Content>
          <div class="menu bg-base-200 rounded-b-box w-full p-2 shadow-md">
            <div class="xs:grid-cols-1 grid grid-cols-2 gap-1">
              <NavigationLinks
                kind="mobile"
                onClick={handleNavigation}
              />
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Add breadcrumbs */}
      {getBreadcrumbs()}

      <main
        ref={mainRef}
        class="container mx-auto max-w-5xl flex-grow px-4 py-8"
      >
        <Suspense
          fallback={
            <div class="flex h-64 w-full items-center justify-center">
              <div class="flex flex-col items-center">
                <span>
                  <LoadingIcon class="text-primary h-16 w-16" />
                </span>
                <p class="mt-4 text-lg font-medium">
                  Inhalte werden geladen...
                </p>
              </div>
            </div>
          }
        >
          {props.children}
        </Suspense>
      </main>

      {/* Footer */}
      <footer class="footer footer-center bg-base-300 text-base-content p-6">
        <div class="mt-4">
          <p class="text-lg">
            <span class="font-bold">
              <AnarchyIcon class="inline" /> {new Date().getFullYear()}{" "}
              <HammerSickleIcon class="inline" />
            </span>{" "}
            - Free and open-source software - with free as in freedom!{" "}
            <FlagIcon class="inline text-[#ff0000]" />
            <FistIcon class="inline" />
          </p>
        </div>
      </footer>

      {/* Elevator Button */}
      <div
        class={`fixed right-8 bottom-8 transition-all duration-300 ${
          showElevator() ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      >
        <button
          onClick={scrollToTop}
          class="btn btn-primary btn-xl btn-circle shadow-lg transition-transform duration-200 hover:scale-110"
          aria-label="Scroll to top"
        >
          {showElevatorIcon() && <ElevatorIcon class="h-10 w-10" />}
        </button>
      </div>
    </div>
  );
};

export default Layout;

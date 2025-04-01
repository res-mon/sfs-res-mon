import BrainIcon from "~icons/tabler/brain";
import BriefcaseIcon from "~icons/tabler/briefcase";
import BuildingSkyscraperIcon from "~icons/tabler/building-skyscraper";
import ChartLineIcon from "~icons/tabler/chart-line";
import ClockIcon from "~icons/tabler/clock";
import DatabaseIcon from "~icons/tabler/database";
import GlobeIcon from "~icons/tabler/globe";
import HeartIcon from "~icons/tabler/heart";
import InfoCircleIcon from "~icons/tabler/info-circle";
import ReportMoneyIcon from "~icons/tabler/report-money";
import RocketIcon from "~icons/tabler/rocket";
import ToolIcon from "~icons/tabler/tool";

import { Component, ComponentProps, For, JSX } from "solid-js";

interface FeatureProps {
  title: string;
  description: string;
  icon: (props: ComponentProps<"svg">) => JSX.Element;
}

const Feature: Component<FeatureProps> = (props) => {
  return (
    <div class="bg-base-200 card intersect:motion-preset-expand intersect-once transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
      <div class="card-body p-4 sm:p-6">
        <div class="mb-2 flex items-center gap-3">
          <props.icon class="text-primary h-8 w-8" />
          <h3 class="card-title text-lg md:text-xl">{props.title}</h3>
        </div>
        <p class="text-sm sm:text-base">{props.description}</p>
      </div>
    </div>
  );
};

const ValueCard: Component<FeatureProps> = (props) => {
  return (
    <div class="bg-base-100 card border-base-300 border shadow-sm">
      <div class="card-body p-4">
        <div class="flex flex-col items-center gap-2 text-center">
          <props.icon class="text-secondary h-10 w-10" />
          <h3 class="text-lg font-bold">{props.title}</h3>
          <p class="text-sm">{props.description}</p>
        </div>
      </div>
    </div>
  );
};

const Info: Component = (): JSX.Element => {
  const features: FeatureProps[] = [
    {
      title: "Projekt-Management",
      description:
        "Verfolgen Sie Ihre Zeit über verschiedene Projekte hinweg und behalten Sie den Überblick.",
      icon: BriefcaseIcon,
    },
    {
      title: "Aufgabenorganisation",
      description:
        "Unterteilen Sie Projekte in Teilbereiche, Unterbereiche und Aufgaben für eine strukturierte Arbeit.",
      icon: BuildingSkyscraperIcon,
    },
    {
      title: "Tag-System",
      description:
        "Kennzeichnen Sie Aufgaben mit Kategorien wie 'Architektur', 'Frontend' oder 'Backend'.",
      icon: ToolIcon,
    },
    {
      title: "Notizen und Bewertungen",
      description:
        "Fügen Sie Kontext zu Aufgaben hinzu und bewerten Sie Ihre Zufriedenheit mit der Erledigung.",
      icon: BrainIcon,
    },
    {
      title: "Tool-Investment-Tracking",
      description:
        "Berechnen Sie den ROI für Tools, die Sie entwickeln, um Arbeitsabläufe zu optimieren.",
      icon: ChartLineIcon,
    },
    {
      title: "Rechnungsgenerierung",
      description:
        "Vereinfachen Sie die Kundenabrechnung basierend auf der erfassten Zeit.",
      icon: ReportMoneyIcon,
    },
    {
      title: "Ressourcenanalyse",
      description:
        "Bewerten Sie die Rentabilität von Hardware- und Tool-Investitionen.",
      icon: DatabaseIcon,
    },
    {
      title: "Arbeitsanalyse",
      description:
        "Überprüfen Sie aktuelle Muster, Einnahmen und Tarife Ihrer Arbeit.",
      icon: GlobeIcon,
    },
  ];

  const values: FeatureProps[] = [
    {
      title: "Transparenz",
      description:
        "Wir glauben an volle Transparenz und Ehrlichkeit bei der Zeiterfassung und Ressourcennutzung.",
      icon: InfoCircleIcon,
    },
    {
      title: "Effizienz",
      description:
        "Unsere Tools sollen Ihnen helfen, effizienter zu arbeiten und mehr Zeit für wichtige Aufgaben zu haben.",
      icon: RocketIcon,
    },
    {
      title: "Wertschätzung von Zeit",
      description:
        "Zeit ist die wertvollste Ressource - wir helfen Ihnen, sie zu schätzen und optimal zu nutzen.",
      icon: ClockIcon,
    },
    {
      title: "Community",
      description:
        "Wir glauben an Open Source und die Kraft der Gemeinschaft, um bessere Lösungen zu schaffen.",
      icon: HeartIcon,
    },
  ];

  return (
    <div class="container mx-auto space-y-16 px-4 py-8">
      {/* Hero Section */}
      <section class="space-y-4 text-center">
        <h1 class="mb-4 text-4xl font-bold md:text-5xl">Über ResMon</h1>
        <p class="mx-auto max-w-3xl text-xl">
          ResMon steht für <strong>Res</strong>ource <strong>Mon</strong>itor -
          ein umfassendes Werkzeug zur Verfolgung Ihrer wertvollsten Ressourcen,
          insbesondere <strong>Zeit</strong>.
        </p>
      </section>

      {/* Origin and Purpose */}
      <section class="card bg-base-100 overflow-hidden shadow-xl">
        <div class="card-body">
          <h2 class="card-title mb-4 text-2xl md:text-3xl">
            Ursprung und Zweck
          </h2>
          <div class="prose max-w-none">
            <p>
              Die Entstehung von ResMon geht auf ein Universitätsprojekt zurück,
              das die Notwendigkeit eines unkomplizierten
              Arbeitszeiterfassungstools aufzeigte. Für Freiberufler und
              Personen mit Nebenprojekten ist es von unschätzbarem Wert, einen
              einfachen Weg zu haben, um den Zeitaufwand zu messen.
            </p>
            <p>
              Wir verstehen, dass Zeit eine begrenzte Ressource ist, und daher
              ist es entscheidend, sie effektiv zu verfolgen und zu verwalten.
              ResMon wurde entwickelt, um diesen Prozess so reibungslos und
              intuitiv wie möglich zu gestalten.
            </p>
            <p>
              Mit ResMon können Sie nicht nur Ihre Zeit verfolgen, sondern auch
              andere wertvolle Ressourcen wie Ausgaben, Werkzeuge und
              Investitionen. Es bietet Ihnen einen umfassenden Überblick über
              Ihre Ressourcennutzung und hilft Ihnen, fundierte Entscheidungen
              zu treffen.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section class="card bg-base-100 overflow-hidden shadow-xl">
        <div class="card-body">
          <h2 class="card-title mb-4 text-2xl md:text-3xl">
            Unsere Philosophie
          </h2>
          <div class="prose max-w-none">
            <p>
              Verschwenden Sie Ihre Ressourcen nicht, besonders nicht die
              kostbarste: <strong>Zeit</strong>. Behalten Sie sie mit{" "}
              <strong>ResMon</strong> im Blick.
            </p>
            <p>
              Die Anwendung ist darauf ausgelegt, Ihre Aktivitäten, Ausgaben und
              Erfolge autonom zu verfolgen - privat und transparent. Indem sie
              die Nachverfolgung Ihrer Unternehmungen und Finanzen vereinfacht,
              ermöglicht Ihnen ResMon, den Wert Ihrer Zeit und Investitionen zu
              ermitteln.
            </p>
            <p>
              Wir glauben, dass gute Entscheidungen auf guten Daten basieren.
              ResMon hilft Ihnen, diese Daten zu sammeln und zu analysieren,
              damit Sie fundierte Entscheidungen über Ihre Ressourcenverteilung
              treffen können.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section>
        <h2 class="mb-8 text-center text-2xl font-bold md:text-3xl">
          Unsere Werte
        </h2>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <For each={values}>{(value) => <ValueCard {...value} />}</For>
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 class="mb-8 text-center text-2xl font-bold md:text-3xl">
          Funktionen
        </h2>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <For each={features}>{(feature) => <Feature {...feature} />}</For>
        </div>
      </section>

      {/* Current Status */}
      <section class="card bg-base-100 border-warning border shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-2xl">Aktueller Status ⚠️</h2>
          <p>
            Dieses Projekt befindet sich in einer frühen Entwicklungsphase. Die
            neueste Version läuft auf{" "}
            <a
              href="https://resmon.de"
              class="link link-primary"
              target="_blank"
            >
              ResMon.de
            </a>
          </p>
          <div class="card-actions justify-end">
            <a
              href="https://resmon.de"
              class="btn btn-primary"
              target="_blank"
            >
              Website besuchen
            </a>
          </div>
        </div>
      </section>

      {/* Technical Stack */}
      <section class="card bg-base-100 overflow-hidden shadow-xl">
        <div class="card-body">
          <h2 class="card-title mb-4 text-2xl md:text-3xl">
            Technischer Stack
          </h2>
          <div class="prose max-w-none">
            <ul>
              <li>
                <strong>Frontend:</strong> SolidJS - React-ähnliche Einfachheit,
                unübertroffene Leistung
              </li>
              <li>
                <strong>Styling:</strong> TailwindCSS + DaisyUI - Utility-first
                Schönheit
              </li>
              <li>
                <strong>Backend:</strong> PocketBase - Open-Source-Backend in
                einer einzigen Datei
              </li>
              <li>
                <strong>Bundler:</strong> Vite - Frontend-Tooling der nächsten
                Generation
              </li>
              <li>
                <strong>Runtime:</strong> Bun - All-in-One JavaScript-Laufzeit &
                Toolkit
              </li>
            </ul>
            <p>
              Dieser Stack bietet eine perfekte Balance zwischen Leistung,
              Entwicklerfreundlichkeit und Benutzeroberfläche, die es ResMon
              ermöglicht, eine nahtlose und effiziente Erfahrung zu bieten.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section class="text-center">
        <div class="card bg-primary text-primary-content mx-auto max-w-2xl">
          <div class="card-body">
            <h2 class="card-title justify-center text-2xl">
              Bereit, Ihre Ressourcen zu optimieren?
            </h2>
            <p>
              Beginnen Sie noch heute mit ResMon, um Ihre Zeit und Ressourcen
              effektiver zu verwalten!
            </p>
            <div class="card-actions mt-4 justify-center">
              <a
                href="https://resmon.de"
                class="btn btn-outline"
                target="_blank"
              >
                Starten Sie jetzt
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Info;

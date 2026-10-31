/**
 * A schema.org `Dataset` entry for a chart's data (C14), for a site that wants its numbers found
 * by search engines and AI answers. Optional: the numbers are already in the HTML table.
 */

/** What {@link datasetJsonLd} describes. */
export interface DatasetOptions {
  readonly name: string;
  /** What the data are, in a sentence or more (search engines ask for 50 characters or more). */
  readonly description: string;
  /** The page the data are on. */
  readonly url?: string;
  /** A CSV file of the data, as the chart's `csvHref`. */
  readonly csvHref?: string;
  /** Who made the data: a person or an organization's name. */
  readonly creator?: string;
  /** A license URL, such as `https://creativecommons.org/licenses/by/4.0/`. */
  readonly license?: string;
  readonly datePublished?: string;
  /** The time the data cover, as ISO 8601 (`2025-10/2026-01`). */
  readonly temporalCoverage?: string;
  readonly keywords?: readonly string[];
  /** The measured columns, e.g. the chart's table headers. */
  readonly variables?: readonly string[];
}

/**
 * A `<script type="application/ld+json">` element describing a dataset. It is a data block, not
 * a script: browsers never run it, so a strict CSP does not block it. `<` is escaped, so no value
 * can close the element early.
 *
 * @example
 * datasetJsonLd({ name: "Weekly positive tests", description: "...", csvHref: "/data/tests.csv" });
 */
export function datasetJsonLd(options: DatasetOptions): string {
  const { name, description } = options;
  if (!name.trim() || !description.trim()) {
    throw new Error("datasetJsonLd: name and description are required");
  }
  const entry = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: options.url,
    creator: options.creator ? { "@type": "Organization", name: options.creator } : undefined,
    license: options.license,
    datePublished: options.datePublished,
    temporalCoverage: options.temporalCoverage,
    keywords: options.keywords,
    variableMeasured: options.variables,
    distribution: options.csvHref
      ? { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: options.csvHref }
      : undefined,
  };
  const json = JSON.stringify(entry).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

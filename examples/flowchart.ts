// A Mermaid flowchart, drawn on the server.
import { mermaidDiagram } from "enarratio/diagram";

export default mermaidDiagram({
  source: `flowchart TD
  A[Sample received] --> B{Passes QC?}
  B -->|No| E[Request a new sample]
  E --> A
  subgraph Lab
    B -->|Yes| C[Extract RNA]
    C --> D[Sequence]
  end
  D --> F[(Results database)]`,
  title: "From sample to result",
  alt: "Flowchart: a received sample is checked for quality. If it passes, the lab extracts RNA and sequences it, and the results go to the database; if it fails, a new sample is requested and checked again.",
  caption: "Illustrative workflow.",
});

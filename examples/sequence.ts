// A Mermaid sequence diagram, drawn on the server.
import { mermaidDiagram } from "enarratio/diagram";

export default mermaidDiagram({
  source: `sequenceDiagram
  participant R as Reader
  participant S as Site
  participant A as Access
  R->>S: Open the admin page
  S->>A: Is this reader signed in?
  alt signed in
    A-->>S: Yes, with their email
    S-->>R: The admin page
  else signed out
    A-->>R: Sign-in page
    R->>A: Passkey
    A-->>R: Back to the admin page
  end`,
  title: "Signing in to an admin page",
  alt: "Sequence diagram: the reader opens the admin page and the site asks Access whether they are signed in. If they are, the site shows the page; if not, Access shows its sign-in page, the reader signs in with a passkey, and Access sends them back to the admin page.",
});

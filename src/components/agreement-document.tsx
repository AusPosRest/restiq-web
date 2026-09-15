// Agreement text in the fixed markup the backend turns into the signed PDF
// (restiq-backend#150, src/ops/agreements/agreement-document.ts): a block's
// leading "# ", "## ", "### " lines are headings, blank lines separate
// paragraphs, single newlines are kept. Rendered as React text - nothing is
// ever injected as HTML.

export interface AgreementBlock {
  kind: "h1" | "h2" | "h3" | "p";
  text: string;
}

const HEADING_KINDS = ["h1", "h2", "h3"] as const;

function blocksOf(chunk: string): AgreementBlock[] {
  const [first, ...rest] = chunk.split("\n");
  const heading = /^(#{1,3})[ \t]+(.+)$/.exec(first);
  if (!heading) return [{ kind: "p", text: chunk }];
  const block: AgreementBlock = { kind: HEADING_KINDS[heading[1].length - 1], text: heading[2].trim() };
  return rest.length > 0 ? [block, ...blocksOf(rest.join("\n"))] : [block];
}

export function agreementBlocks(body: string): AgreementBlock[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap(blocksOf);
}

export function AgreementDocument({ body, testId }: Readonly<{ body: string; testId?: string }>) {
  return (
    <div data-testid={testId} className="space-y-3 font-serif text-sm leading-relaxed text-foreground">
      {agreementBlocks(body).map((block, index) => {
        if (block.kind === "h1")
          return (
            <h3 key={index} className="pt-3 text-base font-semibold">
              {block.text}
            </h3>
          );
        if (block.kind === "h2")
          return (
            <h4 key={index} className="pt-2 font-semibold">
              {block.text}
            </h4>
          );
        if (block.kind === "h3")
          return (
            <h5 key={index} className="font-semibold">
              {block.text}
            </h5>
          );
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

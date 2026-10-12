// Pure helpers for the simulated mail inbox (issue #318).

export interface InboxMessage {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

export type InboxResult = { kind: "ok"; messages: InboxMessage[] } | { kind: "off" } | { kind: "unreachable" };

export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string };

/** Splits plain-text email into text and http(s) links, so links can be clicked. */
export function linkify(text: string): TextPart[] {
  return text
    .split(/(https?:\/\/[^\s<>"]+)/g)
    .filter(Boolean)
    .map((value) => (/^https?:\/\//.test(value) ? { kind: "link", value } : { kind: "text", value }));
}

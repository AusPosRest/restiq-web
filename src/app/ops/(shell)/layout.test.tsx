// restiq-web#440: the Platform Console sidebar scrolled away with the page. jsdom has no layout, so
// this pins the classes that keep it in place - the same ones the owner console's sidebar uses.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OpsShellLayout from "./layout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/ops/tenants",
}));

describe("OpsShellLayout", () => {
  afterEach(cleanup);

  it("keeps the sidebar at full window height while the content scrolls", () => {
    const { container } = render(
      <OpsShellLayout>
        <p>content</p>
      </OpsShellLayout>,
    );
    const classes = container.querySelector("aside")?.className.split(/\s+/) ?? [];
    expect(classes).toEqual(expect.arrayContaining(["sticky", "top-0", "h-screen", "overflow-y-auto"]));
  });
});

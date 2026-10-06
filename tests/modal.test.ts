import { test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { Modal } from "../src/components/dashboard";

test("photo picker cancellation preserves the modal and unsaved entry; dialog cancellation still closes", async () => {
  const page = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000" });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const globals = { window: page.window, document: page.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // jsdom provides dialog elements, but not their native opening/closing APIs.
  Object.defineProperties(page.window.HTMLDialogElement.prototype, {
    showModal: { value: function(this: HTMLDialogElement) { this.open = true; } },
    close: { value: function(this: HTMLDialogElement) { this.open = false; } },
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(page.window.document.getElementById("root")!);
  let closes = 0;
  try {
    await act(async () => {
      root.render(createElement(Modal, {
        title: "Add a disc", close: () => { closes++; },
        children: createElement("form", null,
          createElement("input", { name: "discName", defaultValue: "Unsaved Destroyer" }),
          createElement("input", { type: "file", name: "photo" }),
        ),
      }));
    });
    const dialog = page.window.document.querySelector("dialog")!;
    const picker = page.window.document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const name = page.window.document.querySelector<HTMLInputElement>('input[name="discName"]')!;
    await act(async () => {
      // Native file inputs send this bubbling event on Cancel/Escape, and when
      // selecting the same file again. It must not dismiss the parent dialog.
      picker.dispatchEvent(new page.window.Event("cancel", { bubbles: true }));
      picker.dispatchEvent(new page.window.Event("cancel", { bubbles: true }));
    });
    assert.equal(closes, 0);
    assert.equal(dialog.open, true);
    assert.equal(name.value, "Unsaved Destroyer");
    assert.equal(page.window.document.querySelector('input[name="discName"]'), name);

    const cancelDialog = new page.window.Event("cancel", { cancelable: true });
    await act(async () => { dialog.dispatchEvent(cancelDialog); });
    assert.equal(closes, 1);
    assert.equal(cancelDialog.defaultPrevented, true);
  } finally {
    await act(async () => { root.unmount(); });
    page.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

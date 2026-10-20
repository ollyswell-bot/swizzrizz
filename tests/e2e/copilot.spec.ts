import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

const FIXTURES = join(__dirname, "..", "fixtures");

async function enterDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Screenshots" })).toBeVisible();
}

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/copilot");
  await expect(page).toHaveURL(/\/login$/);
});

test("screenshot → transcript → reply → copy → save", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enterDemo(page);

  // Upload two screenshots, then reorder them.
  await page.getByTestId("file-input").setInputFiles([join(FIXTURES, "chat-1.png"), join(FIXTURES, "chat-2.png")]);
  await expect(page.getByRole("img", { name: "Screenshot 2" })).toBeVisible();
  await page.getByRole("button", { name: "Move screenshot 2 earlier" }).click();

  // Extract and review.
  await page.getByRole("button", { name: "Extract conversation" }).click();
  const firstMessage = page.getByRole("textbox", { name: "Message 1 text" });
  await expect(firstMessage).toBeVisible();
  const count = await page.getByRole("textbox", { name: /^Message \d+ text$/ }).count();
  expect(count).toBeGreaterThan(3);

  // Correct a message and its sender.
  await firstMessage.fill("hey, loved the beach set. do you have more?");
  await page.getByRole("radiogroup", { name: "Sender of message 1" }).getByRole("radio", { name: "Fan" }).click();

  // Pick a sample fan for context.
  await page.getByLabel("Fan alias", { exact: true }).selectOption({ label: "sample_mike (sample)" });

  // Analyse.
  await page.getByRole("button", { name: "Analyze conversation" }).first().click();
  const best = page.getByRole("textbox", { name: "Best reply" });
  await expect(best).toBeVisible();
  await expect(page.getByText("Demo AI").first()).toBeVisible();
  const replyText = await best.inputValue();
  expect(replyText.length).toBeGreaterThan(5);

  // Edit then copy.
  await best.fill(`${replyText} 💜`);
  await page.getByRole("button", { name: "Copy best reply" }).click();
  await expect(page.getByText("Copied. Review it once more")).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(`${replyText} 💜`);

  // Save and find it in the conversation list.
  await page.getByRole("button", { name: "Save conversation" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("link", { name: "Conversations" }).first().click();
  await expect(page.getByText("Chat with sample_mike")).toBeVisible();
});

test("pasting a screenshot from the clipboard adds it", async ({ page }) => {
  await enterDemo(page);
  await page.evaluate(async () => {
    const bytes = await (await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAHUlEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAABwNxBAAAEjHB2gAAAAAElFTkSuQmCC")).arrayBuffer();
    const file = new File([bytes], "pasted.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt }));
  });
  await expect(page.getByRole("img", { name: "Screenshot 1" })).toBeVisible();
});

test("manual transcript works without screenshots and edits survive a reload", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: "Add a message manually" }).click();
  await page.getByRole("textbox", { name: "Message 1 text" }).fill("no thanks, too expensive for me right now");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message 1 text" })).toHaveValue("no thanks, too expensive for me right now");
  await page.getByRole("button", { name: "Analyze conversation" }).first().click();
  await expect(page.getByText("No sale right now")).toBeVisible();
  await expect(page.getByText("No offer suggested for this moment.")).toBeVisible();
});

test("on a phone the copilot uses tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  await expect(page.getByRole("tab", { name: "Screenshots" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Fan" }).click();
  await expect(page.getByLabel("Fan alias", { exact: true })).toBeVisible();
});

import { expect, test } from "@playwright/test";

test.describe("web-client smoke", () => {
  test("home loads with chat heading", async ({ page }) => {
    await page.goto("/ru");
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("locale nl route", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("body")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

async function register(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  const username = `player_${crypto.randomUUID().slice(0, 12)}`;
  await page.getByLabel("Логин", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill("test-password-123");
  await page.getByLabel("Повтори пароль", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Создать аккаунт ↗" }).click();
  await expect(page.getByRole("heading", { name: "Один город. Свои люди." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/community-${page.viewportSize().width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Апгрейд", exact: false }).click();
  return username;
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`Апгрейд, история и сохранение профиля ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await register(page);
    await expect(
      page.getByRole("button", { name: "↑ Апгрейднуть" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: /Арбуз/ }).click();
    await expect(page.locator(".roulette-core strong")).toHaveText("6,6666%");
    await page.getByRole("button", { name: "Минетки", exact: true }).click();
    await expect(page.locator(".roulette-core strong")).toHaveText("16,6666%");
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/upgrade") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "↑ Апгрейднуть" }).click();
    const result = await (await responsePromise).json();
    await expect(page.locator(".feedback")).toContainText(
      result.result.won ? "Апгрейд удался" : "Не повезло",
    );
    await expect(page.locator(".wallet strong")).toContainText(
      "2 250".replace(" ", "\u00a0"),
    );
    await expect(
      page.getByRole("button", { name: "Новый апгрейд" }),
    ).toBeEnabled();
    await page.screenshot({
      path: `test-results/upgrade-${viewport.width}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map(
          (el) =>
            `${el.tagName}.${el.className}: ${Math.round(el.getBoundingClientRect().right)}`,
        ),
    );
    expect(overflow).toEqual([]);
    await page.getByRole("button", { name: "История", exact: false }).click();
    await expect(page.locator(".history-row")).toHaveCount(1);
    await expect(page.locator(".history-row")).toContainText(
      result.result.won ? "Победа" : "Проигрыш",
    );
    await page.reload();
    await expect(page.locator(".wallet strong")).toContainText("2\u00a0250");
    await page.getByRole("button", { name: "Инвентарь", exact: false }).click();
    await expect(page.locator(".inventory-item")).toHaveCount(
      result.inventory.length,
    );
    expect(errors).toEqual([]);
  });
}

test("Потерянный ответ восстанавливается после перезагрузки без второй ставки", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Минетки", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "↑ Апгрейднуть" }),
  ).toBeEnabled();
  let operation;
  await page.route(
    "**/api/upgrade",
    async (route) => {
      operation = route.request().postDataJSON();
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "↑ Апгрейднуть" }).click();
  await expect(
    page.getByRole("button", { name: "Проверить операцию" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Апгрейд", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Проверить операцию" }),
  ).toBeEnabled();
  const responsePromise = page.waitForResponse((r) =>
    r.url().endsWith("/api/upgrade"),
  );
  await page.getByRole("button", { name: "Проверить операцию" }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON().requestId).toBe(operation.requestId);
  const data = await response.json();
  expect(data.balance).toBe(2250);
  expect(data.history).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Новый апгрейд" }),
  ).toBeEnabled();
});

for (const width of [1440, 390]) {
  test(`Вход обязателен, выход и восстановление аккаунта ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "С возвращением." })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/login-${width}.png`, fullPage: true });
    const username = await register(page);
    await page.getByRole("button", { name: "Инвентарь", exact: false }).click();
    await page.getByRole("button", { name: "Обменять за" }).first().click();
    await expect(page.locator(".inventory-item")).toHaveCount(2);
    const balance = await page.locator(".wallet strong").textContent();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page.getByRole("heading", { name: "С возвращением." })).toBeVisible();
    await page.getByLabel("Логин", { exact: true }).fill(username);
    await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Войти в сообщество ↗" }).click();
    await expect(page.getByRole("alert")).toContainText("Неверный логин или пароль");
    await page.getByLabel("Пароль", { exact: true }).fill("test-password-123");
    await page.getByRole("button", { name: "Войти в сообщество ↗" }).click();
    await expect(page.getByRole("heading", { name: "Один город. Свои люди." })).toBeVisible();
    await expect(page.locator(".wallet strong")).toHaveText(balance);
    await page.getByRole("button", { name: "Инвентарь", exact: false }).click();
    await expect(page.locator(".inventory-item")).toHaveCount(2);
    await page.context().clearCookies();
    await page.reload();
    await expect(page.getByRole("heading", { name: "С возвращением." })).toBeVisible();
  });
}

test("Обмен предмета, невалидная ставка и публикация новости", async ({
  page,
}) => {
  await register(page);
  await expect(
    page.getByRole("button", { name: "↑ Апгрейднуть" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Инвентарь", exact: false }).click();
  await page.getByRole("button", { name: "Обменять за" }).first().click();
  await expect(page.locator(".inventory-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Апгрейд", exact: false }).click();
  await page.getByRole("button", { name: "Минетки", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Сумма ставки в Минетках" })
    .fill("-1");
  await expect(page.locator(".feedback")).toContainText("целым числом");
  await expect(
    page.getByRole("button", { name: "↑ Апгрейднуть" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Сообщество", exact: false }).click();
  await page
    .getByRole("textbox", { name: "Заголовок", exact: true })
    .fill("Новая кондиция");
  await page
    .getByRole("textbox", { name: "Текст новости", exact: true })
    .fill("<script>window.injected=true</script>");
  await page.getByRole("button", { name: "Опубликовать новость" }).click();
  await expect(page.locator(".news-item").first()).toContainText(
    "Новая кондиция",
  );
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator(".member")).toHaveCount(7);
});

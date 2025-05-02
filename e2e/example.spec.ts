import { expect, test } from '@playwright/test';


test('shows login form', async ({ page }) => {
  await page.goto('/');

  // Expect the login form to be visible
  const loginForm = page.locator('form#login-form');
  await expect(loginForm).toBeVisible();

  // Expect the username and password fields to be present
  const usernameField = loginForm.locator('input[name="username"]');
  const passwordField = loginForm.locator('input[name="password"]');
  await expect(usernameField).toBeVisible();
  await expect(passwordField).toBeVisible();

  // Expect the submit button to be present
  const submitButton = loginForm.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
}
  );
